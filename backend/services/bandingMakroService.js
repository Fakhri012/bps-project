const fs = require('fs')

const { getBandingMakroRows } = require('./googleSheetsService')
const {
  buildBandingMakroData,
  buildQuarterlyBandingMakroData,
  extractAnnualTransactions,
  extractQuarterlyTransactions
} = require('../utils/macroDataNormalizer')
const {
  JISDOR_FILE_PATH,
  readJisdorData,
  summarizeJisdor
} = require('./jisdorService')

const CACHE_DURATION_MS = 5 * 60 * 1000
let cachedResult = null
let cachedAt = 0
let inFlight = null
let cachedJisdor = null
let cachedJisdorVersion = null

function getJisdorSummary() {
  const stats = fs.statSync(JISDOR_FILE_PATH)
  const version = `${stats.size}:${stats.mtimeMs}`

  if (!cachedJisdor || cachedJisdorVersion !== version) {
    const source = readJisdorData(JISDOR_FILE_PATH)
    cachedJisdor = {
      ...source,
      ...summarizeJisdor(source.observations)
    }
    cachedJisdorVersion = version
  }

  return cachedJisdor
}

async function loadBandingMakroData() {
  const rows = await getBandingMakroRows()
  const transactions = extractAnnualTransactions(rows)
  const quarterlyTransactions = extractQuarterlyTransactions(rows)
  const jisdor = getJisdorSummary()
  const data = buildBandingMakroData(transactions.records, jisdor)
  const detailTriwulanan = buildQuarterlyBandingMakroData(
    transactions.records,
    quarterlyTransactions.records,
    jisdor
  )
  const rateYears = new Set(jisdor.annual.map(item => item.tahun))

  return {
    data,
    detailTriwulanan,
    summary: {
      transaksi: {
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        sheet: 'Banding Makro',
        kolom: {
          tahun: 'TAHUN',
          transaksi: 'Transaksi'
        },
        satuan: 'Juta USD',
        jumlahBarisTahunan: transactions.records.length,
        jumlahBarisTriwulanan: quarterlyTransactions.records.length,
        metodeTriwulanan: 'Nilai transaksi ditampilkan hanya untuk tahun dan triwulan yang tersedia pada sumber.',
        tahunDuplikat: transactions.duplicateYears,
        barisTidakValid: transactions.invalidRows
      },
      kurs: {
        file: jisdor.file,
        sheets: jisdor.sourceSheets,
        satuan: 'IDR per USD',
        metodeTriwulanan: 'Rata-rata aritmetika seluruh observasi harian valid per triwulan.',
        metodeTahunan: 'Rata-rata sederhana dari rata-rata triwulan yang tersedia.',
        jumlahObservasiValid: jisdor.observations.length,
        jumlahBarisTidakValid: jisdor.invalidRows.length,
        tahunTanpaKurs: transactions.records
          .filter(item => !rateYears.has(item.tahun))
          .map(item => item.tahun),
        rekapTriwulanan: jisdor.quarterly,
        rekapTahunan: jisdor.annual
      },
      rumus: '(Transaksi Juta USD × rata-rata JISDOR tahunan) ÷ 1.000.000'
    }
  }
}

async function getBandingMakroData({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedResult && Date.now() - cachedAt < CACHE_DURATION_MS) {
    return cachedResult
  }

  if (inFlight) {
    return inFlight
  }

  inFlight = loadBandingMakroData()

  try {
    const result = await inFlight
    cachedResult = result
    cachedAt = Date.now()
    return result
  } finally {
    inFlight = null
  }
}

function clearBandingMakroCache() {
  cachedResult = null
  cachedAt = 0
}

module.exports = {
  clearBandingMakroCache,
  getBandingMakroData
}
