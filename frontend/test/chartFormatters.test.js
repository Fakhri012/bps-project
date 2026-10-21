import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatFixedTwoDecimals,
  formatTimeSeriesAxis,
  formatTimeSeriesNumber
} from '../src/utils/chartFormatters.js'

test('formats fixed-two-decimal chart values', () => {
  const cases = [
    [1234.5, '1.234,50'],
    [1000000, '1.000.000,00'],
    [-2500000, '-2.500.000,00'],
    [0, '0,00'],
    ['bad', '0,00'],
    [null, '0,00']
  ]

  for (const [value, expected] of cases) {
    assert.equal(formatFixedTwoDecimals(value), expected)
  }
})

test('formats time-series values with at most two decimals', () => {
  const cases = [
    [1234.5, '1.234,5'],
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