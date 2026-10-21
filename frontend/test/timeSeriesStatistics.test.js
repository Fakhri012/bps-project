import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSectorClassificationComparisons
} from '../src/utils/timeSeriesStatistics.js'

test('builds one isolated annual classification comparison for each sector', () => {
  const result = buildSectorClassificationComparisons(
    [
      { sektor: 'FC', klasifikasi: 'X', tahun: 2020, nilai: 10 },
      { sektor: 'FC', klasifikasi: 'Y', tahun: 2020, nilai: 20 },
      { sektor: 'NFC', klasifikasi: 'X', tahun: 2020, nilai: 30 },
      { sektor: 'NFC', klasifikasi: 'Y', tahun: 2020, nilai: 40 },
      { sektor: 'HH', klasifikasi: 'X', tahun: 2020, nilai: 50 },
      { sektor: 'HH', klasifikasi: 'Y', tahun: 2020, nilai: 60 }
    ],
    'annual',
    ['FC', 'NFC', 'HH'],
    ['X', 'Y']
  )

  assert.equal(result.length, 3)
  assert.deepEqual(
    result.map(panel => [
      panel.sektor,
      panel.periods,
      panel.series.map(series => [series.name, series.data])
    ]),
    [
      ['FC', ['2020'], [['X', [10]], ['Y', [20]]]],
      ['NFC', ['2020'], [['X', [30]], ['Y', [40]]]],
      ['HH', ['2020'], [['X', [50]], ['Y', [60]]]]
    ]
  )
})

test('orders quarterly periods and keeps missing classifications empty', () => {
  const result = buildSectorClassificationComparisons(
    [
      { sektor: 'FC', klasifikasi: 'X', tahun: 2022, triwulan: 2, nilai: 14 },
      { sektor: 'FC', klasifikasi: 'X', tahun: 2021, triwulan: 4, nilai: 12 },
      { sektor: 'FC', klasifikasi: 'Y', tahun: 2022, triwulan: 2, nilai: 28 }
    ],
    'quarterly',
    ['FC'],
    ['X', 'Y']
  )

  assert.deepEqual(result[0], {
    key: 'fc',
    sektor: 'FC',
    periods: ['2021 Q4', '2022 Q2'],
    series: [
      { name: 'X', data: [12, 14] },
      { name: 'Y', data: [null, 28] }
    ],
    hasData: true
  })
})

test('keeps selected sectors visible with an empty state when data is missing', () => {
  const result = buildSectorClassificationComparisons(
    [],
    'annual',
    ['FC'],
    ['X']
  )

  assert.deepEqual(result, [
    {
      key: 'fc',
      sektor: 'FC',
      periods: [],
      series: [{ name: 'X', data: [] }],
      hasData: false
    }
  ])
})

test('treats an empty sector filter as all sectors', () => {
  const result = buildSectorClassificationComparisons(
    [
      { sektor: 'NFC', klasifikasi: 'X', tahun: 2020, nilai: 20 },
      { sektor: 'FC', klasifikasi: 'X', tahun: 2020, nilai: 10 }
    ],
    'annual'
  )

  assert.deepEqual(
    result.map(panel => panel.sektor),
    ['NFC', 'FC']
  )
})
