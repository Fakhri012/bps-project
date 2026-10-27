

const {
  getCachedTahunanData,
  getCachedTriwulananData,
  refreshDashboardCache,

  getTahunanCacheInfo,
  getTriwulananCacheInfo
} = require(
  '../services/dashboardCacheService'
)

const {
  generateTahunanFilters,
  generateTahunanSummary,

  generateTriwulananFilters,
  generateTriwulananSummary,

  getInstitusiOptions
} = require(
  '../mappers/dashboardMapper'
)

const {
  DASHBOARD_VALUE_UNIT
} = require('../config/dashboardUnits')

const {
  sendInternalServerError
} = require('../utils/httpErrors')


async function getTriwulananSummary(
  req,
  res
) {
  try {
    const data =
      await getCachedTriwulananData()

    const selectedFilters = {
      tahun:
        req.query.tahun || null,

      triwulan:
        req.query.triwulan || null,

      sisi:
        req.query.sisi || null,

      neraca:
        req.query.neraca || null,

      klasifikasi:
        req.query.klasifikasi || null,

      institusi:
        req.query.institusi || null
    }

    const summary =
      generateTriwulananSummary(
        data,
        selectedFilters
      )

res.json({
  success: true,

  periode:
    'triwulanan',

  unit:
    DASHBOARD_VALUE_UNIT,

  selected:
    selectedFilters,

  summary
})
  } catch (error) {
    return sendInternalServerError(
      res,
      'Summary triwulanan',
      'Gagal menghitung summary triwulanan',
      error
    )
  }
}
/*
|--------------------------------------------------------------------------
| PREVIEW DATA TAHUNAN
|--------------------------------------------------------------------------
|
| Semua data Tahunan dibaca dan disimpan di cache.
| Browser hanya menerima 20 baris untuk preview
| agar tidak berat.
|
*/

async function getTahunan(
  req,
  res
) {
  try {
    const data =
      await getCachedTahunanData()

res.json({
  success: true,

  periode: 'tahunan',

  unit: DASHBOARD_VALUE_UNIT,

  total: data.length,

  data: data.slice(0, 20)
})
  } catch (error) {
    return sendInternalServerError(
      res,
      'Preview tahunan',
      'Gagal membaca data tahunan',
      error
    )
  }
}


async function getTriwulanan(
  req,
  res
) {
  try {
    const data =
      await getCachedTriwulananData()

res.json({
  success: true,

  periode: 'triwulanan',

  unit: DASHBOARD_VALUE_UNIT,

  total: data.length,

  data: data.slice(0, 20)
})
  } catch (error) {
    return sendInternalServerError(
      res,
      'Preview triwulanan',
      'Gagal membaca data triwulanan',
      error
    )
  }
}

/*
|--------------------------------------------------------------------------
| HELPER ASSET / DATA DETAIL
|--------------------------------------------------------------------------
|
| Asset berbeda dengan Dashboard utama.
|
| Dashboard:
| - fokus summary / chart
| - beberapa institusi dapat disembunyikan dari UI
|
| Asset:
| - menampilkan data detail
| - NFC Private / NFC Public tetap boleh muncul
| - tidak menggunakan exclusion dashboard
| - menggunakan pagination agar browser tidak berat
|
*/

function parseAssetMultiValue(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return []
  }

  const values =
    Array.isArray(value)
      ? value
      : String(value).split(',')

  return values
    .map(item =>
      String(item).trim()
    )
    .filter(Boolean)
}


/*
|--------------------------------------------------------------------------
| NORMALIZE TEXT UNTUK PERBANDINGAN
|--------------------------------------------------------------------------
*/

function normalizeAssetCompare(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}


/*
|--------------------------------------------------------------------------
| FILTER DATA ASSET
|--------------------------------------------------------------------------
|
| Tidak memakai filterTahunanData / filterTriwulananData
| karena fungsi Dashboard memiliki aturan khusus Dashboard.
|
| Asset harus tetap dapat melihat:
|
| NFC
| NFC PRIVATE
| NFC PUBLIC
| dan data detail lainnya.
|
*/

