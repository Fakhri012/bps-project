'use strict'

const ExcelJS = require('exceljs')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const test = require('node:test')
const assert = require('node:assert/strict')

const controllerPath = require.resolve('../src/controllers/dataImportController')
const poolPath = require.resolve('../src/config/postgres')

const characteristicHeaders = [
  'SEKTOR', 'TAHUN', 'SISI', 'JENIS NERACA', 'KODE',
  'RINCIAN', 'NERACA - RINCIAN', 'STATUS NILAI', 'NILAI', 'KONSEP'
]
const ratioHeaders = [
  'SEKTOR', 'TAHUN', 'JENIS RASIO', 'KODE', 'RINCIAN', 'NILAI'
]

function moduleWithExports(filename, exports) {
  const mockedModule = new Module(filename)
  mockedModule.filename = filename
  mockedModule.loaded = true
  mockedModule.exports = exports
  return mockedModule
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    send(body) { this.body = body; return this }
  }
}

async function withMockedController(pool, callback) {
  const previousPool = require.cache[poolPath]
  const previousController = require.cache[controllerPath]
  require.cache[poolPath] = moduleWithExports(poolPath, pool)
  delete require.cache[controllerPath]
  try {
    await callback(require(controllerPath))
  } finally {
    if (previousController) require.cache[controllerPath] = previousController
    else delete require.cache[controllerPath]
    if (previousPool) require.cache[poolPath] = previousPool
    else delete require.cache[poolPath]
  }
}

function createPreviewPool({
  duplicateKeys = false,
  sectors = [{ id: 1, sector_id: 1, code: 'CB', name: 'CB', source_code: 'CB' }]
} = {}) {
  const stagedRows = []
  const calls = []
  const callsWithParams = []
  const client = {
    async query(sql, params = []) {
      const statement = String(sql).replace(/\s+/g, ' ').trim()
      calls.push(statement)
      callsWithParams.push({ statement, params })
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)) return { rowCount: 0, rows: [] }
      if (statement.includes('FROM sectors s')) {
        return { rowCount: sectors.length, rows: sectors }
      }
      if (statement.includes('has_history')) {
        return { rowCount: 1, rows: [{ has_history: false, base_version_id: null, base_version_activated_at: null }] }
      }
      if (statement.startsWith('INSERT INTO data_import_batches')) {
        return { rowCount: 1, rows: [{ id: 501 }] }
      }
      if (statement.startsWith('INSERT INTO staging_excel_rows')) {
        for (let index = 0; index < params.length; index += 7) {
          stagedRows.push({
            id: stagedRows.length + 1,
            raw_data: JSON.parse(params[index + 3]),
            normalized_data: JSON.parse(params[index + 4]),
            validation_status: params[index + 5],
            validation_errors: JSON.parse(params[index + 6])
          })
        }
        return { rowCount: params.length / 7, rows: [] }
      }
      if (statement.includes('WITH keyed_rows AS')) {
        const occurrences = new Map()
        for (const row of stagedRows) {
          const key = JSON.stringify(row.normalized_data.business_key)
          occurrences.set(key, (occurrences.get(key) || 0) + 1)
        }
        let updated = 0
        for (const row of stagedRows) {
          const key = JSON.stringify(row.normalized_data.business_key)
          if (duplicateKeys && occurrences.get(key) > 1) {
            row.validation_status = 'invalid'
            row.validation_errors.push('Business key duplikat; periksa sektor, periode, dan rincian record.')
            updated++
          }
        }
        return { rowCount: updated, rows: [] }
      }
      if (statement.includes("COUNT(*) FILTER (WHERE validation_status = 'valid')")) {
        return {
          rowCount: 1,
          rows: [{
            total: stagedRows.length,
            valid: stagedRows.filter(row => row.validation_status === 'valid').length,
            warning: stagedRows.filter(row => row.validation_status === 'warning').length,
            invalid: stagedRows.filter(row => row.validation_status === 'invalid').length
          }]
        }
      }
      if (statement.startsWith('UPDATE data_import_batches') && statement.includes('RETURNING preview_expires_at')) {
        return { rowCount: 1, rows: [{ preview_expires_at: new Date(Date.now() + 60000).toISOString() }] }
      }
      return { rowCount: 1, rows: [] }
    },
    release() {}
  }
  return { client, calls, callsWithParams, stagedRows, pool: { connect: async () => client } }
}

