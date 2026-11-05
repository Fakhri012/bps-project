const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildBandingMakroData,
  buildQuarterlyBandingMakroData,
  extractAnnualTransactions,
  extractQuarterlyTransactions,
  normalizeAnnualYear,
  normalizeTransactionMillions
} = require('../src/utils/macroDataNormalizer')

test('normalizes years and excludes quarterly labels from annual periods', () => {
  assert.equal(normalizeAnnualYear(2025), 2025)
  assert.equal(normalizeAnnualYear('2025'), 2025)
  assert.equal(normalizeAnnualYear('2025/Q1'), null)
  assert.equal(normalizeAnnualYear('not a year'), null)
})

test('normalizes confirmed Google Sheets values into million USD', () => {
  assert.equal(normalizeTransactionMillions(1.563), 1563)
  assert.equal(normalizeTransactionMillions('10,859'), 10859)
  assert.equal(normalizeTransactionMillions(278), 278)
  assert.equal(normalizeTransactionMillions(-1.253), -1253)
  assert.equal(normalizeTransactionMillions(''), null)
})

test('reads annual values only, removes identical duplicates, and rejects conflicts', () => {
  const result = extractAnnualTransactions([
    { TAHUN: '2024', Transaksi: -8.583 },
    { TAHUN: '2024/Q1', Transaksi: -68 },
    { TAHUN: 2024, Transaksi: -8.583 },
    { TAHUN: '2025', Transaksi: -1.253 },
    { TAHUN: '', Transaksi: '' }
  ])

  assert.deepEqual(result.records.map(record => ({
    tahun: record.tahun,
    transaksiJutaUSD: record.transaksiJutaUSD
  })), [
    { tahun: 2024, transaksiJutaUSD: -8583 },
    { tahun: 2025, transaksiJutaUSD: -1253 }
  ])
  assert.deepEqual(result.duplicateYears, [2024])
  assert.throws(() => extractAnnualTransactions([
    { TAHUN: 2024, Transaksi: 10 },
    { TAHUN: '2024', Transaksi: 11 }
  ]), /nilai transaksi berbeda/)
})

test('extracts quarterly transactions without deriving them from annual values', () => {
  const result = extractQuarterlyTransactions([
    { TAHUN: '2024/Q1', Transaksi: -68 },
    { TAHUN: '2024/Q2', Transaksi: -2.889 },
    { TAHUN: '2025/Q1', Transaksi: -3.576 },
    { TAHUN: 2024, Transaksi: -8.583 }
  ])

  assert.deepEqual(result.records.map(record => ({
    periode: record.periode,
    transaksiJutaUSD: record.transaksiJutaUSD
  })), [
    { periode: '2024/Q1', transaksiJutaUSD: -68 },
    { periode: '2024/Q2', transaksiJutaUSD: -2889 },
    { periode: '2025/Q1', transaksiJutaUSD: -3576 }
  ])
})

