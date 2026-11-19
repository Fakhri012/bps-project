'use strict'

const Module = require('node:module')
const test = require('node:test')
const assert = require('node:assert/strict')

const servicePath = require.resolve('../services/postgresDataService')
const poolPath = require.resolve('../src/config/postgres')

function moduleWithExports(filename, exports) {
  const mockedModule = new Module(filename)
  mockedModule.filename = filename
  mockedModule.loaded = true
  mockedModule.exports = exports
  return mockedModule
}

test('dashboard and database readers select active versions only', async () => {
  const calls = []
  const pool = {
    async query(sql) {
      calls.push(String(sql).replace(/\s+/g, ' ').trim())
      return { rows: [] }
    }
  }
  const previousPool = require.cache[poolPath]
  const previousService = require.cache[servicePath]

  require.cache[poolPath] = moduleWithExports(poolPath, pool)
  delete require.cache[servicePath]

  try {
    const service = require(servicePath)
    await service.getTahunanData()
    await service.getTriwulananData()
    await service.getAnalisisRasioData()
    await service.getBandingMakroRows()

    assert.equal(calls.length, 4)
    assert.ok(calls.every(sql => sql.includes("status = 'active'")))
    assert.ok(calls[0].includes("WHEN d.value_status = 'empty' THEN NULL"))
    assert.ok(calls[0].includes('AS "STATUS NILAI"'))
    assert.ok(calls[2].includes("WHEN d.value_status = 'empty' THEN NULL"))
    assert.ok(calls[3].includes("WHEN value_status = 'empty' THEN NULL"))
  } finally {
    if (previousService) require.cache[servicePath] = previousService
    else delete require.cache[servicePath]
    if (previousPool) require.cache[poolPath] = previousPool
    else delete require.cache[poolPath]
  }
})