async function createWorkbookFile(worksheetName, headers, rows, { formattedMaxRow = false, additionalSheets = [] } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bps-import-test-'))
  const filePath = path.join(directory, 'fixture.xlsx')
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(worksheetName)
  worksheet.addRow(['TEMPLATE INPUT DATA'])
  worksheet.addRow(['Petunjuk pengisian'])
  worksheet.addRow(headers)
  rows.forEach(row => worksheet.addRow(row))
  if (formattedMaxRow) worksheet.getRow(1048576).getCell(1).numFmt = '0'
  for (const sheet of additionalSheets) {
    const additionalWorksheet = workbook.addWorksheet(sheet.name)
    sheet.rows.forEach(row => additionalWorksheet.addRow(row))
  }
  await workbook.xlsx.writeFile(filePath)
  return { directory, filePath }
}

async function previewWorkbook(dataset, year, quarter, headers, rows, options = {}) {
  const worksheetName = dataset === 'analisis_rasio'
    ? 'RASIO'
    : dataset === 'tahunan' ? 'TAHUNAN' : 'TRIWULANAN'
  const {
    worksheetOptions = {},
    sheetName = worksheetName,
    periodKey,
    groupId,
    ...poolOptions
  } = options
  const fixture = createPreviewPool(poolOptions)
  const file = await createWorkbookFile(sheetName, headers, rows, worksheetOptions)
  try {
    let result
    await withMockedController(fixture.pool, async controller => {
      const response = responseRecorder()
      await controller.previewAnnualUpload({
        query: {
          dataset,
          tahun: String(year),
          quarter: quarter === null ? undefined : String(quarter),
          sheet_name: sheetName,
          period_key: periodKey,
          workbook_group_id: groupId
        },
        file: { path: file.filePath, originalname: 'fixture.xlsx', size: 1024 }
      }, response)
      result = response
    })
    return { ...fixture, result }
  } finally {
    await fs.rm(file.directory, { recursive: true, force: true })
  }
}

async function detectWorkbook(sheets) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bps-detect-test-'))
  const filePath = path.join(directory, 'multi-sheet.xlsx')
  const workbook = new ExcelJS.Workbook()
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name)
    if (sheet.headers) {
      worksheet.addRow(['TEMPLATE INPUT DATA'])
      worksheet.addRow(['Petunjuk'])
      worksheet.addRow(sheet.headers)
      for (const row of sheet.rows || []) worksheet.addRow(row)
    } else {
      for (const row of sheet.rows || []) worksheet.addRow(row)
    }
  }
  await workbook.xlsx.writeFile(filePath)

  try {
    let response
    await withMockedController({}, async controller => {
      response = responseRecorder()
      await controller.detectWorkbookSheets({
        file: { path: filePath, originalname: 'multi-sheet.xlsx' }
      }, response)
    })
    return response
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
}

test('quarterly characteristic preview accepts the official ten-column sheet with header on row three', async () => {
  const result = await previewWorkbook(
    'triwulanan_1', 2025, 4, characteristicHeaders,
    [['CB', '2025/Q4', 'ASET', 'NERACA', 'P6', 'Investasi', 'Neraca investasi', 'INPUT', '175000', 'A']]
  )

  assert.equal(result.result.statusCode, 200)
  assert.equal(result.result.body.preview.period_type, 'quarterly')
  assert.equal(result.result.body.preview.quarter, 4)
  assert.equal(result.stagedRows[0].normalized_data.period, '2025/Q4')
  assert.equal(result.stagedRows[0].normalized_data.business_key.length, 10)
  assert.equal(result.stagedRows[0].raw_data.TRIWULAN, undefined)
})

