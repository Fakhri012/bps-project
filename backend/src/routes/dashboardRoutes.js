const express =
  require('express')


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
  refreshCache
)


module.exports =
  router