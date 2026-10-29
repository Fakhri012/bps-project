import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRatioCsvExportData,
  buildRatioChartRows,
  canExportRatioCsv,
  filterRatioData,
  getRatioTypesForSectors,
  normalizeRatioSektor,
  numericRatioValue
} from '../src/utils/ratioAnalysis.js'

const rows = [
  {
    SEKTOR: 'ROW 2',
    TAHUN: '2016/Q1',
    'JENIS RASIO': 'CAB/GDP',
    NILAI: '0,0210'
  },
  {
    SEKTOR: 'ROW 2',
    TAHUN: '2016/Q2',
    'JENIS RASIO': 'CAB/GDP',
    NILAI: '0,0239'
  },
  {
    SEKTOR: 'ROW 2',
    TAHUN: '2016/Q1',
    'JENIS RASIO': 'CAB/GDP',
    NILAI: '0,0210'
  },
  {
    SEKTOR: 'FC 2',
    TAHUN: '2016/Q1',
    'JENIS RASIO': 'COE/VA',
    NILAI: '0,5'
  },
  {
    SEKTOR: 'FC 2',
    TAHUN: '2016',
    'JENIS RASIO': 'COE/VA',
    NILAI: '0,4'
  }
]

test('normalizes ROW, ROW2, and ROW 2 to the same sector', () => {
  assert.equal(normalizeRatioSektor('ROW'), 'ROW')
  assert.equal(normalizeRatioSektor('ROW2'), 'ROW')
  assert.equal(normalizeRatioSektor('ROW 2'), 'ROW')
})

test('makes ROW 2 ratios available through the ROW sector filter', () => {
  assert.deepEqual(getRatioTypesForSectors(rows, ['ROW']), ['CAB/GDP'])
  assert.deepEqual(getRatioTypesForSectors(rows, ['ROW2']), ['CAB/GDP'])
  assert.deepEqual(getRatioTypesForSectors(rows, ['ROW 2']), ['CAB/GDP'])
  assert.deepEqual(getRatioTypesForSectors(rows, ['FC']), ['COE/VA'])
})

test('filters CAB/GDP to its sector and exact annual or quarterly periods', () => {
  assert.deepEqual(
    filterRatioData(rows, {
      sectors: ['ROW'],
      periods: ['2016/Q2'],
      ratios: ['CAB/GDP']
    }),
    [rows[1]]
  )

  assert.deepEqual(
    filterRatioData(rows, {
      sectors: ['FC'],
      periods: ['2016'],
      ratios: ['COE/VA']
    }),
    [rows[4]]
  )
})

test('builds a separate CAB/GDP quarterly series without summing duplicate periods', () => {
  const chart = buildRatioChartRows(rows, 'CAB/GDP')

  assert.deepEqual(chart.sectors, ['ROW'])
  assert.deepEqual(chart.rows, [
    { periode: '2016/Q1', ROW: 0.021, _ROWCanonical: false },
    { periode: '2016/Q2', ROW: 0.0239, _ROWCanonical: false }
  ])
  assert.equal(numericRatioValue('0,0210'), 0.021)
})

test('keeps existing ratios available for their own sector and returns empty chart data', () => {
  assert.deepEqual(getRatioTypesForSectors(rows, ['FC']), ['COE/VA'])
  assert.deepEqual(filterRatioData([], { sectors: ['ROW2'] }), [])
  assert.deepEqual(buildRatioChartRows([], 'CAB/GDP'), {
    rows: [],
    sectors: []
  })
})

test('allows ratio CSV only when a sector is selected and table rows exist', () => {
  assert.equal(canExportRatioCsv({ sectors: [], rowCount: 3 }), false)
  assert.equal(canExportRatioCsv({ sectors: ['FC'], rowCount: 0 }), false)
  assert.equal(canExportRatioCsv({ loading: true, sectors: ['FC'], rowCount: 3 }), false)
  assert.equal(canExportRatioCsv({ sectors: ['FC'], rowCount: 3 }), true)
})

test('builds ratio CSV rows from the sorted table projection without rounding', () => {
  const tableRows = [
    {
      periode: '2019',
      sektor: 'FC',
      values: { 'COE/VA': 0.123456, 'PMTB/DI': null }
    },
    {
      periode: '2020/Q1',
      sektor: 'ROW',
      values: { 'COE/VA': '0,02340', 'PMTB/DI': 0.0000123 }
    }
  ]

  assert.deepEqual(
    buildRatioCsvExportData(tableRows, ['COE/VA', 'PMTB/DI']),
    {
      headers: ['Periode', 'Sektor', 'COE/VA', 'PMTB/DI'],
      rows: [
        ['2019', 'FC', 0.123456, ''],
        ['2020/Q1', 'ROW', '0,02340', 0.0000123]
      ]
    }
  )
})
