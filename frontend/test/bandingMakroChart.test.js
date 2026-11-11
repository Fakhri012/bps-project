import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BANDING_MAKRO_MAIN_SERIES,
  buildBandingMakroChartData
} from '../src/utils/bandingMakroChart.js'

test('keeps the existing transaction years and main series when no sector is selected', () => {
  const rows = [
    { tahun: 2022, nilaiTriliunRupiah: -1 },
    { tahun: 2023, nilaiTriliunRupiah: 0 }
  ]

  assert.deepEqual(
    buildBandingMakroChartData(rows, [], []),
    {
      years: ['2022', '2023'],
      series: [{
        name: BANDING_MAKRO_MAIN_SERIES,
        values: [-1, 0]
      }]
    }
  )
})

test('aligns multiple sectors by year and keeps missing or incompatible values null', () => {
  const result = buildBandingMakroChartData(
    [
      { tahun: 2022, nilaiTriliunRupiah: 12 },
      { tahun: 2024, nilaiTriliunRupiah: 14 }
    ],
    [
      { tahun: 2022, sektor: 'FC', indikator: 'Transaksi Berjalan', nilai: 3, satuan: 'Triliun Rupiah' },
      { tahun: 2023, sektor: 'FC', indikator: 'Transaksi Berjalan', nilai: 4, satuan: 'Triliun Rupiah' },
      { tahun: 2022, sektor: 'NFC', indikator: 'Transaksi Berjalan', nilai: 7, satuan: 'Miliar Rupiah' },
      { tahun: 2022, sektor: 'HH', indikator: 'Indikator lain', nilai: 8, satuan: 'Triliun Rupiah' }
    ],
    ['FC', 'NFC', 'HH']
  )

  assert.deepEqual(result.years, ['2022', '2023', '2024'])
  assert.deepEqual(result.series, [
    {
      name: BANDING_MAKRO_MAIN_SERIES,
      values: [12, null, 14]
    },
    { name: 'FC', values: [3, 4, null] },
    { name: 'NFC', values: [null, null, null] },
    { name: 'HH', values: [null, null, null] }
  ])
})

test('marks duplicate sector values for a year as unavailable instead of choosing one', () => {
  const result = buildBandingMakroChartData([], [
    { tahun: 2023, sektor: 'FC', indikator: 'Transaksi Berjalan', nilai: 3, satuan: 'Triliun Rupiah' },
    { tahun: 2023, sektor: 'FC', indikator: 'Transaksi Berjalan', nilai: 4, satuan: 'Triliun Rupiah' }
  ], ['FC'])

  assert.deepEqual(result.series[1].values, [null])
})
