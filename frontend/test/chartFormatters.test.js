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

test('formats time-series axis in the raw data scale', () => {
  const cases = [
    [1234.5, '1.234,5'],
    [142.0005, '142,0005'],
    [0.000001, '0,000001'],
    [1e-12, '0,000000000001'],
    [1000000, '1.000.000'],
    [1000000000000, '1.000.000.000.000'],
    [-2500000, '-2.500.000'],
    [-0.25, '-0,25'],
    [0, '0'],
    ['bad', '0'],
    [null, '0']
  ]

  for (const [value, expected] of cases) {
    assert.equal(formatTimeSeriesAxis(value), expected)
  }
})