function filterAssetData(
  data,
  selectedFilters = {}
) {
  let result =
    Array.isArray(data)
      ? [...data]
      : []


  /*
  |--------------------------------------------------------------------------
  | TAHUN
  |--------------------------------------------------------------------------
  */

  const selectedTahun =
    parseAssetMultiValue(
      selectedFilters.tahun
    )
      .map(Number)
      .filter(Number.isFinite)


  if (
    selectedTahun.length > 0
  ) {
    result =
      result.filter(item =>
        selectedTahun.includes(
          Number(item.tahun)
        )
      )
  }


  /*
  |--------------------------------------------------------------------------
  | TRIWULAN
  |--------------------------------------------------------------------------
  */

  const selectedTriwulan =
    parseAssetMultiValue(
      selectedFilters.triwulan
    )
      .map(item =>
        Number(
          String(item)
            .replace(/^Q/i, '')
        )
      )
      .filter(item =>
        Number.isInteger(item) &&
        item >= 1 &&
        item <= 4
      )


  if (
    selectedTriwulan.length > 0
  ) {
    result =
      result.filter(item =>
        selectedTriwulan.includes(
          Number(item.triwulan)
        )
      )
  }


  /*
  |--------------------------------------------------------------------------
  | SISI / JENIS
  |--------------------------------------------------------------------------
  */

  const selectedSisi =
    parseAssetMultiValue(
      selectedFilters.sisi
    )
      .map(item =>
        String(item)
          .trim()
          .toUpperCase()
      )


  if (
    selectedSisi.length > 0
  ) {
    result =
      result.filter(item =>
        selectedSisi.includes(
          String(
            item.sisi ?? ''
          )
            .trim()
            .toUpperCase()
        )
      )
  }


  /*
  |--------------------------------------------------------------------------
  | NERACA
  |--------------------------------------------------------------------------
  */

  const selectedNeraca =
    parseAssetMultiValue(
      selectedFilters.neraca
    )
      .map(
        normalizeAssetCompare
      )


  if (
    selectedNeraca.length > 0
  ) {
    result =
      result.filter(item =>
        selectedNeraca.includes(
          normalizeAssetCompare(
            item.jenisNeraca
          )
        )
      )
  }


  /*
  |--------------------------------------------------------------------------
  | KLASIFIKASI
  |--------------------------------------------------------------------------
  */

  const selectedKlasifikasi =
    parseAssetMultiValue(
      selectedFilters.klasifikasi
    )
      .map(
        normalizeAssetCompare
      )


  if (
    selectedKlasifikasi.length > 0
  ) {
    result =
      result.filter(item =>
        selectedKlasifikasi.includes(
          normalizeAssetCompare(
            item.rincian
          )
        )
      )
  }


  /*
  |--------------------------------------------------------------------------
  | INSTITUSI
  |--------------------------------------------------------------------------
  |
  | Filter menggunakan kode sektor.
  |
  | Contoh:
  |
  | FC
  | FC 2
  | NFC
  | NFC PRIVATE
  | NFC PUBLIC
  |
  */

  const selectedInstitusi =
    parseAssetMultiValue(
      selectedFilters.institusi
    )
      .map(item =>
        String(item)
          .trim()
          .toUpperCase()
      )


  if (
    selectedInstitusi.length > 0
  ) {
    result =
      result.filter(item =>
        selectedInstitusi.includes(
          String(
            item.sektor ?? ''
          )
            .trim()
            .toUpperCase()
        )
      )
  }


  /*
  |--------------------------------------------------------------------------
  | SEARCH
  |--------------------------------------------------------------------------
  |
  | Search dapat mencari:
  |
  | sektor
  | nama institusi
  | periode
  | tahun
  | triwulan
  | sisi
  | neraca
  | kode
  | rincian
  | neraca-rincian
  |
  */

  const keyword =
    normalizeAssetCompare(
      selectedFilters.search
    )


  if (keyword) {
    result =
      result.filter(item => {
        const searchableText = [
          item.sektor,
          item.institusi,
          item.periode,
          item.tahun,

          item.triwulan
            ? `Q${item.triwulan}`
            : '',

          item.sisi,
          item.jenisNeraca,
          item.kode,
          item.rincian,
          item.neracaRincian
        ]
          .map(
            normalizeAssetCompare
          )
          .join(' ')

        return searchableText.includes(
          keyword
        )
      })
  }


  return result
}



function buildTahunanTimeSeries(
  data,
  selectedFilters = {}
) {
  const filteredData =
    filterAssetData(
      data,
      {
        ...selectedFilters,
        search: null,
        triwulan: null
      }
    )

  const grouped =
    new Map()

  filteredData.forEach(
    item => {
      const tahun =
        Number(item.tahun)

      const nilai =
        Number(item.nilai)
      const sektor =
        String(item.sektor ?? '').trim()

      if (
        !Number.isFinite(tahun) ||
        !Number.isFinite(nilai) ||
        !sektor
      ) {
        return
      }

      const key =
        JSON.stringify([tahun, sektor])

      const current =
        grouped.get(key)

      if (current) {
        current.nilai += nilai
        return
      }

      const institusi =
        String(item.institusi ?? sektor).trim()

      grouped.set(key, {
        tahun,
        seriesName: institusi && institusi !== sektor
          ? `${institusi} (${sektor})`
          : sektor,
        nilai
      })
    }
  )

  return Array.from(
    grouped.values()
  ).sort((a, b) =>
    a.tahun - b.tahun ||
    a.seriesName.localeCompare(
      b.seriesName,
      'id',
      {
        numeric: true,
        sensitivity: 'base'
      }
    )
  )
}

