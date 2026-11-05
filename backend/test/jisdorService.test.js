const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const {
  JISDOR_FILE_PATH,
  parseJisdorDate,
  parseJisdorRate,
  readJisdorData,
  summarizeJisdor
} = require('../src/services/jisdorService')

test('parses workbook date and Indonesian rate formats', () => {
  assert.equal(parseJisdorDate('5/20/2013 12:00:00 AM'), '2013-05-20')
  assert.equal(parseJisdorDate('2025-01-02'), '2025-01-02')
  assert.equal(parseJisdorDate('2/30/2025'), null)
  assert.equal(parseJisdorRate('9.760,00'), 9760)
  assert.equal(parseJisdorRate('18.148,00'), 18148)
  assert.equal(parseJisdorRate(''), null)
})

test('averages daily values within quarters, then averages available quarter means', () => {
  const result = summarizeJisdor([
    { tanggal: '2024-01-02', nilai: 100 },
    { tanggal: '2024-03-28', nilai: 200 },
    { tanggal: '2024-04-01', nilai: 300 }
  ])

  assert.deepEqual(result.quarterly.map(row => ({
    periode: row.periode,
    jumlahObservasi: row.jumlahObservasi,
    rataRataJisdor: row.rataRataJisdor
  })), [
    { periode: '2024/Q1', jumlahObservasi: 2, rataRataJisdor: 150 },
    { periode: '2024/Q2', jumlahObservasi: 1, rataRataJisdor: 300 }
  ])
  assert.equal(result.annual[0].rataRataJisdor, 225)
  assert.equal(result.annual[0].jumlahTriwulan, 2)
  assert.equal(result.annual[0].jumlahObservasi, 3)
  assert.equal(result.annual[0].parsial, true)
})

test('rejects duplicate JISDOR dates rather than counting them twice', () => {
  assert.throws(() => summarizeJisdor([
    { tanggal: '2025-01-02', nilai: 15000 },
    { tanggal: '2025-01-02', nilai: 16000 }
  ]), /Tanggal JISDOR duplikat/)
})

test('reads the deployed JISDOR workbook relative to the service location', () => {
  const result = readJisdorData()
  const summary = summarizeJisdor(result.observations)

  assert.equal(result.file, 'tabel_kurs.xlsx')
  assert.deepEqual(result.sourceSheets, [{
    nama: 'Informasi Kurs Jisdor',
    kolomTanggal: 'B',
    kolomKurs: 'C'
  }])
  assert.equal(result.observations.length, 3258)
  assert.equal(result.invalidRows.length, 0)
  assert.equal(summary.quarterly.find(row => row.periode === '2024/Q1').jumlahObservasi, 58)
  assert.equal(summary.annual.find(row => row.tahun === 2024).jumlahTriwulan, 4)
  assert.equal(summary.quarterly.find(row => row.periode === '2013/Q1'), undefined)
  assert.equal(summary.annual.find(row => row.tahun === 2004), undefined)
  assert.deepEqual(
    summary.quarterly
      .filter(row => row.tahun === 2014)
      .map(row => row.parsial),
    [false, false, false, false]
  )
  assert.equal(summary.quarterly.find(row => row.periode === '2025/Q2').parsial, true)
  assert.equal(summary.quarterly.find(row => row.periode === '2025/Q2').jumlahObservasi, 51)
  assert.equal(summary.quarterly.find(row => row.periode === '2026/Q4').tanggalAkhir, '2026-11-03')
  assert.equal(summary.annual.find(row => row.tahun === 2026).parsial, true)
  for (const year of [2014, 2025, 2026]) {
    const quarters = summary.quarterly.filter(row => row.tahun === year)
    const annual = summary.annual.find(row => row.tahun === year)
    const equalWeightedMean = quarters.reduce((sum, row) => sum + row.rataRataJisdor, 0) / quarters.length
    assert.ok(Math.abs(annual.rataRataJisdor - equalWeightedMean) < 1e-9)
  }
  assert.ok(Math.abs(
    summary.annual.find(row => row.tahun === 2024).rataRataJisdor -
      15861.189407288113
  ) < 1e-9)
  assert.equal(summary.quarterly.find(row => row.periode === '2026/Q4').jumlahObservasi, 24)
  assert.equal(summary.quarterly.find(row => row.periode === '2026/Q4').parsial, true)
  assert.equal(path.basename(JISDOR_FILE_PATH), 'tabel_kurs.xlsx')
  assert.equal(path.basename(path.dirname(JISDOR_FILE_PATH)), 'raw')
  assert.equal(path.basename(path.dirname(path.dirname(JISDOR_FILE_PATH))), 'data')
})
