import test from 'node:test'
import assert from 'node:assert/strict'

import {
  serializeCsv
} from '../src/utils/reportExport.js'

test('serializes semicolon CSV without changing decimals or empty values', () => {
  const csv = serializeCsv(
    ['Institusi', 'Nilai', 'Catatan', 'Kosong'],
    [
      [
        'Luar Negeri, ROW',
        1234.56789,
        'Baris; "dengan kutip"\ndan baris kedua',
        ''
      ],
      ['FC', '0,123400', null, undefined]
    ]
  )

  assert.equal(
    csv,
    '\uFEFFInstitusi;Nilai;Catatan;Kosong\r\n' +
      'Luar Negeri, ROW;1234.56789;"Baris; ""dengan kutip""\ndan baris kedua";\r\n' +
      'FC;0,123400;;'
  )
})