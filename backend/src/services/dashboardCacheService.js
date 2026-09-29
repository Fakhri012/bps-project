const {
  getTahunanData,
  getTriwulananData
} = require('./googleSheetsService')

const {
  mapTahunanData,
  mapTriwulananData
} = require('../mappers/dashboardMapper')


/*
|--------------------------------------------------------------------------
| CACHE TTL
|--------------------------------------------------------------------------
|
| 3 menit
|
*/

const CACHE_TTL =
  3 * 60 * 1000


/*
|--------------------------------------------------------------------------
| CACHE TAHUNAN
|--------------------------------------------------------------------------
*/

let tahunanCache = {
  data: null,
  loadedAt: null
}


/*
|--------------------------------------------------------------------------
| CACHE TRIWULANAN
|--------------------------------------------------------------------------
*/

let triwulananCache = {
  data: null,
  loadedAt: null
}


/*
|--------------------------------------------------------------------------
| CEK CACHE
|--------------------------------------------------------------------------
*/

function isCacheValid(cache) {
  if (
    !cache.data ||
    !cache.loadedAt
  ) {
    return false
  }

  const age =
    Date.now() -
    cache.loadedAt

  return age < CACHE_TTL
}


/*
|--------------------------------------------------------------------------
| GET CACHE TAHUNAN
|--------------------------------------------------------------------------
*/

async function getCachedTahunanData() {
  if (
    isCacheValid(
      tahunanCache
    )
  ) {
    return tahunanCache.data
  }

  console.log(
    'Mengambil data Tahunan dari Google Sheets...'
  )

  const rawData =
    await getTahunanData()

  const data =
    mapTahunanData(
      rawData
    )

  tahunanCache = {
    data,
    loadedAt: Date.now()
  }

  console.log(
    `Cache Tahunan diperbarui: ${data.length} baris`
  )

  return data
}


/*
|--------------------------------------------------------------------------
| GET CACHE TRIWULANAN
|--------------------------------------------------------------------------
*/

async function getCachedTriwulananData() {
  if (
    isCacheValid(
      triwulananCache
    )
  ) {
    return triwulananCache.data
  }

  console.log(
    'Mengambil data Triwulanan dari Google Sheets...'
  )

  const rawData =
    await getTriwulananData()

  const data =
    mapTriwulananData(
      rawData
    )

  triwulananCache = {
    data,
    loadedAt: Date.now()
  }

  console.log(
    `Cache Triwulanan diperbarui: ${data.length} baris`
  )

  return data
}


/*
|--------------------------------------------------------------------------
| CLEAR CACHE TAHUNAN
|--------------------------------------------------------------------------
*/

function clearTahunanCache() {
  tahunanCache = {
    data: null,
    loadedAt: null
  }

  console.log(
    'Cache Tahunan dibersihkan'
  )
}


/*
|--------------------------------------------------------------------------
| CLEAR CACHE TRIWULANAN
|--------------------------------------------------------------------------
*/

function clearTriwulananCache() {
  triwulananCache = {
    data: null,
    loadedAt: null
  }

  console.log(
    'Cache Triwulanan dibersihkan'
  )
}


/*
|--------------------------------------------------------------------------
| CACHE INFO TAHUNAN
|--------------------------------------------------------------------------
*/

function getTahunanCacheInfo() {
  if (!tahunanCache.data) {
    return {
      active: false,
      total: 0,
      loadedAt: null,
      expiresAt: null
    }
  }

  return {
    active: true,

    total:
      tahunanCache.data.length,

    loadedAt:
      new Date(
        tahunanCache.loadedAt
      ).toISOString(),

    expiresAt:
      new Date(
        tahunanCache.loadedAt +
        CACHE_TTL
      ).toISOString()
  }
}


/*
|--------------------------------------------------------------------------
| CACHE INFO TRIWULANAN
|--------------------------------------------------------------------------
*/

function getTriwulananCacheInfo() {
  if (!triwulananCache.data) {
    return {
      active: false,
      total: 0,
      loadedAt: null,
      expiresAt: null
    }
  }

  return {
    active: true,

    total:
      triwulananCache.data.length,

    loadedAt:
      new Date(
        triwulananCache.loadedAt
      ).toISOString(),

    expiresAt:
      new Date(
        triwulananCache.loadedAt +
        CACHE_TTL
      ).toISOString()
  }
}


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {
  getCachedTahunanData,
  getCachedTriwulananData,

  clearTahunanCache,
  clearTriwulananCache,

  getTahunanCacheInfo,
  getTriwulananCacheInfo
}