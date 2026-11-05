const path = require('path')
const XLSX = require('@e965/xlsx')

const JISDOR_FILE_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'data',
  'raw',
  'tabel_kurs.xlsx'
)

function parseJisdorDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
  }

  if (typeof value !== 'string') {
    return null
  }

  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)

  if (match) {
    const [, monthText, dayText, yearText] = match
    const month = Number(monthText)
    const day = Number(dayText)
    const year = Number(yearText)
    const date = new Date(Date.UTC(year, month - 1, day))

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
    return null
  }

  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!iso) return null

  const [, year, month, day] = iso
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return date.toISOString().slice(0, 10) === `${year}-${month}-${day}`
    ? `${year}-${month}-${day}`
    : null
}

function parseJisdorRate(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }

  const normalized = value.trim().replace(/\s/g, '')
  const numericText = normalized.includes(',') && normalized.includes('.')
    ? normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '')
    : normalized.replace(',', '.')
  const rate = Number(numericText)
  return Number.isFinite(rate) && rate > 0 ? rate : null
}

function readJisdorData(filePath = JISDOR_FILE_PATH) {
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    raw: true
  })
  const observations = []
  const invalidRows = []
  const sourceSheets = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: null
    })
    const headerIndex = rows.findIndex(row =>
      row.some(value => String(value ?? '').trim().toLowerCase() === 'tanggal') &&
      row.some(value => String(value ?? '').trim().toLowerCase() === 'kurs')
    )

    if (headerIndex < 0) {
      throw new Error(`Kolom Tanggal dan Kurs tidak ditemukan pada sheet "${sheetName}"`)
    }

    const dateColumn = rows[headerIndex].findIndex(
      value => String(value ?? '').trim().toLowerCase() === 'tanggal'
    )
    const rateColumn = rows[headerIndex].findIndex(
      value => String(value ?? '').trim().toLowerCase() === 'kurs'
    )
    sourceSheets.push({
      nama: sheetName,
      kolomTanggal: XLSX.utils.encode_col(dateColumn),
      kolomKurs: XLSX.utils.encode_col(rateColumn)
    })

    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const row = rows[index]

      if (row.every(value => value === null || value === '')) {
        continue
      }

      const tanggal = parseJisdorDate(row[dateColumn])
      const nilai = parseJisdorRate(row[rateColumn])

      if (!tanggal || nilai === null) {
        invalidRows.push({
          sheet: sheetName,
          row: index + 1,
          tanggal: row[dateColumn],
          kurs: row[rateColumn]
        })
        continue
      }

      observations.push({ tanggal, nilai })
    }
  }

  return {
    observations,
    invalidRows,
    sourceSheets,
    file: path.basename(filePath)
  }
}

function getQuarterEnd(year, quarter) {
  const month = quarter * 3
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

function getQuarterStart(year, quarter) {
  const month = (quarter - 1) * 3
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
}

function isQuarterPartial(group) {
  const start = Date.parse(`${getQuarterStart(group.tahun, group.triwulan)}T00:00:00Z`)
  const end = Date.parse(`${getQuarterEnd(group.tahun, group.triwulan)}T00:00:00Z`)
  const observedStart = Date.parse(`${group.tanggalAwal}T00:00:00Z`)
  const observedEnd = Date.parse(`${group.tanggalAkhir}T00:00:00Z`)
  const gracePeriod = 4 * 24 * 60 * 60 * 1000

  return observedStart - start > gracePeriod || end - observedEnd > gracePeriod
}

function summarizeJisdor(observations) {
  const observationsByDate = new Map()

  for (const observation of observations) {
    if (observationsByDate.has(observation.tanggal)) {
      throw new Error(`Tanggal JISDOR duplikat: ${observation.tanggal}`)
    }
    observationsByDate.set(observation.tanggal, observation.nilai)
  }

  const quarterlyGroups = new Map()

  for (const [tanggal, nilai] of observationsByDate) {
    const year = Number(tanggal.slice(0, 4))
    const quarter = Math.ceil(Number(tanggal.slice(5, 7)) / 3)
    const key = `${year}/Q${quarter}`
    const group = quarterlyGroups.get(key) || {
      tahun: year,
      triwulan: quarter,
      jumlah: 0,
      jumlahObservasi: 0,
      tanggalAwal: tanggal,
      tanggalAkhir: tanggal
    }

    group.jumlah += nilai
    group.jumlahObservasi += 1
    if (tanggal < group.tanggalAwal) group.tanggalAwal = tanggal
    if (tanggal > group.tanggalAkhir) group.tanggalAkhir = tanggal
    quarterlyGroups.set(key, group)
  }

  const quarterly = [...quarterlyGroups.values()]
    .map(group => ({
      periode: `${group.tahun}/Q${group.triwulan}`,
      tahun: group.tahun,
      triwulan: group.triwulan,
      rataRataJisdor: group.jumlah / group.jumlahObservasi,
      jumlahObservasi: group.jumlahObservasi,
      tanggalAwal: group.tanggalAwal,
      tanggalAkhir: group.tanggalAkhir,
      parsial: isQuarterPartial(group)
    }))
    .sort((left, right) =>
      left.tahun - right.tahun || left.triwulan - right.triwulan
    )

  const annualGroups = new Map()
  for (const quarter of quarterly) {
    const group = annualGroups.get(quarter.tahun) || {
      tahun: quarter.tahun,
      jumlah: 0,
      jumlahTriwulan: 0,
      jumlahObservasi: 0,
      triwulanTersedia: [],
      tanggalAwal: quarter.tanggalAwal,
      tanggalAkhir: quarter.tanggalAkhir,
      parsial: false
    }

    group.jumlah += quarter.rataRataJisdor
    group.jumlahTriwulan += 1
    group.jumlahObservasi += quarter.jumlahObservasi
    group.triwulanTersedia.push(`Q${quarter.triwulan}`)
    if (quarter.tanggalAwal < group.tanggalAwal) group.tanggalAwal = quarter.tanggalAwal
    if (quarter.tanggalAkhir > group.tanggalAkhir) group.tanggalAkhir = quarter.tanggalAkhir
    group.parsial ||= quarter.parsial
    annualGroups.set(quarter.tahun, group)
  }

  const annual = [...annualGroups.values()]
    .map(group => ({
      tahun: group.tahun,
      rataRataJisdor: group.jumlah / group.jumlahTriwulan,
      jumlahTriwulan: group.jumlahTriwulan,
      triwulanTersedia: group.triwulanTersedia,
      jumlahObservasi: group.jumlahObservasi,
      tanggalAwal: group.tanggalAwal,
      tanggalAkhir: group.tanggalAkhir,
      parsial: group.parsial || group.jumlahTriwulan < 4
    }))
    .sort((left, right) => left.tahun - right.tahun)

  return { quarterly, annual }
}

module.exports = {
  JISDOR_FILE_PATH,
  parseJisdorDate,
  parseJisdorRate,
  readJisdorData,
  summarizeJisdor
}
