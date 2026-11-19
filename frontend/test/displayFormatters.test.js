import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatDisplayNumber,
  formatNullableDecimal,
  setExportNumberFormat
} from '../src/utils/displayFormatters.js'

test('formats display numbers in Indonesian locale with at most two decimals', () => {
  const cases = [
    [184.393066, '184,39'],
    [25.5, '25,5'],
    [100, '100'],
    [0.4567, '0,46'],
    [1234.5, '1.234,5'],
    [0, '0'],
    [-1.236, '-1,24'],
    [0.00001, '0'],
    ['bad', 'bad'],
    [null, '0']
  ]

  for (const [value, expected] of cases) {
    assert.equal(formatDisplayNumber(value), expected)
  }
})

test('disables grouping only while formatting numbers for PDF export', () => {
  setExportNumberFormat(true)
  try {
    assert.equal(formatDisplayNumber(1234.5), '1234,5')
  } finally {
    setExportNumberFormat(false)
  }

  assert.equal(formatDisplayNumber(1234.5), '1.234,5')
})

test('formats nullable decimals without losing precision or turning NULL into zero', () => {
  const cases = [
    [null, '-'],
    ['', '-'],
    ['0', '0'],
    ['150000', '150.000'],
    ['0.0210', '0,0210'],
    ['-150.25', '-150,25'],
    ['1.234,56', '1.234,56'],
    ['184,39306605199400', '184,39306605199400']
  ]

  for (const [value, expected] of cases) {
    assert.equal(formatNullableDecimal(value), expected)
  }
})