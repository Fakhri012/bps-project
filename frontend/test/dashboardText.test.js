import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatNeracaOptionLabel,
  prioritizeSectorOptions
} from '../src/utils/dashboardText.js'

test('formats selected balance sheet labels without changing other options', () => {
  const cases = [
    ['Opening', 'Balance Sheet (Opening)'],
    ['Closing', 'Balance Sheet (Closing)'],
    [
      'Total Perubahan Aset/Kewajiban',
      'Balance Sheet (Total Perubahan Aset/Kewajiban)'
    ],
    ['opening', 'Balance Sheet (Opening)'],
    ['Neraca Finansial', 'Neraca Finansial']
  ]

  for (const [value, expected] of cases) {
    assert.equal(formatNeracaOptionLabel(value), expected)
  }
})

test('prioritizes selected sectors and keeps the remaining source order', () => {
  const options = [
    'HH',
    'FC',
    'NFC',
    'NPISHS',
    'ODC',
    'CB',
    'GG'
  ]

  assert.deepEqual(
    prioritizeSectorOptions(options),
    ['NFC', 'FC', 'CB', 'ODC', 'HH', 'NPISHS', 'GG']
  )
})