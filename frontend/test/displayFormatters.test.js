import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatDisplayNumber
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