test('selected transaction worksheet is parsed while MASTER DATA is ignored', async () => {
  const result = await previewWorkbook(
    'triwulanan_2', 2025, 3, characteristicHeaders,
    [['CB', '2025', 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Kas', 'Neraca Kas', 'INPUT', '0', 'A']],
    { worksheetOptions: { additionalSheets: [{ name: 'MASTER DATA', rows: [['SEKTOR'], ['SHOULD NOT IMPORT']] }] } }
  )

  assert.equal(result.result.statusCode, 200)
  assert.equal(result.result.body.preview.total_rows, 1)
  assert.equal(result.stagedRows.length, 1)
  assert.equal(result.stagedRows[0].normalized_data.period, '2025/Q3')
})

test('one multi-period workbook group creates a child preview per period and stages only matching rows', async () => {
  const groupId = 'c0ffee00-0000-4000-8000-000000000001'
  const result = await previewWorkbook(
    'tahunan', 2024, null, characteristicHeaders,
    [
      ['FC', '2024', 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Kas', 'Neraca Kas', 'INPUT', '10', 'A'],
      ['FC', '2025', 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Kas', 'Neraca Kas', 'INPUT', '11', 'A']
    ],
    { sheetName: 'TAHUNAN', periodKey: '2024', groupId }
  )

  assert.equal(result.result.statusCode, 200)
  assert.equal(result.result.body.preview.total_rows, 1)
  assert.equal(result.stagedRows.length, 1)
  assert.equal(result.stagedRows[0].normalized_data.year, 2024)
  assert.ok(result.calls.some(statement => statement.includes('workbook_group_id')))
  const batchInsert = result.callsWithParams.find(query => query.statement.startsWith('INSERT INTO data_import_batches'))
  assert.equal(batchInsert.params[4], groupId)
  const stagingInsert = result.callsWithParams.find(query => query.statement.startsWith('INSERT INTO staging_excel_rows'))
  assert.equal(stagingInsert.params[1], 'TAHUNAN')
})

test('workbook detection maps annual, ratio aliases, ambiguous quarterly, master, empty, and unknown sheets', async () => {
  const response = await detectWorkbook([
    {
      name: 'TAHUNAN', headers: characteristicHeaders,
      rows: [
        ['FC', '2024', 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Kas', 'Neraca Kas', 'INPUT', '10', 'A'],
        ['FC', '2025', 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Kas', 'Neraca Kas', 'INPUT', '11', 'A']
      ]
    },
    {
      name: 'TRIWULANAN', headers: characteristicHeaders,
      rows: [
        ['FC', '2025/Q1', 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Kas', 'Neraca Kas', 'INPUT', '10', 'A'],
        ['FC', '2026', 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Kas', 'Neraca Kas', 'INPUT', '11', 'A']
      ]
    },
    { name: 'ANALISIS RASIO', headers: ratioHeaders, rows: [['FC', '2024', 'RASIO', 'R1', 'A', '0']] },
    { name: 'MASTER DATA', rows: [['SEKTOR'], ['FC']] },
    { name: 'EMPTY', rows: [] },
    { name: 'OTHER INPUT', headers: ['A', 'B'], rows: [['x', 'y']] }
  ])

  assert.equal(response.statusCode, 200)
  const sheets = Object.fromEntries(response.body.detection.sheets.map(sheet => [sheet.sheet_name, sheet]))
  assert.equal(sheets.TAHUNAN.dataset_key, 'tahunan')
  assert.equal(sheets.TAHUNAN.target_table, 'characteristic_data')
  assert.deepEqual(sheets.TAHUNAN.periods.map(period => period.period_key), ['2024', '2025'])
  assert.equal(sheets.TRIWULANAN.status, 'detected')
  assert.equal(sheets.TRIWULANAN.dataset_key, 'triwulanan_1')
  assert.equal(sheets.TRIWULANAN.periods[1].requires_quarter, true)
  assert.equal(sheets['ANALISIS RASIO'].dataset_key, 'analisis_rasio')
  assert.equal(sheets['ANALISIS RASIO'].target_table, 'ratio_data')
  assert.equal(sheets['MASTER DATA'].status, 'ignored')
  assert.equal(sheets.EMPTY.status, 'empty')
  assert.equal(sheets['OTHER INPUT'].status, 'unknown')
})

test('specific quarterly sheet names and ratio/characteristic mismatches are explicit', async () => {
  const response = await detectWorkbook([
    { name: 'TRIWULANAN_1', headers: characteristicHeaders, rows: [['FC', '2025/Q2', 'X', 'Y', 'P6', 'R', 'R', 'INPUT', '1', 'C']] },
    { name: 'TRIWULANAN_2', headers: characteristicHeaders, rows: [['FC', '2025/Q3', 'X', 'Y', 'P6', 'R', 'R', 'INPUT', '1', 'C']] },
    { name: 'RASIO', headers: characteristicHeaders, rows: [['FC', '2025', 'X', 'Y', 'P6', 'R', 'R', 'INPUT', '1', 'C']] }
  ])

  const sheets = Object.fromEntries(response.body.detection.sheets.map(sheet => [sheet.sheet_name, sheet]))
  assert.equal(sheets.TRIWULANAN_1.dataset_key, 'triwulanan_1')
  assert.equal(sheets.TRIWULANAN_2.dataset_key, 'triwulanan_2')
  assert.equal(sheets.TRIWULANAN_1.target_table, 'characteristic_data')
  assert.equal(sheets.RASIO.status, 'invalid')
  assert.match(sheets.RASIO.errors.join(' '), /header baris ke-3/)
})

test('duplicate sheets targeting the same dataset-period are rejected explicitly', async () => {
  const response = await detectWorkbook([
    { name: 'RASIO', headers: ratioHeaders, rows: [['FC', '2025', 'R', 'R1', 'A', '0']] },
    { name: 'ANALISIS_RASIO', headers: ratioHeaders, rows: [['FC', '2025', 'R', 'R2', 'B', '1']] }
  ])

  assert.ok(response.body.detection.sheets.every(sheet => sheet.status === 'duplicate_conflict'))
})

test('quarterly preview requires an explicit selected quarter when TAHUN has only a year', async () => {
  const result = await previewWorkbook(
    'triwulanan_1', 2025, null, characteristicHeaders,
    [['CB', '2025', 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Kas', 'Neraca Kas', 'INPUT', '0', 'A']]
  )

  assert.equal(result.result.statusCode, 400)
  assert.match(result.result.body.message, /quarter yang valid/)
})

test('invalid row-three header rejects the selected worksheet', async () => {
  const wrongHeaders = [...characteristicHeaders]
  wrongHeaders[7] = 'STATUS'
  const result = await previewWorkbook(
    'tahunan', 2025, null, wrongHeaders,
    [['CB', '2025', 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Kas', 'Neraca Kas', 'INPUT', '0', 'A']]
  )

  assert.equal(result.result.statusCode, 400)
  assert.match(result.result.body.message, /Header Excel tidak sesuai template pada baris ke-3/)
})

test('quarterly Analisis Rasio uses its six-column contract and stores quarter metadata', async () => {
  const result = await previewWorkbook(
    'analisis_rasio', 2025, 2, ratioHeaders,
    [['CB', '2025/Q2', 'RASIO A', 'P6', 'Investasi', '1.25']]
  )

  assert.equal(result.result.statusCode, 200)
  assert.equal(result.result.body.preview.period_type, 'quarterly')
  assert.equal(result.result.body.preview.quarter, 2)
  assert.equal(result.stagedRows[0].normalized_data.jenis_rasio, 'RASIO A')
  assert.equal(result.stagedRows[0].normalized_data.nilai, '1.25')
})

test('quarterly ratio rejects a TAHUN value whose embedded quarter differs from the selected period', async () => {
  const result = await previewWorkbook(
    'analisis_rasio', 2025, 2, ratioHeaders,
    [['CB', '2025/Q3', 'RASIO A', 'P6', 'Investasi', '1.25']]
  )

  assert.equal(result.result.statusCode, 200)
  assert.equal(result.result.body.preview.invalid_rows, 1)
  assert.match(result.stagedRows[0].validation_errors.join(' '), /TRIWULAN 3.*Q2/)
})

test('annual dataset rejects quarterly TAHUN values instead of treating Q1 as annual', async () => {
  const result = await previewWorkbook(
    'tahunan', 2025, null, characteristicHeaders,
    [['CB', '2025/Q1', 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Kas', 'Neraca Kas', 'INPUT', '1', 'A']]
  )

  assert.equal(result.result.body.preview.invalid_rows, 1)
  assert.match(result.stagedRows[0].validation_errors.join(' '), /TAHUN harus berupa empat digit/)
})

test('annual ratio period stores annual metadata when TAHUN contains only YYYY', async () => {
  const result = await previewWorkbook(
    'analisis_rasio', 2026, null, ratioHeaders,
    [['CB', '2026', 'RASIO A', 'P6', 'Investasi', '0']]
  )

  assert.equal(result.result.body.preview.period_type, 'annual')
  assert.equal(result.stagedRows[0].normalized_data.quarter, null)
  assert.equal(result.stagedRows[0].normalized_data.nilai, '0')
})

test('duplicate business keys are invalidated in preview', async () => {
  const duplicateRow = ['CB', 2025, 'ASET', 'NERACA', 'P6', 'Investasi', 'Neraca investasi', 'INPUT', '175000', 'A']
  const result = await previewWorkbook(
    'tahunan', 2025, null, characteristicHeaders,
    [duplicateRow, [...duplicateRow.slice(0, 9), 'Konsep berbeda']],
    { duplicateKeys: true }
  )

  assert.equal(result.result.statusCode, 200)
  assert.equal(result.result.body.preview.valid_rows, 0)
  assert.equal(result.result.body.preview.invalid_rows, 2)
  assert.equal(result.result.body.preview.duplicate_rows, 2)
  assert.ok(result.stagedRows.every(row => row.validation_errors.some(error => error.includes('Business key duplikat'))))
})

test('new sector preview remains valid and does not insert a master sector', async () => {
  const result = await previewWorkbook(
    'tahunan', 2026, null, characteristicHeaders,
    [['NFC PRIVATE 2', 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Investasi', 'Neraca investasi', 'INPUT', '150000', 'A']]
  )

  assert.equal(result.result.statusCode, 200)
  assert.equal(result.result.body.preview.valid_rows, 1)
  assert.equal(result.result.body.preview.invalid_rows, 0)
  assert.equal(result.stagedRows[0].normalized_data.new_sector_candidate, true)
  assert.equal(result.stagedRows[0].normalized_data.sector_id, null)
  assert.equal(result.result.body.preview.sector_summary.new_sector_count, 1)
  assert.deepEqual(result.result.body.preview.sector_summary.new[0].records[0], {
    sisi: 'PENGGUNAAN',
    jenis_neraca: 'NERACA PRODUKSI',
    jenis_rasio: null,
    kode: 'P6',
    rincian: 'Investasi',
    nilai: '150000',
    nilai_raw: '150000'
  })
  assert.ok(!result.calls.some(statement => statement.startsWith('INSERT INTO sectors')))
})

test('multiple unknown sectors are summarized independently with every record', async () => {
  const result = await previewWorkbook(
    'tahunan', 2026, null, characteristicHeaders,
    [
      ['NFC PRIVATE 2', 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Investasi', 'Neraca investasi', 'INPUT', '150000', 'A'],
      ['Nfc   Private 2', 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P7', 'Simpanan', 'Neraca simpanan', 'INPUT', '200000', 'A'],
      ['NEW SECTOR', 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'B11', 'Keseimbangan', 'Neraca keseimbangan', 'INPUT', '50000', 'A']
    ]
  )

  assert.equal(result.result.body.preview.valid_rows, 3)
  assert.equal(result.result.body.preview.sector_summary.new_sector_count, 2)
  const firstSector = result.result.body.preview.sector_summary.new.find(item => item.sector_code === 'NFC PRIVATE 2')
  assert.equal(firstSector.record_count, 2)
  assert.deepEqual(firstSector.records.map(record => record.kode), ['P6', 'P7'])
})

test('existing sector code and name match case-insensitively with normalized whitespace', async () => {
  const result = await previewWorkbook(
    'tahunan', 2026, null, characteristicHeaders,
    [['nfc   private 2', 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Investasi', 'Neraca investasi', 'INPUT', '150000', 'A']],
    { sectors: [{ id: 12, code: 'NFC-PRIVATE', name: 'NFC PRIVATE 2', source_code: null }] }
  )

  assert.equal(result.result.body.preview.valid_rows, 1)
  assert.equal(result.stagedRows[0].normalized_data.sector_id, 12)
  assert.equal(result.stagedRows[0].normalized_data.new_sector_candidate, false)
  assert.equal(result.stagedRows[0].normalized_data.source_sector_code, 'NFC-PRIVATE')
  assert.equal(result.result.body.preview.sector_summary.new_sector_count, 0)
})

test('official sector names in Excel retain raw source and normalize to existing sector id', async () => {
  const officialName = 'KORPORASI FINANSIAL (FINANCIAL CORPORATIONS)'
  const result = await previewWorkbook(
    'tahunan', 2026, null, characteristicHeaders,
    [[officialName, 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Kas', 'Neraca Kas', 'INPUT', '0', 'A']],
    { sectors: [{ id: 33, code: 'FC', name: 'FC', source_code: null }] }
  )

  assert.equal(result.result.statusCode, 200)
  assert.equal(result.result.body.preview.valid_rows, 1)
  assert.equal(result.stagedRows[0].raw_data.SEKTOR, officialName)
  assert.equal(result.stagedRows[0].normalized_data.source_sector_code, 'FC')
  assert.equal(result.stagedRows[0].normalized_data.sector_id, 33)
  assert.equal(result.stagedRows[0].normalized_data.new_sector_candidate, false)
  assert.equal(result.result.body.preview.sector_summary.new_sector_count, 0)
})

test('canonical and alias matches to different sectors are rejected as a conflict', async () => {
  const result = await previewWorkbook(
    'tahunan', 2026, null, characteristicHeaders,
    [['NFC', 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Investasi', 'Neraca investasi', 'INPUT', '150000', 'A']],
    { sectors: [
      { id: 1, code: 'NFC', name: 'NFC' },
      { id: 2, code: 'OTHER', name: 'Other', source_code: 'NFC' }
    ] }
  )

  assert.equal(result.result.body.preview.invalid_rows, 1)
  assert.equal(result.stagedRows[0].normalized_data.sector_status, 'conflict')
  assert.equal(result.result.body.preview.sector_summary.conflict_count, 1)
  assert.match(result.stagedRows[0].validation_errors.join(' '), /beberapa identitas master/)
})

test('characteristic values preserve empty, zero, and numeric input as three states', async () => {
  const result = await previewWorkbook(
    'tahunan', 2026, null, characteristicHeaders,
    [
      ['CB', 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Kosong', 'A', 'KOSONG', '—', 'A'],
      ['CB', 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P7', 'Nol', 'B', 'INPUT', 0, 'A'],
      ['CB', 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P8', 'Decimal', 'C', 'INPUT', '184,39306605199400', 'A']
    ]
  )

  assert.equal(result.result.body.preview.valid_rows, 3)
  assert.deepEqual(result.stagedRows.map(row => row.normalized_data.nilai), [null, '0', '184.39306605199400'])
  assert.deepEqual(result.stagedRows.map(row => row.normalized_data.value_status), ['empty', 'valid', 'valid'])
})

test('characteristic status and value mismatches are invalid with actionable messages', async () => {
  const result = await previewWorkbook(
    'tahunan', 2026, null, characteristicHeaders,
    [
      ['CB', 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Input kosong', 'A', 'INPUT', '—', 'A'],
      ['CB', 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P7', 'Kosong angka', 'B', 'KOSONG', '10', 'A'],
      ['CB', 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P8', 'Status salah', 'C', 'N/A', '10', 'A']
    ]
  )

  assert.equal(result.result.body.preview.invalid_rows, 3)
  assert.match(result.stagedRows[0].validation_errors.join(' '), /Status INPUT memerlukan nilai numerik/)
  assert.match(result.stagedRows[1].validation_errors.join(' '), /Status KOSONG tidak boleh memiliki nilai numerik/)
  assert.match(result.stagedRows[2].validation_errors.join(' '), /STATUS NILAI harus berupa KOSONG atau INPUT/)
})

test('ratio values accept dash as NULL and locale strings while rejecting ambiguous text', async () => {
  const result = await previewWorkbook(
    'analisis_rasio', 2026, null, ratioHeaders,
    [
      ['CB', 2026, 'RASIO A', 'P6', 'Kosong', '–'],
      ['CB', 2026, 'RASIO A', 'P7', 'Nol', 0],
      ['CB', 2026, 'RASIO A', 'P8', 'Locale', '1.234,56'],
      ['CB', 2026, 'RASIO A', 'P9', 'Negatif', '-150,25'],
      ['CB', 2026, 'RASIO A', 'P10', 'Ambiguous', '1,234'],
      ['CB', 2026, 'RASIO A', 'P11', 'Invalid', 'abc']
    ]
  )

  assert.equal(result.result.body.preview.valid_rows, 4)
  assert.equal(result.result.body.preview.invalid_rows, 2)
  assert.deepEqual(result.stagedRows.map(row => row.normalized_data.nilai), [null, '0', '1234.56', '-150.25', null, null])
  assert.match(result.stagedRows[4].validation_errors.join(' '), /NILAI harus berupa angka valid/)
  assert.match(result.stagedRows[5].validation_errors.join(' '), /NILAI harus berupa angka valid/)
})

test('formatted-only rows at the Excel row limit do not become records or trigger a rowCount scan', async () => {
  const fixture = createPreviewPool()
  const file = await createWorkbookFile(
    'TAHUNAN',
    characteristicHeaders,
    [['CB', 2026, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'Kas', 'Neraca Kas', 'INPUT', '0', 'A']],
    { formattedMaxRow: true }
  )

  try {
    let response
    await withMockedController(fixture.pool, async controller => {
      response = responseRecorder()
      await controller.previewAnnualUpload({
        query: { dataset: 'tahunan', tahun: '2026' },
        file: { path: file.filePath, originalname: 'sparse.xlsx', size: 1024 }
      }, response)
    })

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.preview.total_rows, 1)
    assert.equal(fixture.stagedRows[0].raw_data.NILAI, '0')
  } finally {
    await fs.rm(file.directory, { recursive: true, force: true })
  }
})

test('quarterly characteristic template keeps the official ten source columns', async () => {
  let response
  await withMockedController({}, async controller => {
    response = responseRecorder()
    await controller.downloadAnnualTemplate({
      params: { datasetKey: 'triwulanan_2' },
      query: { tahun: '2025', quarter: '4' }
    }, response)
  })
  assert.equal(response.statusCode, 200)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(response.body)
  assert.deepEqual(workbook.worksheets.map(worksheet => worksheet.name), ['TAHUNAN', 'TRIWULANAN', 'RASIO'])
  assert.deepEqual(workbook.getWorksheet('TAHUNAN').getRow(3).values.slice(1), characteristicHeaders)
  assert.deepEqual(workbook.getWorksheet('TRIWULANAN').getRow(3).values.slice(1), characteristicHeaders)
  assert.deepEqual(workbook.getWorksheet('RASIO').getRow(3).values.slice(1), ratioHeaders)
  assert.equal(workbook.getWorksheet('MASTER DATA'), undefined)
  assert.equal(workbook.definedNames.model.some(item => item.ranges.some(range => range.includes('MASTER DATA'))), false)
  for (const worksheet of workbook.worksheets) {
    for (const validation of Object.values(worksheet.dataValidations.model)) {
      assert.equal((validation.formulae || []).some(formula => String(formula).includes('MASTER DATA')), false)
    }
  }

  const annualSheet = workbook.getWorksheet('TAHUNAN')
  assert.equal(annualSheet.dataValidations.model.A4, undefined)
  assert.ok(annualSheet.dataValidations.model.H4)
  assert.ok(annualSheet.dataValidations.model.B4)
  assert.ok(annualSheet.rowCount <= 1003)
  assert.ok(annualSheet.tables.TableTahunan)
  assert.equal(annualSheet.tables.TableTahunan.table.tableRef, 'A3:J1003')
})
