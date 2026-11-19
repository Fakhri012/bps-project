const Module = require('node:module')
const test = require('node:test')
const assert = require('node:assert/strict')

const googleSheetsServicePath = require.resolve('../services/googleSheetsService')

test('runtime Express app loads without loading the Google Sheets service', () => {
  const originalLoad = Module._load
  const appPath = require.resolve('../src/app')
  const previousApp = require.cache[appPath]

  delete require.cache[appPath]
  Module._load = function (request, parent, isMain) {
    const resolved = Module._resolveFilename(request, parent, isMain)

    if (resolved === googleSheetsServicePath) {
      throw new Error('Runtime API attempted to load Google Sheets service')
    }

    return originalLoad.apply(this, arguments)
  }

  try {
    const app = require('../src/app')
    assert.equal(typeof app, 'function')
  } finally {
    Module._load = originalLoad

    if (previousApp) {
      require.cache[appPath] = previousApp
    } else {
      delete require.cache[appPath]
    }
  }
})