test('builds four quarterly details with explicit missing, partial, and conversion states', () => {
  const quarterlyRates = [
    ...[1, 2, 3, 4].map(triwulan => ({
      tahun: 2014,
      triwulan,
      rataRataJisdor: 10000 + triwulan * 100,
      jumlahObservasi: 60,
      tanggalAwal: `2014-0${(triwulan - 1) * 3 + 1}-02`,
      tanggalAkhir: `2014-0${triwulan * 3}-28`,
      parsial: false
    })),
    ...[2, 3, 4].map(triwulan => ({
      tahun: 2013,
      triwulan,
      rataRataJisdor: 11000,
      jumlahObservasi: 10,
      tanggalAwal: '2013-05-20',
      tanggalAkhir: '2013-06-28',
      parsial: triwulan === 2
    })),
    ...[1, 2, 3, 4].map(triwulan => ({
      tahun: 2025,
      triwulan,
      rataRataJisdor: 16000,
      jumlahObservasi: triwulan === 2 ? 51 : 60,
      tanggalAwal: triwulan === 2 ? '2025-04-08' : '2025-01-02',
      tanggalAkhir: '2025-12-31',
      parsial: triwulan === 2
    })),
    ...[1, 2, 3, 4].map(triwulan => ({
      tahun: 2026,
      triwulan,
      rataRataJisdor: 17000,
      jumlahObservasi: triwulan === 4 ? 24 : 60,
      tanggalAwal: triwulan === 4 ? '2026-10-01' : '2026-01-02',
      tanggalAkhir: triwulan === 4 ? '2026-11-03' : '2026-09-30',
      parsial: triwulan === 4
    })),
    ...[1, 2, 3, 4].map(triwulan => ({
      tahun: 2024,
      triwulan,
      rataRataJisdor: 15600,
      jumlahObservasi: 60,
      tanggalAwal: '2024-01-02',
      tanggalAkhir: '2024-12-31',
      parsial: false
    }))
  ]
  const quarterlyTransactions = extractQuarterlyTransactions([
    { TAHUN: '2024/Q1', Transaksi: -68 },
    { TAHUN: '2026/Q2', Transaksi: -12.487 }
  ])
  const details = buildQuarterlyBandingMakroData(
    [{ tahun: 2004 }, { tahun: 2013 }, { tahun: 2014 }, { tahun: 2024 }, { tahun: 2025 }, { tahun: 2026 }],
    quarterlyTransactions.records,
    { quarterly: quarterlyRates }
  )
  const findQuarter = (tahun, triwulan) =>
    details.find(row => row.tahun === tahun && row.triwulan === triwulan)

  assert.deepEqual([1, 2, 3, 4].map(triwulan => findQuarter(2014, triwulan).statusKurs), [
    'lengkap', 'lengkap', 'lengkap', 'lengkap'
  ])
  assert.equal(findQuarter(2013, 1).statusKurs, 'tidak_tersedia')
  assert.equal(findQuarter(2013, 1).jumlahObservasi, null)
  assert.equal(findQuarter(2004, 4).statusKurs, 'tidak_tersedia')
  assert.equal(findQuarter(2025, 2).statusKurs, 'parsial')
  assert.equal(findQuarter(2025, 2).jumlahObservasi, 51)
  assert.equal(findQuarter(2026, 4).statusKurs, 'parsial')
  assert.equal(findQuarter(2026, 4).tanggalAkhir, '2026-11-03')
  assert.equal(findQuarter(2024, 1).transaksiJutaUSD, -68)
  assert.equal(findQuarter(2024, 1).nilaiTriliunRupiah, (-68 * 15600) / 1_000_000)
  assert.equal(findQuarter(2024, 2).transaksiJutaUSD, null)
  assert.equal(findQuarter(2024, 2).nilaiTriliunRupiah, null)
  assert.equal(findQuarter(2026, 2).transaksiJutaUSD, -12487)
})

test('converts only when an annual JISDOR average is available', () => {
  const result = buildBandingMakroData([
    { tahun: 2025, transaksiJutaUSD: -1253, satuanTransaksi: 'Juta USD' },
    { tahun: 2004, transaksiJutaUSD: 1563, satuanTransaksi: 'Juta USD' }
  ], {
    annual: [{
      tahun: 2025,
      rataRataJisdor: 16476.24,
      jumlahTriwulan: 4,
      triwulanTersedia: ['Q1', 'Q2', 'Q3', 'Q4'],
      jumlahObservasi: 237,
      tanggalAwal: '2025-01-02',
      tanggalAkhir: '2025-12-31',
      parsial: false
    }]
  })

  assert.equal(result[0].nilaiTriliunRupiah, (-1253 * 16476.24) / 1_000_000)
  assert.equal(result[0].jumlahTriwulanKurs, 4)
  assert.equal(result[1].nilaiTriliunRupiah, null)
  assert.equal(result[1].status, 'kurs_tidak_tersedia')
})