function buildTahunanKlasifikasiTimeSeries(
  data,
  selectedFilters = {}
) {
  const filteredData =
    filterAssetData(
      data,
      {
        ...selectedFilters,
        search: null,
        triwulan: null
      }
    )

  return aggregateKlasifikasiTimeSeries(
    filteredData,
    item => {
      const tahun = Number(item.tahun)

      return Number.isInteger(tahun)
        ? {
            tahun,
            periodKey: tahun
          }
        : null
    }
  )
}


function aggregateKlasifikasiTimeSeries(
  data,
  getPeriod
) {
  const grouped = new Map()

  data.forEach(item => {
    const klasifikasi =
      String(item.rincian ?? '').trim()
    const sektor =
      String(item.sektor ?? '').trim()

    const period =
      getPeriod(item)

    if (
      !klasifikasi ||
      !sektor ||
      !period ||
      item.nilai === null ||
      item.nilai === undefined ||
      (
        typeof item.nilai === 'string' &&
        item.nilai.trim() === ''
      )
    ) {
      return
    }

    const nilai = Number(item.nilai)

    if (!Number.isFinite(nilai)) {
      return
    }

    const key =
      JSON.stringify([
        sektor,
        klasifikasi,
        period.periodKey
      ])

    const current =
      grouped.get(key)

    if (current) {
      current.nilai += nilai
      return
    }

    grouped.set(
      key,
      {
        ...period,
        sektor,
        klasifikasi,
        nilai
      }
    )
  })

  return Array.from(
    grouped.values()
  ).sort((a, b) => {
    if (a.periodKey !== b.periodKey) {
      return a.periodKey < b.periodKey ? -1 : 1
    }

    return a.klasifikasi.localeCompare(
      b.klasifikasi,
      'id',
      {
        numeric: true,
        sensitivity: 'base'
      }
    )
  }).map(({ periodKey, ...item }) => item)
}


/*
|--------------------------------------------------------------------------
| BUILD TIME SERIES TRIWULANAN
|--------------------------------------------------------------------------
|
| Mengubah data detail Triwulanan menjadi:
|
| [
|   {
|     tahun: 2022,
|     triwulan: 1,
|     periode: '2022 Q1',
|     nilai: 123
|   }
| ]
|
*/

