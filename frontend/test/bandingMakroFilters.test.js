import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BANDING_MAKRO_TYPE_OPTIONS,
  buildBandingMakroFilterOptions
} from '../src/utils/bandingMakroFilters.js'

const pivotRows = [
  { sektorAsli: 'GG 2', periode: '2024/Q1', nilai: 0 },
  { sektorAsli: 'GG 2', periode: '2023/Q4', nilai: 2 },
  { sektorAsli: 'NPISHS 2', periode: '2024/Q1', nilai: 3 },
  { sektorAsli: 'HH 2', periode: '2024/Q2', nilai: 4 },
  { sektorAsli: 'TOTAL EKN 2', periode: '2025/Q4', nilai: 5 },
  { sektorAsli: 'FC', periode: '2024/Q1', nilai: 6 },
  { sektorAsli: 'GG 2', periode: '2025/Q1', nilai: null },
  { sektorAsli: 'GG 2', periode: '2025/Q5', nilai: 7 }
]

const bopRows = [
  { periode: '2024/Q2', nilaiTriliunRupiah: -1 },
  { periode: '2023/Q4', nilaiTriliunRupiah: 0 },
  { periode: '2025/Q4', nilaiTriliunRupiah: null }
]

test('exposes only mapped institutions and real, chronologically ordered periods', () => {
  const options = buildBandingMakroFilterOptions({ pivotRows, bopRows })

  assert.deepEqual(options.institutions.map(option => option.value), [
    'pivot:GG 2',
    'pivot:NPISHS 2',
    'pivot:HH 2',
    'pivot:TOTAL EKN 2',
    'bop:ROW'
  ])
  assert.deepEqual(options.periods, [
    '2023/Q4',
    '2024/Q1',
    '2024/Q2',
    '2025/Q4'
  ])
  assert.equal(options.macroTypes.length, 7)
})

test('limits macro types and periods to the selected institution source', () => {
  const options = buildBandingMakroFilterOptions({
    pivotRows,
    bopRows,
    filters: { institutions: ['pivot:GG 2'] }
  })

  assert.deepEqual(options.periods, ['2023/Q4', '2024/Q1'])
  assert.deepEqual(options.macroTypes.map(option => option.value), ['PKP', 'PDB'])
})

test('ROW only maps to BOP and does not expose Pivot indicators', () => {
  const options = buildBandingMakroFilterOptions({
    pivotRows,
    bopRows,
    filters: { institutions: ['bop:ROW'] }
  })

  assert.deepEqual(options.periods, ['2023/Q4', '2024/Q2'])
  assert.deepEqual(options.macroTypes.map(option => option.value), ['PDB', 'BOP'])

  const bopOnly = buildBandingMakroFilterOptions({
    pivotRows,
    bopRows,
    filters: { macroTypes: ['BOP'] }
  })

  assert.deepEqual(bopOnly.institutions.map(option => option.value), ['bop:ROW'])
})

test('keeps PDB selectable while reporting it unavailable without inventing periods', () => {
  const options = buildBandingMakroFilterOptions({
    pivotRows,
    bopRows,
    filters: { macroTypes: ['PDB'] }
  })

  assert.ok(BANDING_MAKRO_TYPE_OPTIONS.some(option => option.value === 'PDB'))
  assert.deepEqual(options.periods, [])
  assert.deepEqual(options.institutions, [])
  assert.equal(options.hasMatchingData, false)
})

test('shows all seven macro types without institution or period context', () => {
  const options = buildBandingMakroFilterOptions({
    pivotRows: [{ sektorAsli: 'GG 2', periode: '2024/Q1', nilai: 1 }]
  })

  assert.deepEqual(
    options.macroTypes.map(option => option.value),
    ['PKP', 'PKLNPRT', 'PKRT', 'NTB ADHB', 'Pajak Neto atas Produk', 'PDB', 'BOP']
  )
})

test('keeps empty combinations empty instead of treating them as zero-valued data', () => {
  const options = buildBandingMakroFilterOptions({
    pivotRows,
    bopRows,
    filters: {
      institutions: ['pivot:HH 2'],
      periods: ['2023/Q4'],
      macroTypes: ['PKRT']
    }
  })

  assert.equal(options.hasMatchingData, false)
})