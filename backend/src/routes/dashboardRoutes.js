const express =
  require('express')
const getAllowedOrigins =
  require('../config/allowedOrigins')


const {
  /*
   * Preview
   */

  getTahunan,
  getTriwulanan,

  getTahunanTimeSeries,
  getTriwulananTimeSeries,
  /*
   * Filters
   */

  getTahunanFilters,
  getTriwulananFilters,


  /*
   * Summary
   */

  getTriwulananSummary,
  getTahunanSummary,
  getLandingOverview,


  /*
   * Institusi
   */

  getTahunanInstitusi,


/*
  * Asset / Data Detail
  */

  getTahunanAsset,
  getTriwulananAsset,

  getTahunanAssetFilters,
  getTriwulananAssetFilters,


  /*
   * Cache
   */

  getCacheInfo,
  refreshCache
} = require(
  '../controllers/dashboardController'
)


const router =
  express.Router()

function requireAllowedRefreshOrigin(req, res, next) {
  const origin = req.get('origin')

  if (!origin || !getAllowedOrigins().includes(origin)) {
    return res.status(403).json({
      success: false,
      message: 'Permintaan refresh harus berasal dari aplikasi yang diizinkan.'
    })
  }

  return next()
}


/*
|--------------------------------------------------------------------------
| PREVIEW DATA
|--------------------------------------------------------------------------
*/

router.get(
  '/tahunan',
  getTahunan
)


router.get(
  '/triwulanan',
  getTriwulanan
)

/*
|--------------------------------------------------------------------------
| TIME SERIES
|--------------------------------------------------------------------------
*/

router.get(
  '/timeseries/tahunan',
  getTahunanTimeSeries
)


router.get(
  '/timeseries/triwulanan',
  getTriwulananTimeSeries
)

/*
|--------------------------------------------------------------------------
| SUMMARY
|--------------------------------------------------------------------------
*/

router.get(
  '/summary/tahunan',
  getTahunanSummary
)


router.get(
  '/summary/triwulanan',
  getTriwulananSummary
)


router.get(
  '/overview',
  getLandingOverview
)


/*
|--------------------------------------------------------------------------
| FILTER
|--------------------------------------------------------------------------
*/

router.get(
  '/filters/tahunan',
  getTahunanFilters
)


router.get(
  '/filters/triwulanan',
  getTriwulananFilters
)


/*
|--------------------------------------------------------------------------
| INSTITUSI
|--------------------------------------------------------------------------
*/

router.get(
  '/institusi/tahunan',
  getTahunanInstitusi
)


/*
|--------------------------------------------------------------------------
| ASSET / DATA DETAIL
|--------------------------------------------------------------------------
*/

router.get(
  '/asset/tahunan',
  getTahunanAsset
)


router.get(
  '/asset/triwulanan',
  getTriwulananAsset
)

/*
|--------------------------------------------------------------------------
| FILTER ASSET
|--------------------------------------------------------------------------
*/

router.get(
  '/asset/filters/tahunan',
  getTahunanAssetFilters
)


router.get(
  '/asset/filters/triwulanan',
  getTriwulananAssetFilters
)

/*
|--------------------------------------------------------------------------
| CACHE
|--------------------------------------------------------------------------
*/

router.get(
  '/cache',
  getCacheInfo
)


router.post(
  '/cache/refresh',
  requireAllowedRefreshOrigin,
  refreshCache
)


module.exports =
  router