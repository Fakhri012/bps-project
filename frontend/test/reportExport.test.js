import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

import {
  buildExcelWorksheet,
  serializeCsv
} from '../src/utils/reportExport.js'
import { formatTimeSeriesNumber } from '../src/utils/chartFormatters.js'

const require = createRequire(import.meta.url)
const dashboardMapper = require('../../backend/src/mappers/dashboardMapper')

test('serializes semicolon CSV with UTF-8 BOM and preserves nonnumeric fields', () => {
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
    '\uFEFFsep=;\r\n' +
      'Institusi;Nilai;Catatan;Kosong\r\n' +
      'Luar Negeri, ROW;1234.56789;"Baris; ""dengan kutip""\ndan baris kedua";\r\n' +
      'FC;0,123400;;'
  )
})

test('normalizes only numeric CSV columns to ungrouped dot decimals', () => {
  const csv = serializeCsv(
    ['Tahun', 'Nilai', 'Kode'],
    [
      ['2024', '993381.06', 'A,1'],
      ['2025', '4633,8580', '1.000,0'],
      ['2026', '1.000,0', '993.381,06'],
      ['2027', '1000.0', 'A,4'],
      ['2028', '1979.847', 'A,5']
    ],
    { numericColumns: [1] }
  )

  assert.equal(
    csv,
    '\uFEFFsep=;\r\n' +
      'Tahun;Nilai;Kode\r\n' +
      '2024;993381.06;A,1\r\n' +
      '2025;4633.8580;1.000,0\r\n' +
      '2026;1000.0;993.381,06\r\n' +
      '2027;1000.0;A,4\r\n' +
      '2028;1979.847;A,5'
  )
})

test('preserves all raw decimal digits through CSV serialization', () => {
  const rawValues = [
    993381.067845,
    '4633.85801234',
    1000.000567,
    '1979.84712345'
  ]
  const csv = serializeCsv(
    ['Periode', 'Nilai'],
    rawValues.map((value, index) => [2024 + index, value]),
    { numericColumns: [1] }
  )
  const exportedValues = csv
    .split('\r\n')
    .slice(2)
    .map(row => row.split(';')[1])

  assert.deepEqual(exportedValues, rawValues.map(String))
  assert.deepEqual(
    exportedValues.map(Number),
    rawValues.map(Number)
  )
})

test('exports the Time Series tooltip value with the same numeric value', () => {
  const rawValue = 6734.5002
  const csv = serializeCsv(
    ['Nilai'],
    [[rawValue]],
    { numericColumns: [0] }
  )
  const csvValue = csv.split('\r\n').at(-1)

  assert.equal(formatTimeSeriesNumber(rawValue), '6.734,5002')
  assert.equal(csvValue, '6734.5002')
  assert.equal(Number(csvValue), rawValue)
})

test('preserves backend summary precision through the frontend CSV boundary', () => {
  const sourceValues = [
    ['FC', '993381.067845'],
    ['NFC', '4633.85801234'],
    ['GG', '1000.000567'],
    ['HH', '1979.84712345']
  ]
  const mappedRows = dashboardMapper.mapTahunanData(
    sourceValues.map(([sector, value], index) => ({
      SEKTOR: sector,
      TAHUN: String(2024 + index),
      SISI: 'PENGGUNAAN',
      'JENIS NERACA': 'Neraca',
      KODE: `K${index + 1}`,
      RINCIAN: 'Penggunaan',
      'NERACA - RINCIAN': 'Neraca',
      NILAI: value
    }))
  )
  const backendSummary = dashboardMapper.generateTahunanSummary(mappedRows, {})
  const frontendRows = backendSummary.institusi.map(item => [
    item.kode,
    item.nilai
  ])
  const csv = serializeCsv(
    ['Kode Institusi', 'Nilai'],
    frontendRows,
    { numericColumns: [1] }
  )
  const exportedByCode = new Map(
    csv
      .split('\r\n')
      .slice(2)
      .map(row => row.split(';'))
      .map(([code, value]) => [code, value])
  )

  for (const [code, rawValue] of sourceValues) {
    const backendValue = backendSummary.institusi
      .find(item => item.kode === code)
      .nilai
    const frontendValue = frontendRows
      .find(([rowCode]) => rowCode === code)[1]
    const csvValue = exportedByCode.get(code)

    assert.equal(backendValue, Number(rawValue))
    assert.equal(frontendValue, backendValue)
    assert.equal(Number(csvValue), backendValue)
    assert.equal(csvValue, String(backendValue))
  }
})

test('builds XLSX numeric cells with source precision and adequate column widths', async () => {
  const worksheet = await buildExcelWorksheet(
    ['Label', 'Nilai'],
    [
      ['a', '993381.06'],
      ['b', '4633.8580'],
      ['c', '1000.0'],
      ['d', '1979.847']
    ],
    { numericColumns: [1] }
  )

  assert.deepEqual(
    ['B2', 'B3', 'B4', 'B5'].map(address => worksheet.getCell(address).value),
    [993381.06, 4633.858, 1000, 1979.847]
  )
  assert.equal(worksheet.getCell('B3').numFmt, '[$-421]0.0000')
  assert.ok(worksheet.getColumn(2).width >= 14)
  assert.equal(worksheet.views[0].state, 'frozen')
  assert.equal(worksheet.views[0].showGridLines, false)
  assert.equal(worksheet.getCell('A1').font.bold, true)
  assert.equal(worksheet.getCell('A1').font.color.argb, 'FFFFFFFF')
  assert.equal(worksheet.getCell('A2').fill.fgColor.argb, 'FFF1F7F6')
  assert.equal(worksheet.getCell('A3').fill.fgColor.argb, 'FFFFFFFF')
  assert.equal(worksheet.getCell('B2').alignment.horizontal, 'right')
  assert.ok(worksheet.getTable('DashboardExport'))

  const XLSX = await import('@e965/xlsx')
  const file = await worksheet.workbook.xlsx.writeBuffer()
  const ExcelJSModule = await import('exceljs')
  const ExcelJS = ExcelJSModule.default ?? ExcelJSModule
  const reopenedWorkbook = new ExcelJS.Workbook()
  await reopenedWorkbook.xlsx.load(file)
  const reopenedStyledSheet = reopenedWorkbook.getWorksheet('Data')

  assert.equal(reopenedStyledSheet.getCell('A1').font.bold, true)
  assert.equal(reopenedStyledSheet.getCell('A1').fill.fgColor.argb, 'FF0B5D58')
  assert.equal(reopenedStyledSheet.views[0].state, 'frozen')

  const reopened = XLSX.read(file, {
    type: 'buffer',
    cellNF: true
  }).Sheets.Data

  assert.deepEqual(
    ['B2', 'B3', 'B4', 'B5'].map(address => reopened[address].t),
    ['n', 'n', 'n', 'n']
  )
  assert.deepEqual(
    ['B2', 'B3', 'B4', 'B5'].map(address => reopened[address].v),
    [993381.06, 4633.858, 1000, 1979.847]
  )
  assert.equal(reopened.B3.z, '[$-421]0.0000')
})