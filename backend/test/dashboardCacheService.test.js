const Module = require('node:module')
const test = require('node:test')
const assert = require('node:assert/strict')

const servicePath = require.resolve('../src/services/dashboardCacheService')
const sheetsPath = require.resolve('../src/services/googleSheetsService')
const mapperPath = require.resolve('../src/mappers/dashboardMapper')

async function withMockedCache(readers, callback) {
  const previousDateNow = Date.now
  const previousService = require.cache[servicePath]
  const previousSheets = require.cache[sheetsPath]
  const previousMapper = require.cache[mapperPath]

  const sheetsModule = new Module(sheetsPath)
  sheetsModule.filename = sheetsPath
  sheetsModule.loaded = true
  sheetsModule.exports = {
    getTahunanData: readers.getTahunanData,
    getTriwulananData: readers.getTriwulananData,
    getDashboardData: async () => {
      const [tahunan, triwulanan] = await Promise.all([
        readers.getTahunanData(),
        readers.getTriwulananData()
      ])

      return { tahunan, triwulanan }
    }
  }

  const mapperModule = new Module(mapperPath)
  mapperModule.filename = mapperPath
  mapperModule.loaded = true
  mapperModule.exports = {
    mapTahunanData: data => data.map(item => ({ ...item })),
    mapTriwulananData: data => data.map(item => ({ ...item }))
  }

  require.cache[sheetsPath] = sheetsModule
  require.cache[mapperPath] = mapperModule
  delete require.cache[servicePath]

  try {
    await callback(require(servicePath))
  } finally {
    Date.now = previousDateNow

    if (previousService) {
      require.cache[servicePath] = previousService
    } else {
      delete require.cache[servicePath]
    }

    if (previousSheets) {
      require.cache[sheetsPath] = previousSheets
    } else {
      delete require.cache[sheetsPath]
    }

    if (previousMapper) {
      require.cache[mapperPath] = previousMapper
    } else {
      delete require.cache[mapperPath]
    }
  }
}

test('manual refresh replaces valid cache and advances its timestamp within the TTL', async () => {
  let now = 1_800_000_000_000
  let version = 1

  await withMockedCache({
    getTahunanData: async () => [{ version }],
    getTriwulananData: async () => [{ version }]
  }, async service => {
    Date.now = () => now
    assert.deepEqual(await service.getCachedTahunanData(), [{ version: 1 }])
    assert.deepEqual(await service.getCachedTriwulananData(), [{ version: 1 }])

    const previousAnnualTimestamp =
      service.getTahunanCacheInfo().loadedAt
    const previousQuarterlyTimestamp =
      service.getTriwulananCacheInfo().loadedAt

    now += 1_000
    version = 2
    const result = await service.refreshDashboardCache()

    assert.deepEqual(await service.getCachedTahunanData(), [{ version: 2 }])
    assert.deepEqual(await service.getCachedTriwulananData(), [{ version: 2 }])
    assert.notEqual(
      service.getTahunanCacheInfo().loadedAt,
      previousAnnualTimestamp
    )
    assert.notEqual(
      service.getTriwulananCacheInfo().loadedAt,
      previousQuarterlyTimestamp
    )
    assert.equal(
      service.getTahunanCacheInfo().loadedAt,
      service.getTriwulananCacheInfo().loadedAt
    )
    assert.equal(
      result.refreshedAt,
      new Date(now).toISOString()
    )
    assert.deepEqual(result.total, {
      tahunan: 1,
      triwulanan: 1
    })
  })
})

test('concurrent manual refresh requests share one Google Sheets read', async () => {
  let now = 1_800_000_000_000
  let annualReads = 0
  let quarterlyReads = 0
  let releaseReads
  const readsReady = new Promise(resolve => {
    releaseReads = resolve
  })

  await withMockedCache({
    getTahunanData: async () => {
      annualReads += 1
      await readsReady
      return [{ year: 2025 }]
    },
    getTriwulananData: async () => {
      quarterlyReads += 1
      await readsReady
      return [{ quarter: 1 }]
    }
  }, async service => {
    Date.now = () => now++
    const first = service.refreshDashboardCache()
    const second = service.refreshDashboardCache()

    await new Promise(resolve => setImmediate(resolve))
    assert.equal(annualReads, 1)
    assert.equal(quarterlyReads, 1)

    releaseReads()
    const [firstResult, secondResult] = await Promise.all([first, second])
    assert.deepEqual(firstResult, secondResult)
    assert.equal(annualReads, 1)
    assert.equal(quarterlyReads, 1)
  })
})

test('manual refresh enforces a 60-second minimum interval', async () => {
  let now = 1_800_000_000_000
  let annualReads = 0
  let quarterlyReads = 0

  await withMockedCache({
    getTahunanData: async () => {
      annualReads += 1
      return []
    },
    getTriwulananData: async () => {
      quarterlyReads += 1
      return []
    }
  }, async service => {
    Date.now = () => now
    await service.refreshDashboardCache()
    await assert.rejects(
      service.refreshDashboardCache(),
      error => error.status === 429 && error.retryAfterSeconds === 60
    )
    assert.equal(annualReads, 1)
    assert.equal(quarterlyReads, 1)

    now += 60_000
    await service.refreshDashboardCache()
    assert.equal(annualReads, 2)
    assert.equal(quarterlyReads, 2)
  })
})

test('failed manual refresh preserves the existing annual and quarterly caches', async () => {
  let now = 1_800_000_000_000
  let failQuarterly = false
  let version = 1

  await withMockedCache({
    getTahunanData: async () => [{ version }],
    getTriwulananData: async () => {
      if (failQuarterly) {
        throw new Error('Google Sheets unavailable')
      }

      return [{ version }]
    }
  }, async service => {
    Date.now = () => now++
    assert.deepEqual(await service.getCachedTahunanData(), [{ version: 1 }])
    assert.deepEqual(await service.getCachedTriwulananData(), [{ version: 1 }])
    const annualTimestamp = service.getTahunanCacheInfo().loadedAt
    const quarterlyTimestamp = service.getTriwulananCacheInfo().loadedAt

    version = 2
    failQuarterly = true
    await assert.rejects(service.refreshDashboardCache(), /Google Sheets unavailable/)

    assert.deepEqual(await service.getCachedTahunanData(), [{ version: 1 }])
    assert.deepEqual(await service.getCachedTriwulananData(), [{ version: 1 }])
    assert.equal(service.getTahunanCacheInfo().loadedAt, annualTimestamp)
    assert.equal(service.getTriwulananCacheInfo().loadedAt, quarterlyTimestamp)
  })
})
