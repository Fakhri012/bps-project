const Module = require('node:module')
const test = require('node:test')
const assert = require('node:assert/strict')

test('reads Banding Makro rows through the existing Google Sheets client', async () => {
  const configPath = require.resolve('../src/config/googleSheets')
  const servicePath = require.resolve('../src/services/googleSheetsService')
  const previousConfig = require.cache[configPath]
  const previousService = require.cache[servicePath]
  const previousSheetId = process.env.GOOGLE_SHEET_ID
  const calls = []

  const mockConfig = new Module(configPath)
  mockConfig.filename = configPath
  mockConfig.loaded = true
  mockConfig.exports = {
    spreadsheets: {
      values: {
        get: async options => {
          calls.push(options)
          return {
            data: {
              values: [
                ['TAHUN', 'Transaksi'],
                [2024, -8.583],
                ['2024/Q1', -68]
              ]
            }
          }
        }
      }
    }
  }

  require.cache[configPath] = mockConfig
  delete require.cache[servicePath]
  process.env.GOOGLE_SHEET_ID = 'test-spreadsheet'

  try {
    const service = require(servicePath)
    assert.deepEqual(await service.getBandingMakroRows(), [
      { TAHUN: 2024, Transaksi: -8.583 },
      { TAHUN: '2024/Q1', Transaksi: -68 }
    ])
    assert.deepEqual(calls, [{
      spreadsheetId: 'test-spreadsheet',
      range: "'Banding Makro'!B3:C",
      valueRenderOption: 'UNFORMATTED_VALUE'
    }])
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
})
