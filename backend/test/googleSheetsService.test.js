const Module = require('node:module')
const test = require('node:test')
const assert = require('node:assert/strict')

const configPath = require.resolve('../src/config/googleSheets')
const servicePath = require.resolve('../src/services/googleSheetsService')

async function withMockedGoogleSheets(valuesByRange, callback) {
  const previousConfig = require.cache[configPath]
  const previousService = require.cache[servicePath]
  const previousSheetId = process.env.GOOGLE_SHEET_ID

  const mockConfig = new Module(configPath)
  mockConfig.filename = configPath
  mockConfig.loaded = true
  mockConfig.exports = {
    spreadsheets: {
      values: {
        get: async ({ spreadsheetId, range }) => {
          assert.equal(spreadsheetId, 'test-sheet-id')
          return {
            data: {
              values: valuesByRange[range] || []
            }
          }
        }
      }
    }
  }

  require.cache[configPath] = mockConfig
  delete require.cache[servicePath]
  process.env.GOOGLE_SHEET_ID = 'test-sheet-id'

  try {
    return await callback(require(servicePath))
  } finally {
    if (previousConfig) {
      require.cache[configPath] = previousConfig
    } else {
      delete require.cache[configPath]
    }

    if (previousService) {
      require.cache[servicePath] = previousService
    } else {
      delete require.cache[servicePath]
    }

    if (previousSheetId === undefined) {
      delete process.env.GOOGLE_SHEET_ID
    } else {
      process.env.GOOGLE_SHEET_ID = previousSheetId
    }
  }
}

test('maps pivot and ratio rows using their distinct required headers', async () => {
  const valuesByRange = {
    "'Karakteristik & Pivot Tahunan'!E:L": [
      ['metadata'],
      [' SEKTOR ', 'TAHUN', 'SISI', 'JENIS NERACA', 'KODE', 'RINCIAN', 'NERACA - RINCIAN', 'NILAI'],
      ['FC', '2024', 'SUMBER', 'ASET', 'K1', 'Kas', 'Kas dan setara kas', '1.234,56'],
      ['', '', '', '', '', '', '', ' '],
      ['GG', '2023', 'PENGGUNAAN', 'KEWAJIBAN', 'K2', 'Utang', 'Utang lain', '']
    ],
    "'Karakteristik & Pivot Triwulanan'!E:L": [
      ['SEKTOR', 'TAHUN', 'SISI', 'JENIS NERACA', 'KODE', 'RINCIAN', 'NERACA - RINCIAN', 'NILAI'],
      ['FC', '2024/Q1', 'SUMBER', 'ASET', 'K1', 'Kas', 'Kas dan setara kas', '5']
    ],
    "'Karakteristik & Pivot Triwulan 2'!E:L": [
      ['SEKTOR', 'TAHUN', 'SISI', 'JENIS NERACA', 'KODE', 'RINCIAN', 'NERACA - RINCIAN', 'NILAI'],
      ['NFC', '2024/Q2', 'PENGGUNAAN', 'ASET', 'K2', 'Mesin', 'Mesin dan peralatan', '6']
    ],
    "'Analisis Rasio'!E:J": [
      ['metadata'],
      ['SEKTOR', 'TAHUN', 'JENIS RASIO', 'KODE', 'RINCIAN', 'NILAI'],
      ['FC', '2024', 'Likuiditas', 'R1', 'Rasio lancar', '1,25']
    ]
  }

  await withMockedGoogleSheets(valuesByRange, async service => {
    assert.deepEqual(
      await service.getTahunanData(),
      [
        {
          SEKTOR: 'FC',
          TAHUN: '2024',
          SISI: 'SUMBER',
          'JENIS NERACA': 'ASET',
          KODE: 'K1',
          RINCIAN: 'Kas',
          'NERACA - RINCIAN': 'Kas dan setara kas',
          NILAI: '1.234,56'
        },
        {
          SEKTOR: 'GG',
          TAHUN: '2023',
          SISI: 'PENGGUNAAN',
          'JENIS NERACA': 'KEWAJIBAN',
          KODE: 'K2',
          RINCIAN: 'Utang',
          'NERACA - RINCIAN': 'Utang lain',
          NILAI: ''
        }
      ]
    )

    assert.deepEqual(
      await service.getTriwulananData(),
      [
        {
          SEKTOR: 'FC',
          TAHUN: '2024/Q1',
          SISI: 'SUMBER',
          'JENIS NERACA': 'ASET',
          KODE: 'K1',
          RINCIAN: 'Kas',
          'NERACA - RINCIAN': 'Kas dan setara kas',
          NILAI: '5'
        },
        {
          SEKTOR: 'NFC',
          TAHUN: '2024/Q2',
          SISI: 'PENGGUNAAN',
          'JENIS NERACA': 'ASET',
          KODE: 'K2',
          RINCIAN: 'Mesin',
          'NERACA - RINCIAN': 'Mesin dan peralatan',
          NILAI: '6'
        }
      ]
    )

    assert.deepEqual(
      await service.getAnalisisRasioData(),
      [
        {
          SEKTOR: 'FC',
          TAHUN: '2024',
          'JENIS RASIO': 'Likuiditas',
          KODE: 'R1',
          RINCIAN: 'Rasio lancar',
          NILAI: '1,25'
        }
      ]
    )
  })
})

test('returns empty data when a sheet has no rows', async () => {
  await withMockedGoogleSheets({}, async service => {
    assert.deepEqual(await service.getTahunanData(), [])
    assert.deepEqual(await service.getAnalisisRasioData(), [])
  })
})

test('preserves each sheet required headers and missing-header errors', async () => {
  await withMockedGoogleSheets({
    "'Analisis Rasio'!E:J": [
      ['SEKTOR', 'TAHUN', 'JENIS RASIO', 'KODE', 'RINCIAN']
    ]
  }, async service => {
    await assert.rejects(
      service.getAnalisisRasioData(),
      new Error('Header data tidak ditemukan pada sheet "Analisis Rasio"')
    )
  })

  await withMockedGoogleSheets({
    "'Karakteristik & Pivot Tahunan'!E:L": [
      ['SEKTOR', 'TAHUN', 'JENIS NERACA', 'KODE', 'RINCIAN', 'NILAI']
    ]
  }, async service => {
    await assert.rejects(
      service.getTahunanData(),
      new Error(
        'Header data tidak ditemukan pada sheet "Karakteristik & Pivot Tahunan"'
      )
    )
  })
})