function buildTriwulananTimeSeries(
  data,
  selectedFilters = {}
) {
  const filteredData =
    filterAssetData(
      data,
      {
        ...selectedFilters,
        search: null
      }
    )

  const grouped =
    new Map()

  filteredData.forEach(
    item => {
      const tahun =
        Number(item.tahun)

      const triwulan =
        Number(item.triwulan)

      const nilai =
        Number(item.nilai)
      const sektor =
        String(item.sektor ?? '').trim()

      if (
        !Number.isFinite(tahun) ||
        !Number.isInteger(triwulan) ||
        triwulan < 1 ||
        triwulan > 4 ||
        !Number.isFinite(nilai) ||
        !sektor
      ) {
        return
      }

      const key =
        JSON.stringify([
          tahun,
          triwulan,
          sektor
        ])

      const current =
        grouped.get(key)

      if (current) {
        current.nilai += nilai
        return
      }

      const institusi =
        String(item.institusi ?? sektor).trim()

      grouped.set(key, {
        tahun,
        triwulan,
        periode: `${tahun} Q${triwulan}`,
        seriesName: institusi && institusi !== sektor
          ? `${institusi} (${sektor})`
          : sektor,
        nilai
      })
    }
  )

  return Array.from(
    grouped.values()
  ).sort(
    (a, b) =>
      a.tahun - b.tahun ||
      a.triwulan - b.triwulan ||
      a.seriesName.localeCompare(
        b.seriesName,
        'id',
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  )
}

function buildTriwulananKlasifikasiTimeSeries(
  data,
  selectedFilters = {}
) {
  const filteredData =
    filterAssetData(
      data,
      {
        ...selectedFilters,
        search: null
      }
    )

  return aggregateKlasifikasiTimeSeries(
    filteredData,
    item => {
      const tahun = Number(item.tahun)
      const triwulan = Number(item.triwulan)

      if (
        !Number.isFinite(tahun) ||
        !Number.isInteger(triwulan) ||
        triwulan < 1 ||
        triwulan > 4
      ) {
        return null
      }

      return {
        tahun,
        triwulan,
        periode: `${tahun} Q${triwulan}`,
        periodKey: tahun * 10 + triwulan
      }
    }
  )
}


  /*
  |--------------------------------------------------------------------------
  | SORT KRONOLOGIS
  |--------------------------------------------------------------------------
  |
  | 2022 Q1
  | 2022 Q2
  | 2022 Q3
  | 2022 Q4
  | 2023 Q1
  |
  */

  
/*
|--------------------------------------------------------------------------
| GENERATE FILTER OPTIONS ASSET
|--------------------------------------------------------------------------
|
| Filter khusus Asset.
|
| Berbeda dari filter Dashboard karena Asset:
|
| - tidak menyembunyikan NFC Private
| - tidak menyembunyikan NFC Public
| - mengambil kode sektor asli
| - tetap cascading
|
*/

function generateAssetFilters(
  data,
  selectedFilters = {},
  periode = 'tahunan'
) {
  /*
  |--------------------------------------------------------------------------
  | HELPER
  |--------------------------------------------------------------------------
  */

  function withoutFilter(key) {
    return {
      ...selectedFilters,
      [key]: null
    }
  }


  function uniqueText(
    rows,
    getter
  ) {
    return [
      ...new Set(
        rows
          .map(getter)
          .map(item =>
            String(
              item ?? ''
            ).trim()
          )
          .filter(Boolean)
      )
    ]
  }


  /*
  |--------------------------------------------------------------------------
  | TAHUN
  |--------------------------------------------------------------------------
  |
  | Filter lain tetap berlaku,
  | tetapi filter tahun sendiri dilepas.
  |
  */

  const tahunData =
    filterAssetData(
      data,
      withoutFilter('tahun')
    )


  const tahun =
    [
      ...new Set(
        tahunData
          .map(item =>
            Number(item.tahun)
          )
          .filter(
            Number.isFinite
          )
        )
      ]


  /*
  |--------------------------------------------------------------------------
  | TRIWULAN
  |--------------------------------------------------------------------------
  */

  let triwulan = []


  if (
    periode ===
    'triwulanan'
  ) {
    const triwulanData =
      filterAssetData(
        data,
        withoutFilter(
          'triwulan'
        )
      )


    triwulan =
      [
        ...new Set(
          triwulanData
            .map(item =>
              Number(
                item.triwulan
              )
            )
            .filter(item =>
              Number.isInteger(
                item
              ) &&
              item >= 1 &&
              item <= 4
            )
        )
      ]
  }


  /*
  |--------------------------------------------------------------------------
  | SISI / JENIS
  |--------------------------------------------------------------------------
  */

  const sisiData =
    filterAssetData(
      data,
      withoutFilter('sisi')
    )


  const sisi =
    uniqueText(
      sisiData,
      item => item.sisi
    )


  /*
  |--------------------------------------------------------------------------
  | NERACA
  |--------------------------------------------------------------------------
  */

  const neracaData =
    filterAssetData(
      data,
      withoutFilter(
        'neraca'
      )
    )


  const neraca =
    uniqueText(
      neracaData,
      item =>
        item.jenisNeraca
    )


  /*
  |--------------------------------------------------------------------------
  | KLASIFIKASI
  |--------------------------------------------------------------------------
  */

  const klasifikasiData =
    filterAssetData(
      data,
      withoutFilter(
        'klasifikasi'
      )
    )


  const klasifikasi =
    uniqueText(
      klasifikasiData,
      item =>
        item.rincian
    )


  /*
  |--------------------------------------------------------------------------
  | INSTITUSI
  |--------------------------------------------------------------------------
  |
  | VALUE = kode sektor asli.
  |
  | Contoh:
  |
  | NFC
  | NFC PRIVATE
  | NFC PUBLIC
  | FC
  | FC 2
  |
  */

  const institusiData =
    filterAssetData(
      data,
      withoutFilter(
        'institusi'
      )
    )


  const institusiMap =
    new Map()


  institusiData.forEach(
    item => {
      const kode =
        String(
          item.sektor ?? ''
        ).trim()


      if (!kode) {
        return
      }


      const nama =
        String(
          item.institusi ??
          kode
        ).trim()


      /*
       * Kode tetap ditampilkan agar
       * sektor seperti FC dan FC 2
       * tidak membingungkan.
       */

      const label =
        nama &&
        nama !== kode

          ? `${nama} (${kode})`

          : kode


      if (
        !institusiMap.has(
          kode
        )
      ) {
        institusiMap.set(
          kode,
          {
            value: kode,
            label
          }
        )
      }
    }
  )


  const institusi =
    Array.from(
      institusiMap.values()
    )


  /*
  |--------------------------------------------------------------------------
  | RESPONSE FILTER
  |--------------------------------------------------------------------------
  */

  return {
    tahun,

    triwulan,

    sisi,

    neraca,

    klasifikasi,

    institusi
  }
}

/*
|--------------------------------------------------------------------------
| BUILD RESPONSE ASSET
|--------------------------------------------------------------------------
*/

function buildAssetResponse(
  data,
  query,
  periode
) {
  /*
   * PAGE
   */

  const requestedPage =
    Number(query.page)

  let page =
    Number.isInteger(
      requestedPage
    ) &&
    requestedPage > 0
      ? requestedPage
      : 1


  /*
   * LIMIT
   *
   * UI nanti menyediakan:
   *
   * 25
   * 50
   * 100
   */

  const allowedLimits = [
    25,
    50,
    100
  ]

  const requestedLimit =
    Number(query.limit)

  const limit =
    allowedLimits.includes(
      requestedLimit
    )
      ? requestedLimit
      : 25


  /*
   * FILTER
   */

  const selectedFilters = {
    tahun:
      query.tahun || null,

    triwulan:
      query.triwulan || null,

    sisi:
      query.sisi || null,

    neraca:
      query.neraca || null,

    klasifikasi:
      query.klasifikasi || null,

    institusi:
      query.institusi || null,

    search:
      query.search || null
  }


  const filteredData =
    filterAssetData(
      data,
      selectedFilters
    )


  /*
   * PAGINATION
   */

  const total =
    filteredData.length

  const totalPages =
    total > 0
      ? Math.ceil(
          total / limit
        )
      : 0


  /*
   * Kalau user meminta page lebih besar
   * daripada total halaman,
   * pindahkan ke halaman terakhir.
   */

  if (
    totalPages > 0 &&
    page > totalPages
  ) {
    page =
      totalPages
  }


  const startIndex =
    (page - 1) *
    limit

  const endIndex =
    startIndex +
    limit


  const paginatedData =
    filteredData.slice(
      startIndex,
      endIndex
    )


  return {
    success: true,

    periode,

    unit: DASHBOARD_VALUE_UNIT,

    selected:
      selectedFilters,

    pagination: {
      page,

      limit,

      total,

      totalPages,

      from:
        total === 0
          ? 0
          : startIndex + 1,

      to:
        Math.min(
          endIndex,
          total
        )
    },

    data:
      paginatedData
  }
}


/*
|--------------------------------------------------------------------------
| ASSET TAHUNAN
|--------------------------------------------------------------------------
*/

async function getTahunanAsset(
  req,
  res
) {
  try {
    /*
     * Seluruh data tetap berasal
     * dari cache.
     */

    const data =
      await getCachedTahunanData()


    const response =
      buildAssetResponse(
        data,
        req.query,
        'tahunan'
      )


    res.json(
      response
    )

  } catch (error) {
    return sendInternalServerError(
      res,
      'Asset tahunan',
      'Gagal mengambil data Asset Tahunan',
      error
    )
  }
}


/*
|--------------------------------------------------------------------------
| ASSET TRIWULANAN
|--------------------------------------------------------------------------
*/

async function getTriwulananAsset(
  req,
  res
) {
  try {
    /*
     * Seluruh data tetap berasal
     * dari cache.
     */

    const data =
      await getCachedTriwulananData()


    const response =
      buildAssetResponse(
        data,
        req.query,
        'triwulanan'
      )


    res.json(
      response
    )

  } catch (error) {
    return sendInternalServerError(
      res,
      'Asset triwulanan',
      'Gagal mengambil data Asset Triwulanan',
      error
    )
  }
}

/*
|--------------------------------------------------------------------------
| FILTER ASSET TAHUNAN
|--------------------------------------------------------------------------
*/

async function getTahunanAssetFilters(
  req,
  res
) {
  try {
    const data =
      await getCachedTahunanData()


    const selectedFilters = {
      tahun:
        req.query.tahun ||
        null,

      triwulan:
        null,

      sisi:
        req.query.sisi ||
        null,

      neraca:
        req.query.neraca ||
        null,

      klasifikasi:
        req.query.klasifikasi ||
        null,

      institusi:
        req.query.institusi ||
        null
    }


    const filters =
      generateAssetFilters(
        data,
        selectedFilters,
        'tahunan'
      )


    res.json({
      success: true,

      periode:
        'tahunan',

      selected:
        selectedFilters,

      filters
    })

  } catch (error) {
    return sendInternalServerError(
      res,
      'Filter Asset tahunan',
      'Gagal mengambil filter Asset Tahunan',
      error
    )
  }
}


/*
|--------------------------------------------------------------------------
| FILTER ASSET TRIWULANAN
|--------------------------------------------------------------------------
*/

async function getTriwulananAssetFilters(
  req,
  res
) {
  try {
    const data =
      await getCachedTriwulananData()


    const selectedFilters = {
      tahun:
        req.query.tahun ||
        null,

      triwulan:
        req.query.triwulan ||
        null,

      sisi:
        req.query.sisi ||
        null,

      neraca:
        req.query.neraca ||
        null,

      klasifikasi:
        req.query.klasifikasi ||
        null,

      institusi:
        req.query.institusi ||
        null
    }


    const filters =
      generateAssetFilters(
        data,
        selectedFilters,
        'triwulanan'
      )


    res.json({
      success: true,

      periode:
        'triwulanan',

      selected:
        selectedFilters,

      filters
    })

  } catch (error) {
    return sendInternalServerError(
      res,
      'Filter Asset triwulanan',
      'Gagal mengambil filter Asset Triwulanan',
      error
    )
  }
}


/*
|--------------------------------------------------------------------------
| TIME SERIES TAHUNAN
|--------------------------------------------------------------------------
|
| Endpoint:
|
| GET /api/dashboard/timeseries/tahunan
|
*/

async function getTahunanTimeSeries(
  req,
  res
) {
  try {
    /*
     * Mengambil seluruh data Tahunan
     * dari cache yang sudah tersedia.
     */

    const data =
      await getCachedTahunanData()


    /*
     * Filter yang didukung Time Series.
     */

    const selectedFilters = {
      tahun:
        req.query.tahun ||
        null,

      sisi:
        req.query.sisi ||
        null,

      neraca:
        req.query.neraca ||
        null,

      klasifikasi:
        req.query.klasifikasi ||
        null,

      institusi:
        req.query.institusi ||
        null
    }


    /*
     * Bangun data grafik.
     */

    const timeSeries =
      buildTahunanTimeSeries(
        data,
        selectedFilters
      )

    const statistikKlasifikasi =
      buildTahunanKlasifikasiTimeSeries(
        data,
        selectedFilters
      )


res.json({
  success: true,

  periode: 'tahunan',

  unit: DASHBOARD_VALUE_UNIT,

  selected: selectedFilters,

  totalPoints: timeSeries.length,

  data: timeSeries,

  statistikKlasifikasi
})

  } catch (error) {
    return sendInternalServerError(
      res,
      'Time Series tahunan',
      'Gagal mengambil Time Series Tahunan',
      error
    )
  }
}

/*
|--------------------------------------------------------------------------
| TIME SERIES TRIWULANAN
|--------------------------------------------------------------------------
|
| Endpoint:
|
| GET /api/dashboard/timeseries/triwulanan
|
*/

async function getTriwulananTimeSeries(
  req,
  res
) {
  try {
    /*
     * Mengambil semua data Triwulanan
     * dari cache.
     */

    const data =
      await getCachedTriwulananData()


    /*
     * Filter yang didukung.
     */

    const selectedFilters = {
      tahun:
        req.query.tahun ||
        null,

      triwulan:
        req.query.triwulan ||
        null,

      sisi:
        req.query.sisi ||
        null,

      neraca:
        req.query.neraca ||
        null,

      klasifikasi:
        req.query.klasifikasi ||
        null,

      institusi:
        req.query.institusi ||
        null
    }


    const timeSeries =
      buildTriwulananTimeSeries(
        data,
        selectedFilters
      )

    const statistikKlasifikasi =
      buildTriwulananKlasifikasiTimeSeries(
        data,
        selectedFilters
      )


res.json({
  success: true,

  periode: 'triwulanan',

  unit: DASHBOARD_VALUE_UNIT,

  selected: selectedFilters,

  totalPoints: timeSeries.length,

  data: timeSeries,

  statistikKlasifikasi
})

  } catch (error) {
    return sendInternalServerError(
      res,
      'Time Series triwulanan',
      'Gagal mengambil Time Series Triwulanan',
      error
    )
  }
}

function getLatestAnnualYear(data) {
  let latestYear = null

  data.forEach(item => {
    const year = Number(item.tahun)
    const hasQuarter =
      item.triwulan !== null &&
      item.triwulan !== undefined &&
      String(item.triwulan).trim() !== ''

    if (
      !hasQuarter &&
      Number.isInteger(year) &&
      (latestYear === null || year > latestYear)
    ) {
      latestYear = year
    }
  })

  return latestYear
}

function getPreviousAnnualYear(data, latestYear) {
  if (!Number.isInteger(latestYear)) {
    return null
  }

  let previousYear = null

  data.forEach(item => {
    const year = Number(item.tahun)
    const hasQuarter =
      item.triwulan !== null &&
      item.triwulan !== undefined &&
      String(item.triwulan).trim() !== ''

    if (
      !hasQuarter &&
      Number.isInteger(year) &&
      year < latestYear &&
      (previousYear === null || year > previousYear)
    ) {
      previousYear = year
    }
  })

  return previousYear
}

function getLandingNationalIndicators(data, latestYear) {
  if (!Number.isInteger(latestYear)) {
    return []
  }

  const specificSources = {
    'Nilai tambah bruto': {
      sisi: 'PENGGUNAAN',
      jenisNeraca: 'Neraca Produksi',
      kode: 'B1g'
    },
    'Pendapatan nasional bruto (PNB)': {
      sisi: 'PENGGUNAAN',
      jenisNeraca: 'Neraca Alokasi Pendapatan Primer',
      kode: 'B5g'
    },
    'Pendapatan disposabel bruto': {
      sisi: 'PENGGUNAAN',
      jenisNeraca: 'Neraca Distribusi Pendapatan Sekunder',
      kode: 'B6g'
    },
    'Tabungan bruto': {
      sisi: 'PENGGUNAAN',
      jenisNeraca: 'Neraca Penggunaan Pendapatan Disposabel',
      kode: 'B8g'
    },
    'Net lending/net borrowing': {
      sisi: 'PENGGUNAAN',
      jenisNeraca: 'Neraca Kapital',
      kode: 'B9'
    }
  }
  const grouped = new Map()

  data.forEach(item => {
    const year = Number(item.tahun)
    const hasQuarter =
      item.triwulan !== null &&
      item.triwulan !== undefined &&
      String(item.triwulan).trim() !== ''
    const sector = String(item.sektor ?? '').trim()
    const classification = String(item.rincian ?? '').trim()

    if (
      sector !== 'TOTAL EKN' ||
      !classification ||
      !Number.isInteger(year) ||
      year !== latestYear ||
      hasQuarter ||
      item.nilai === null ||
      item.nilai === undefined ||
      (typeof item.nilai === 'string' && item.nilai.trim() === '')
    ) {
      return
    }

    const value = Number(item.nilai)

    if (!Number.isFinite(value)) {
      return
    }

    const source = specificSources[classification]

    if (source) {
      const matchesSource =
        String(item.sisi ?? '').trim().toLocaleUpperCase('id-ID') === source.sisi &&
        String(item.jenisNeraca ?? '').trim().toLocaleLowerCase('id-ID') ===
          source.jenisNeraca.toLocaleLowerCase('id-ID') &&
        String(item.kode ?? '').trim().toLocaleUpperCase('id-ID') ===
          source.kode.toLocaleUpperCase('id-ID')

      if (matchesSource && !grouped.has(classification)) {
        grouped.set(classification, value)
      }

      return
    }

    grouped.set(
      classification,
      (grouped.get(classification) || 0) + value
    )
  })

  return Array.from(grouped, ([klasifikasi, nilai]) => ({
    klasifikasi,
    nilai
  })).sort((first, second) =>
    first.klasifikasi.localeCompare(
      second.klasifikasi,
      'id',
      { numeric: true, sensitivity: 'base' }
    )
  )
}

async function getLandingOverview(
  req,
  res
) {
  try {
    const annualData = await getCachedTahunanData()
    const latestAnnualYear = getLatestAnnualYear(annualData)
    const previousAnnualYear = getPreviousAnnualYear(
      annualData,
      latestAnnualYear
    )
    const latestPeriod = latestAnnualYear === null
      ? null
      : {
          frequency: 'tahunan',
          year: latestAnnualYear,
          quarter: null,
          label: String(latestAnnualYear)
        }
    const nationalIndicators = getLandingNationalIndicators(
      annualData,
      latestAnnualYear
    )
    const previousNationalIndicators = getLandingNationalIndicators(
      annualData,
      previousAnnualYear
    )
    const previousPeriod = previousAnnualYear === null
      ? null
      : {
          frequency: 'tahunan',
          year: previousAnnualYear,
          label: String(previousAnnualYear)
        }

    res.json({
      success: true,
      unit: DASHBOARD_VALUE_UNIT,
      latestPeriod,
      nationalIndicators: {
        sector: 'TOTAL EKN',
        period: latestPeriod?.label || null,
        values: nationalIndicators
      },
      previousPeriod,
      previousNationalIndicators: {
        sector: 'TOTAL EKN',
        period: previousPeriod?.label || null,
        values: previousNationalIndicators
      }
    })
  } catch (error) {
    return sendInternalServerError(
      res,
      'Landing overview',
      'Gagal mengambil ringkasan landing statistik',
      error
    )
  }
}


async function getTahunanInstitusi(
  req,
  res
) {
  try {
    const data =
      await getCachedTahunanData()

    const institusi =
      getInstitusiOptions(
        data
      )

    res.json({
      success: true,

      periode:
        'tahunan',

      total:
        institusi.length,

      institusi
    })
  } catch (error) {
    return sendInternalServerError(
      res,
      'Institusi tahunan',
      'Gagal mengambil daftar institusi tahunan',
      error
    )
  }
}


async function getTahunanFilters(
  req,
  res
) {
  try {
    const data =
      await getCachedTahunanData()

    const selectedFilters = {
      tahun:
        req.query.tahun || null,

      sisi:
        req.query.sisi || null,

      neraca:
        req.query.neraca || null,

      klasifikasi:
        req.query.klasifikasi || null
    }

    const filters =
      generateTahunanFilters(
        data,
        selectedFilters
      )

    res.json({
      success: true,

      periode:
        'tahunan',

      selected:
        selectedFilters,

      filters
    })
  } catch (error) {
    return sendInternalServerError(
      res,
      'Filter tahunan',
      'Gagal mengambil filter tahunan',
      error
    )
  }
}



async function getTahunanSummary(
  req,
  res
) {
  try {
    const data =
      await getCachedTahunanData()

    const selectedFilters = {
      tahun:
        req.query.tahun || null,

      sisi:
        req.query.sisi || null,

      neraca:
        req.query.neraca || null,

      klasifikasi:
        req.query.klasifikasi || null,

      institusi:
        req.query.institusi || null
    }

    const summary =
      generateTahunanSummary(
        data,
        selectedFilters
      )

res.json({
  success: true,

  periode: 'tahunan',

  unit: DASHBOARD_VALUE_UNIT,

  selected: selectedFilters,

  summary
})
  } catch (error) {
    return sendInternalServerError(
      res,
      'Summary tahunan',
      'Gagal menghitung summary tahunan',
      error
    )
  }
}


async function getTriwulananFilters(
  req,
  res
) {
  try {
    const data =
      await getCachedTriwulananData()

    const selectedFilters = {
      tahun:
        req.query.tahun || null,

      triwulan:
        req.query.triwulan || null,

      sisi:
        req.query.sisi || null,

      neraca:
        req.query.neraca || null,

      klasifikasi:
        req.query.klasifikasi || null
    }

    const filters =
      generateTriwulananFilters(
        data,
        selectedFilters
      )

    res.json({
      success: true,

      periode:
        'triwulanan',

      selected:
        selectedFilters,

      filters
    })
  } catch (error) {
    return sendInternalServerError(
      res,
      'Filter triwulanan',
      'Gagal mengambil filter triwulanan',
      error
    )
  }
}

function getCacheInfo(
  req,
  res
) {
  try {
    const tahunan =
      getTahunanCacheInfo()

    const triwulanan =
      getTriwulananCacheInfo()

    res.json({
      success: true,

      cache: {
        tahunan,
        triwulanan
      }
    })
  } catch (error) {
    return sendInternalServerError(
      res,
      'Cache info',
      'Gagal mengambil informasi cache',
      error
    )
  }
}



async function refreshCache(
  req,
  res
) {
  try {
    const result =
      await refreshDashboardCache()

    res.json({
      success: true,

      message:
        'Cache Tahunan dan Triwulanan berhasil diperbarui',
      ...result
    })
  } catch (error) {
    if (error.status === 429) {
      res.setHeader(
        'Retry-After',
        String(error.retryAfterSeconds)
      )

      return res.status(429).json({
        success: false,
        message: error.message,
        retryAfterSeconds: error.retryAfterSeconds
      })
    }

    return sendInternalServerError(
      res,
      'Refresh cache',
      'Gagal memperbarui cache dari Google Sheets. Cache sebelumnya tetap digunakan jika tersedia.',
      error
    )
  }
}


/*
|--------------------------------------------------------------------------
| EXPORT CONTROLLER
|--------------------------------------------------------------------------
*/

module.exports = {
  /*
   * Preview
   */

  getTahunan,
  getTriwulanan,


  /*
   * Filter Dashboard
   */

  getTahunanFilters,
  getTriwulananFilters,

/*
 * Asset / Data Detail
 */

getTahunanAsset,
getTriwulananAsset,

getTahunanAssetFilters,
getTriwulananAssetFilters,

  /*
   * Institusi
   */

  getTahunanInstitusi,


  /*
   * Summary Dashboard
   */

  getTahunanSummary,
  getTriwulananSummary,
  getLandingOverview,
  getLatestAnnualYear,
  getPreviousAnnualYear,
  getLandingNationalIndicators,


/*
 * Time Series
 */

getTahunanTimeSeries,
getTriwulananTimeSeries,
buildTahunanTimeSeries,
buildTriwulananTimeSeries,
buildTahunanKlasifikasiTimeSeries,
buildTriwulananKlasifikasiTimeSeries,


  /*
   * Cache
   */

  getCacheInfo,
  refreshCache
}