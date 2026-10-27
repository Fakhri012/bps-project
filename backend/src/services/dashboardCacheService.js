const {
  getTahunanData,
  getTriwulananData,
  getDashboardData
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
| 5 menit
|
*/

const CACHE_TTL =
  5 * 60 * 1000
const MANUAL_REFRESH_MIN_INTERVAL =
  60 * 1000


/*
|--------------------------------------------------------------------------
| CACHE TAHUNAN
|--------------------------------------------------------------------------
*/

let tahunanCache = {
  data: null,
  loadedAt: null
}

let tahunanLoadingPromise = null


/*
|--------------------------------------------------------------------------
| CACHE TRIWULANAN
|--------------------------------------------------------------------------
*/

let triwulananCache = {
  data: null,
  loadedAt: null
}

let triwulananLoadingPromise = null
let manualRefreshPromise = null
let lastManualRefreshAt = null


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
  if (manualRefreshPromise) {
    return manualRefreshPromise.then(
      () => tahunanCache.data,
      error => {
        if (tahunanCache.data) {
          return tahunanCache.data
        }

        throw error
      }
    )
  }

  if (
    isCacheValid(
      tahunanCache
    )
  ) {
    return tahunanCache.data
  }


  /*
   * Kalau sedang ada proses loading,
   * request berikutnya cukup menunggu
   * proses tersebut.
   */

  if (
    tahunanLoadingPromise
  ) {
    return tahunanLoadingPromise
  }


  /*
   * Tandai proses loading sedang berjalan.
   */

  tahunanLoadingPromise =
    (async () => {
      try {
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
          loadedAt:
            Date.now()
        }


        console.log(
          `Cache Tahunan diperbarui: ${data.length} baris`
        )


        return data

      } finally {
        /*
         * Setelah selesai,
         * izinkan proses loading berikutnya.
         */

        tahunanLoadingPromise =
          null
      }
    })()


  return tahunanLoadingPromise
}


/*
|--------------------------------------------------------------------------
| GET CACHE TRIWULANAN
|--------------------------------------------------------------------------
*/

async function getCachedTriwulananData() {
  if (manualRefreshPromise) {
    return manualRefreshPromise.then(
      () => triwulananCache.data,
      error => {
        if (triwulananCache.data) {
          return triwulananCache.data
        }

        throw error
      }
    )
  }

  if (
    isCacheValid(
      triwulananCache
    )
  ) {
    return triwulananCache.data
  }

  if (triwulananLoadingPromise) {
    return triwulananLoadingPromise
  }

  triwulananLoadingPromise = (async () => {
    try {
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
    } finally {
      triwulananLoadingPromise = null
    }
  })()

  return triwulananLoadingPromise
}

async function warmDashboardCache() {
  await Promise.all([
    getCachedTahunanData(),
    getCachedTriwulananData()
  ])
}

async function refreshDashboardCache() {
  if (manualRefreshPromise) {
    return manualRefreshPromise
  }

  const now = Date.now()
  const retryAfterMs = lastManualRefreshAt === null
    ? 0
    : lastManualRefreshAt +
      MANUAL_REFRESH_MIN_INTERVAL -
      now

  if (retryAfterMs > 0) {
    const error = new Error(
      `Refresh manual dapat dilakukan kembali dalam ${Math.ceil(retryAfterMs / 1000)} detik.`
    )
    error.status = 429
    error.retryAfterSeconds = Math.ceil(retryAfterMs / 1000)
    throw error
  }

  lastManualRefreshAt = now

  manualRefreshPromise = (async () => {
    try {
      await Promise.allSettled([
        tahunanLoadingPromise,
        triwulananLoadingPromise
      ].filter(Boolean))

      const rawData = await getDashboardData()
      const tahunanData = mapTahunanData(rawData.tahunan)
      const triwulananData = mapTriwulananData(rawData.triwulanan)
      const loadedAt = Date.now()

      tahunanCache = {
        data: tahunanData,
        loadedAt
      }
      triwulananCache = {
        data: triwulananData,
        loadedAt
      }

      return {
        refreshedAt: new Date(loadedAt).toISOString(),
        total: {
          tahunan: tahunanData.length,
          triwulanan: triwulananData.length
        }
      }
    } finally {
      manualRefreshPromise = null
    }
  })()

  return manualRefreshPromise
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
  warmDashboardCache,
  refreshDashboardCache,

  clearTahunanCache,
  clearTriwulananCache,

  getTahunanCacheInfo,
  getTriwulananCacheInfo
}