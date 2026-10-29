import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRatioChartRows,
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

test('keeps ROW and ROW2 separate while normalizing the sheet label ROW 2', () => {
  assert.equal(normalizeRatioSektor('ROW'), 'ROW')
  assert.equal(normalizeRatioSektor('ROW2'), 'ROW2')
  assert.equal(normalizeRatioSektor('ROW 2'), 'ROW2')
})

test('makes CAB/GDP available only when selected sectors contain ROW2', () => {
  assert.deepEqual(getRatioTypesForSectors(rows, ['ROW2']), ['CAB/GDP'])
  assert.deepEqual(getRatioTypesForSectors(rows, ['ROW 2']), ['CAB/GDP'])
  assert.deepEqual(getRatioTypesForSectors(rows, ['FC']), ['COE/VA'])
})

test('filters CAB/GDP to its sector and exact annual or quarterly periods', () => {
  assert.deepEqual(
    filterRatioData(rows, {
      sectors: ['ROW2'],
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

  assert.deepEqual(chart.sectors, ['ROW2'])
  assert.deepEqual(chart.rows, [
    { periode: '2016/Q1', ROW2: 0.021, _ROW2Canonical: false },
    { periode: '2016/Q2', ROW2: 0.0239, _ROW2Canonical: false }
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
