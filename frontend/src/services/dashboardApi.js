import axios from 'axios'

/*
|--------------------------------------------------------------------------
| API CONFIG
|--------------------------------------------------------------------------
|
| Semua komunikasi dashboard ke backend
| melewati file ini.
|
| Development:
| Frontend = http://localhost:5173
| Backend  = http://localhost:3001
|
*/

const developmentApiBaseUrl = import.meta.env.DEV
  ? 'http://localhost:3001/api/dashboard'
  : undefined

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || developmentApiBaseUrl

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL must be set for production builds')
}

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000
})

export default api



function buildParams(filters = {}) {
  const params = {}

  Object.entries(filters).forEach(
    ([key, value]) => {
      if (
        value === null ||
        value === undefined ||
        value === ''
      ) {
        return
      }

      /*
       * Array multi-select
       *
       * Contoh:
       *
       * ['2020', '2021']
       *
       * menjadi:
       *
       * 2020,2021
       */

      if (Array.isArray(value)) {
        if (value.length === 0) {
          return
        }

        params[key] =
          value.join(',')

        return
      }

      params[key] = value
    }
  )

  return params
}


/*
|--------------------------------------------------------------------------
| FILTER DASHBOARD TAHUNAN
|--------------------------------------------------------------------------
*/

export async function getTahunanFilters(
  filters = {}
) {
  const response =
    await api.get(
      '/filters/tahunan',
      {
        params:
          buildParams(filters)
      }
    )

  return response.data
}


/*
|--------------------------------------------------------------------------
| FILTER DASHBOARD TRIWULANAN
|--------------------------------------------------------------------------
*/

export async function getTriwulananFilters(
  filters = {}
) {
  const response =
    await api.get(
      '/filters/triwulanan',
      {
        params:
          buildParams(filters)
      }
    )

  return response.data
}


/*
|--------------------------------------------------------------------------
| SUMMARY DASHBOARD TAHUNAN
|--------------------------------------------------------------------------
*/

export async function getTahunanSummary(
  filters = {}
) {
  const response =
    await api.get(
      '/summary/tahunan',
      {
        params:
          buildParams(filters)
      }
    )

  return response.data
}


/*
|--------------------------------------------------------------------------
| SUMMARY DASHBOARD TRIWULANAN
|--------------------------------------------------------------------------
*/

export async function getTriwulananSummary(
  filters = {}
) {
  const response =
    await api.get(
      '/summary/triwulanan',
      {
        params:
          buildParams(filters)
      }
    )

  return response.data
}


/*
|--------------------------------------------------------------------------
| PREVIEW TAHUNAN
|--------------------------------------------------------------------------
|
| Digunakan untuk debug / pengecekan data.
|
*/

export async function getTahunanPreview() {
  const response =
    await api.get(
      '/tahunan'
    )

  return response.data
}


/*
|--------------------------------------------------------------------------
| PREVIEW TRIWULANAN
|--------------------------------------------------------------------------
|
| Digunakan untuk debug / pengecekan data.
|
*/

export async function getTriwulananPreview() {
  const response =
    await api.get(
      '/triwulanan'
    )

  return response.data
}


/*
|--------------------------------------------------------------------------
| CACHE INFO
|--------------------------------------------------------------------------
*/

export async function getCacheInfo() {
  const response =
    await api.get(
      '/cache'
    )

  return response.data
}


/*
|--------------------------------------------------------------------------
| REFRESH CACHE
|--------------------------------------------------------------------------
*/

export async function refreshCache() {
  const response =
    await api.post(
      '/cache/refresh'
    )

  return response.data
}


/*
|--------------------------------------------------------------------------
| ASSET / DATA DETAIL TAHUNAN
|--------------------------------------------------------------------------
|
| Mengambil data detail Asset Tahunan.
|
| Mendukung:
|
| - filter
| - search
| - pagination
| - limit
|
*/

export async function getTahunanAsset(
  params = {}
) {
  const response =
    await api.get(
      '/asset/tahunan',
      {
        params:
          buildParams(params)
      }
    )

  return response.data
}


/*
|--------------------------------------------------------------------------
| ASSET / DATA DETAIL TRIWULANAN
|--------------------------------------------------------------------------
*/

export async function getTriwulananAsset(
  params = {}
) {
  const response =
    await api.get(
      '/asset/triwulanan',
      {
        params:
          buildParams(params)
      }
    )

  return response.data
}


/*
|--------------------------------------------------------------------------
| FILTER ASSET TAHUNAN
|--------------------------------------------------------------------------
|
| Filter khusus halaman Asset.
|
| Berbeda dari filter Dashboard utama karena
| halaman Asset tetap dapat menampilkan data
| detail seperti:
|
| - NFC
| - NFC Private
| - NFC Public
| - sektor detail lainnya
|
*/

export async function getTahunanAssetFilters(
  filters = {}
) {
  const response =
    await api.get(
      '/asset/filters/tahunan',
      {
        params:
          buildParams(filters)
      }
    )

  return response.data
}


/*
|--------------------------------------------------------------------------
| FILTER ASSET TRIWULANAN
|--------------------------------------------------------------------------
*/

export async function getTriwulananAssetFilters(
  filters = {}
) {
  const response =
    await api.get(
      '/asset/filters/triwulanan',
      {
        params:
          buildParams(filters)
      }
    )

  return response.data
}

/*
|--------------------------------------------------------------------------
| TIME SERIES TAHUNAN
|--------------------------------------------------------------------------
|
| Mengambil data agregasi tahunan untuk grafik Time Series.
|
*/

export async function getTahunanTimeSeries(
  filters = {}
) {
  const response =
    await api.get(
      '/timeseries/tahunan',
      {
        params:
          buildParams(filters)
      }
    )

  return response.data
}


/*
|--------------------------------------------------------------------------
| TIME SERIES TRIWULANAN
|--------------------------------------------------------------------------
|
| Mengambil data agregasi triwulanan untuk grafik Time Series.
|
*/

export async function getTriwulananTimeSeries(
  filters = {}
) {
  const response =
    await api.get(
      '/timeseries/triwulanan',
      {
        params:
          buildParams(filters)
      }
    )

  return response.data
}