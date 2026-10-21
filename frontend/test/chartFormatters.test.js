import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatDatabaseNumber,
  formatTimeSeriesAxis,
  formatTimeSeriesNumber
} from '../src/utils/chartFormatters.js'

test('formats database numbers without rounding decimal digits', () => {
  const cases = [
    [1234.5, '1.234,5'],
    [184.3931, '184,3931'],
    [1000000, '1.000.000'],
    [-2500000.125, '-2.500.000,125'],
    [0, '0'],
    ['bad', 'bad'],
    [null, '0']
  ]

  for (const [value, expected] of cases) {
    assert.equal(formatDatabaseNumber(value), expected)
  }
})

test('formats time-series values without rounding decimal digits', () => {
  const cases = [
    [1234.5, '1.234,5'],
    [184.3931, '184,3931'],
    [1000000, '1.000.000'],
    [-2500000, '-2.500.000'],
    [0, '0'],
    ['bad', '0'],
    [null, '0']
  ]

  for (const [value, expected] of cases) {
    assert.equal(formatTimeSeriesNumber(value), expected)
  }
})

test('formats time-series axis in trillions and preserves invalid fallback', () => {
  const cases = [
    [1234.5, '0,00 T'],
    [1000000, '1,00 T'],
    [-2500000, '-2,50 T'],
    [0, '0,00 T'],
    ['bad', '0,00 T'],
    [null, '0,00 T']
  ]

  for (const [value, expected] of cases) {
    assert.equal(formatTimeSeriesAxis(value), expected)
  }
})