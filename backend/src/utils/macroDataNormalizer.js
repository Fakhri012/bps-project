function normalizeAnnualYear(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= 2100) {
    return value
  }

  if (typeof value === 'string' && /^\d{4}$/.test(value.trim())) {
    const year = Number(value.trim())
    return year >= 1900 && year <= 2100 ? year : null
  }

  return null
}

function parseSourceNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }

  const normalized = value.trim().replace(/\s/g, '')
  let numericText = normalized

  if (normalized.includes('.') && normalized.includes(',')) {
    numericText = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '')
  } else if (/[.,]\d{3}$/.test(normalized)) {
    numericText = normalized.replace(/[.,]/g, '')
  } else {
    numericText = normalized.replace(',', '.')
  }

  const parsed = Number(numericText)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeTransactionMillions(value) {
  const parsed = parseSourceNumber(value)

  if (parsed === null) {
    return null
  }

  // The confirmed Google Sheet convention stores sub-1000 group values as decimals.
  return Number.isInteger(parsed) ? parsed : parsed * 1000
}

function extractAnnualTransactions(rows) {
  const records = new Map()
  const invalidRows = []
  const duplicateYears = []

  for (const [index, row] of rows.entries()) {
    const year = normalizeAnnualYear(row.TAHUN)

    if (year === null) {
      const sourceYear = String(row.TAHUN ?? '').trim()
      if (/^\d{4}\/Q[1-4]$/i.test(sourceYear)) {
        continue
      }

      if (
        sourceYear !== '' ||
        (row.Transaksi !== '' && row.Transaksi !== null && row.Transaksi !== undefined)
      ) {
        invalidRows.push({ row: index + 1, reason: 'Tahun kosong atau tidak valid' })
      }
      continue
    }

    const transaction = normalizeTransactionMillions(row.Transaksi)

    if (transaction === null) {
      invalidRows.push({ row: index + 1, tahun: year, reason: 'Transaksi kosong atau tidak valid' })
      continue
    }

    const existing = records.get(year)

    if (existing && existing.transaksiJutaUSD !== transaction) {
      throw new Error(
        `Tahun ${year} memiliki nilai transaksi berbeda: ` +
        `${existing.transaksiJutaUSD} dan ${transaction} juta USD`
      )
    }

    if (existing) {
      duplicateYears.push(year)
      continue
    }

    records.set(year, {
      tahun: year,
      transaksiAsli: row.Transaksi,
      transaksiJutaUSD: transaction,
      satuanTransaksi: 'Juta USD'
    })
  }

  return {
    records: [...records.values()].sort((left, right) => left.tahun - right.tahun),
    duplicateYears,
    invalidRows
  }
}

function buildBandingMakroData(transactions, rateSummary) {
  const annualRates = new Map(
    rateSummary.annual.map(rate => [rate.tahun, rate])
  )

  return transactions.map(transaction => {
    const rate = annualRates.get(transaction.tahun)

    return {
      ...transaction,
      rataRataJisdor: rate?.rataRataJisdor ?? null,
      jumlahTriwulanKurs: rate?.jumlahTriwulan ?? 0,
      triwulanKursTersedia: rate?.triwulanTersedia ?? [],
      jumlahObservasiKurs: rate?.jumlahObservasi ?? 0,
      cakupanKurs: rate
        ? {
            tanggalAwal: rate.tanggalAwal,
            tanggalAkhir: rate.tanggalAkhir,
            parsial: rate.parsial
          }
        : null,
      nilaiTriliunRupiah: rate
        ? (transaction.transaksiJutaUSD * rate.rataRataJisdor) / 1_000_000
        : null,
      status: rate ? 'valid' : 'kurs_tidak_tersedia'
    }
  })
}

function extractQuarterlyTransactions(rows) {
  const records = new Map()
  const invalidRows = []
  const duplicatePeriods = []

  for (const [index, row] of rows.entries()) {
    const match = String(row.TAHUN ?? '').trim().match(/^(\d{4})\/Q([1-4])$/i)
    if (!match) continue

    const tahun = Number(match[1])
    const triwulan = Number(match[2])
    const transaksiJutaUSD = normalizeTransactionMillions(row.Transaksi)

    if (transaksiJutaUSD === null) {
      invalidRows.push({ row: index + 1, periode: `${tahun}/Q${triwulan}`, reason: 'Transaksi kosong atau tidak valid' })
      continue
    }

    const periode = `${tahun}/Q${triwulan}`
    const existing = records.get(periode)

    if (existing && existing.transaksiJutaUSD !== transaksiJutaUSD) {
      throw new Error(
        `Periode ${periode} memiliki nilai transaksi berbeda: ` +
        `${existing.transaksiJutaUSD} dan ${transaksiJutaUSD} juta USD`
      )
    }

    if (existing) {
      duplicatePeriods.push(periode)
      continue
    }

    records.set(periode, {
      tahun,
      triwulan,
      periode,
      transaksiAsli: row.Transaksi,
      transaksiJutaUSD,
      satuanTransaksi: 'Juta USD'
    })
  }

  return {
    records: [...records.values()].sort((left, right) =>
      left.tahun - right.tahun || left.triwulan - right.triwulan
    ),
    duplicatePeriods,
    invalidRows
  }
}

function buildQuarterlyBandingMakroData(annualTransactions, quarterlyTransactions, rateSummary) {
  const quarterlyRates = new Map(
    rateSummary.quarterly.map(rate => [`${rate.tahun}/Q${rate.triwulan}`, rate])
  )
  const quarterlyValues = new Map(
    quarterlyTransactions.map(transaction => [transaction.periode, transaction])
  )
  const years = new Set([
    ...annualTransactions.map(transaction => transaction.tahun),
    ...quarterlyTransactions.map(transaction => transaction.tahun),
    ...rateSummary.quarterly.map(rate => rate.tahun)
  ])

  return [...years]
    .sort((left, right) => left - right)
    .flatMap(tahun => [1, 2, 3, 4].map(triwulan => {
      const periode = `${tahun}/Q${triwulan}`
      const rate = quarterlyRates.get(periode)
      const transaction = quarterlyValues.get(periode)

      return {
        tahun,
        triwulan,
        periode,
        rataRataJisdor: rate?.rataRataJisdor ?? null,
        jumlahObservasi: rate?.jumlahObservasi ?? null,
        tanggalAwal: rate?.tanggalAwal ?? null,
        tanggalAkhir: rate?.tanggalAkhir ?? null,
        statusKurs: !rate
          ? 'tidak_tersedia'
          : rate.parsial
            ? 'parsial'
            : 'lengkap',
        transaksiJutaUSD: transaction?.transaksiJutaUSD ?? null,
        nilaiTriliunRupiah: rate && transaction
          ? (transaction.transaksiJutaUSD * rate.rataRataJisdor) / 1_000_000
          : null
      }
    }))
}

module.exports = {
  buildBandingMakroData,
  buildQuarterlyBandingMakroData,
  extractAnnualTransactions,
  extractQuarterlyTransactions,
  normalizeAnnualYear,
  normalizeTransactionMillions,
  parseSourceNumber
}
