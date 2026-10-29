<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  nextTick,
  ref,
  toRef,
  watch
} from 'vue'

import VChart from 'vue-echarts'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Search,
  RotateCcw,
  SlidersHorizontal,
  BookOpen,
  X
} from 'lucide-vue-next'
import MultiSelectFilter
  from '../components/dashboard/MultiSelectFilter.vue'

import ExportActions
  from '../components/ExportActions.vue'

import { use } from 'echarts/core'

import { LineChart } from 'echarts/charts'

import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent
} from 'echarts/components'

import { CanvasRenderer } from 'echarts/renderers'

import {
  CACHE_REFRESH_EVENT,
  getAnalisisRasio
} from '../services/dashboardApi'

import {
  clearSharedFilter,
  setSharedFilter,
  usePersistentFilterState
} from '../composables/filterState.js'

import {
  formatDisplayNumber
} from '../utils/displayFormatters.js'

import {
  prioritizeSectorOptions
} from '../utils/dashboardText.js'

import {
  buildRatioCsvExportData,
  canExportRatioCsv,
  getRatioTypesForSectors,
  normalizeRatioSektor
} from '../utils/ratioAnalysis.js'

import {
  buildExportFilename,
  downloadCsvFile,
  exportChartsPdf
} from '../utils/reportExport.js'


use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer
])


/*
|--------------------------------------------------------------------------
| DATA
|--------------------------------------------------------------------------
*/

const data = ref([])

const loading = ref(false)

const exportingRatioPdf = ref(false)

const error = ref('')

/*
|--------------------------------------------------------------------------
| FILTER
|--------------------------------------------------------------------------
*/

const {
  state: savedFilters,
  sharedFilters
} =
  usePersistentFilterState('analisisRasio', {
    sektor: [],
    periode: [],
    jenisRasio: [],
    tableSearch: ''
  })

const selectedSektor = toRef(savedFilters, 'sektor')

const isSektorOpen = ref(false)

const selectedPeriode = toRef(savedFilters, 'periode')

const selectedJenisRasio = toRef(savedFilters, 'jenisRasio')

const ratioChartMode = ref('Tahunan')

const activeFilterCount = computed(() =>
  selectedSektor.value.length +
  selectedPeriode.value.length +
  selectedJenisRasio.value.length
)


/*
|--------------------------------------------------------------------------
| PAGINATION
|--------------------------------------------------------------------------
*/

const currentPage = ref(1)

const tableSearch = toRef(savedFilters, 'tableSearch')

const itemsPerPage = ref(10)

const tableSortKey = ref('periode')

const tableSortDirection = ref('asc')


/*
|--------------------------------------------------------------------------
| JENIS RASIO
|--------------------------------------------------------------------------
*/

const ratioTypes = [
  'COE/VA',
  'PMTB/DI',
  'IA/Output'
]

function isExcludedRatioType(value) {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .toUpperCase() === 'PNB/PDB'
}


const ratioDescriptions = {
  'COE/VA':
    'Kompensasi Tenaga Kerja / Nilai Tambah Bruto',

  'PMTB/DI':
    'Pembentukan Modal Tetap Bruto / Pendapatan Disposabel Bruto',

  'IA/Output':
    'Konsumsi Antara / Output',

  'KMT/PMTB':
    'Rasio pinjaman neto terhadap pembentukan modal tetap bruto',

  'NET/NTB':
    'Neraca neto sektoral terhadap nilai tambah bruto',

  'CAB/GDP':
    'Keseimbangan Eksternal Berjalan / Nilai Tambah Bruto'
}


/*
|--------------------------------------------------------------------------
| LOAD DATA
|--------------------------------------------------------------------------
*/

async function loadData() {

  loading.value = true

  error.value = ''

  try {

    const response =
      await getAnalisisRasio()

    data.value =
      Array.isArray(response?.data)
        ? response.data
        : []

    selectedJenisRasio.value = selectedJenisRasio.value
      .filter(ratio => !isExcludedRatioType(ratio))

  } catch (err) {

    console.error(
      'Error load Analisis Rasio:',
      err
    )

    error.value =
      err?.response?.data?.message ||
      err?.message ||
      'Gagal mengambil data Analisis Rasio'

  } finally {

    loading.value = false

  }
}


/*
|--------------------------------------------------------------------------
| RESET SEKTOR
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| HELPER
|--------------------------------------------------------------------------
*/

function isQuarterly(periode) {

  return String(periode ?? '')
    .includes('/Q')

}


function isAnnual(periode) {

  return !isQuarterly(periode)

}


const sectorDisplayNames = {
  FC: 'Korporasi Finansial',
  NFC: 'Korporasi Nonfinansial',
  HH: 'Rumah Tangga',
  GG: 'Pemerintah Umum',
  NPISHS: 'Lembaga Non-Profit',
  ROW: 'Luar Negeri',
  'TOTAL EKN': 'Total Perekonomian',
  TOTAL: 'Total',
  CB: 'Bank Sentral',
  ODC: 'Lembaga Keuangan Lainnya'
}


function getSectorName(sektor) {

  return sectorDisplayNames[sektor] || sektor

}


/*
|--------------------------------------------------------------------------
| RAW VALUE
|--------------------------------------------------------------------------
|
| Nilai untuk tabel/KPI tetap mengikuti nilai sumber.
|
*/

function rawValue(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {

    return '-'

  }

  return String(value)

}


/*
|--------------------------------------------------------------------------
| NUMERIC VALUE
|--------------------------------------------------------------------------
|
| Digunakan hanya untuk kebutuhan:
| - agregasi
| - grafik
|
*/

function numericValue(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {

    return null

  }


  if (typeof value === 'number') {

    return Number.isFinite(value)
      ? value
      : null

  }

  const normalized = String(value).trim()
  const lastComma = normalized.lastIndexOf(',')
  const lastPeriod = normalized.lastIndexOf('.')
  let numericText = normalized


  if (lastComma >= 0 && lastPeriod >= 0) {

    const decimalSeparator = lastComma > lastPeriod ? ',' : '.'
    const groupingSeparator = decimalSeparator === ',' ? '.' : ','

    numericText = normalized
      .replaceAll(groupingSeparator, '')
      .replace(decimalSeparator, '.')

  } else if (lastComma >= 0) {

    numericText = normalized.replace(',', '.')

  }


  const parsed = Number(numericText)

  return Number.isFinite(parsed)
    ? parsed
    : null

}

function formatRatioValue(value) {
  const number = numericValue(value)

  return number === null
    ? value ?? '-'
    : formatDisplayNumber(number)
}


/*
|--------------------------------------------------------------------------
| SEKTOR OPTIONS
|--------------------------------------------------------------------------
*/

const sektorOptions = computed(() => {

  return prioritizeSectorOptions([
    ...new Set(
      data.value
        .map(
          item => normalizeRatioSektor(item.SEKTOR)
        )
        .filter(Boolean)
    )
  ])

})


/*
|--------------------------------------------------------------------------
| PERIODE OPTIONS
|--------------------------------------------------------------------------
*/

const periodeOptions = computed(() => {

  return [
    ...new Set(
      data.value
        .map(
          item =>
            item.TAHUN
        )
        .filter(Boolean)
    )
  ]

})

const isApplyingSharedPeriods = ref(false)

watch(
  selectedPeriode,
  periods => {
    if (isApplyingSharedPeriods.value) {
      return
    }

    const values = periods.map(String)
    const annualPeriods = values.filter(isAnnual)
    const quarterlyPeriods = values.filter(isQuarterly)

    if (annualPeriods.length > 0 && quarterlyPeriods.length > 0) {
      return
    }

    if (values.length === 0) {
      clearSharedFilter('periode')
      setSharedFilter('tahun', [])
      setSharedFilter('triwulan', [])
      return
    }

    const years = [
      ...new Set(
        values.map(period =>
          period.split('/Q')[0]
        )
      )
    ]

    setSharedFilter(
      'periode',
      quarterlyPeriods.length > 0
        ? 'triwulanan'
        : 'tahunan'
    )
    setSharedFilter('tahun', years)
    setSharedFilter(
      'triwulan',
      quarterlyPeriods.length > 0
        ? [...new Set(
            quarterlyPeriods.map(period =>
              `Q${period.split('/Q')[1]}`
            )
          )]
        : []
    )
  },
  {
    deep: true,
    flush: 'sync'
  }
)

watch(
  () => [
    sharedFilters.periode,
    sharedFilters.tahun,
    sharedFilters.triwulan,
    periodeOptions.value
  ],
  () => {
    const hasSharedPeriod =
      Object.hasOwn(sharedFilters, 'periode') ||
      Object.hasOwn(sharedFilters, 'tahun') ||
      Object.hasOwn(sharedFilters, 'triwulan')

    if (!hasSharedPeriod) {
      return
    }

    const years = Array.isArray(sharedFilters.tahun)
      ? sharedFilters.tahun.map(String)
      : []
    const quarters = new Set(
      (Array.isArray(sharedFilters.triwulan)
        ? sharedFilters.triwulan
        : []
      ).map(value =>
        String(value).replace(/^Q/i, '')
      )
    )
    const quarterly =
      sharedFilters.periode === 'triwulanan'
    let periods = []

    if (quarterly) {
      periods = periodeOptions.value
        .map(String)
        .filter(period => {
          if (!isQuarterly(period)) {
            return false
          }

          const [year, quarter] = period.split('/Q')
          return (
            (years.length === 0 || years.includes(year)) &&
            (quarters.size === 0 || quarters.has(quarter))
          )
        })
    } else if (years.length > 0) {
      periods = years
    } else if (sharedFilters.periode === 'tahunan') {
      periods = periodeOptions.value
        .map(String)
        .filter(isAnnual)
    }

    const currentPeriods = selectedPeriode.value.map(String)
    if (
      JSON.stringify(currentPeriods) ===
      JSON.stringify(periods)
    ) {
      return
    }

    isApplyingSharedPeriods.value = true
    selectedPeriode.value = periods
    isApplyingSharedPeriods.value = false
  },
  {
    deep: true,
    immediate: true
  }
)


/*
|--------------------------------------------------------------------------
| JENIS RASIO OPTIONS
|--------------------------------------------------------------------------
*/

const jenisRasioOptions = computed(() => {

  return [
    ...new Set(
      getRatioTypesForSectors(data.value, selectedSektor.value)
        .filter(ratio => !isExcludedRatioType(ratio))
    )
  ]

})


watch(
  [selectedSektor, data],
  () => {
    selectedJenisRasio.value = selectedJenisRasio.value
      .filter(ratio => jenisRasioOptions.value.includes(ratio))
  },
  { deep: true }
)


const displayedRatioTypes = computed(() =>
  selectedJenisRasio.value.some(ratio => !isExcludedRatioType(ratio))
    ? selectedJenisRasio.value.filter(ratio => !isExcludedRatioType(ratio))
    : jenisRasioOptions.value
)


/*
|--------------------------------------------------------------------------
| FILTER DATA MENTAH
|--------------------------------------------------------------------------
|
| Filter berdasarkan:
| - sektor
| - periode
| - jenis rasio
|
*/

const filteredData = computed(() => {

  return data.value.filter(item => {

    if (isExcludedRatioType(item['JENIS RASIO'])) {
      return false
    }

    const sektor = normalizeRatioSektor(item.SEKTOR)


    /*
     * Jika belum memilih sektor,
     * tampilkan seluruh sektor.
     *
     * Jika sudah memilih sektor,
     * hanya sektor yang dicentang.
     */
    const matchSektor =
      selectedSektor.value.length === 0 ||
      selectedSektor.value.includes(sektor)


    const matchPeriode =
      selectedPeriode.value.length === 0 ||
      selectedPeriode.value.includes(String(item.TAHUN))


    const matchJenisRasio =
      selectedJenisRasio.value.length === 0 ||
      selectedJenisRasio.value.includes(item['JENIS RASIO'])


    return (
      matchSektor &&
      matchPeriode &&
      matchJenisRasio
    )

  })

})


/*
|--------------------------------------------------------------------------
| AGGREGATED DATA
|--------------------------------------------------------------------------
|
| Data dari beberapa sektor dijumlahkan berdasarkan:
|
| TAHUN + JENIS RASIO
|
| Contoh:
|
| FC 2024 COE/VA = 10
| GG 2024 COE/VA = 20
|
| hasil:
|
| 2024 COE/VA = 30
|
*/

const sortedData = computed(() =>
  [...filteredData.value].sort((first, second) =>
    String(first.TAHUN).localeCompare(
      String(second.TAHUN),
      undefined,
      { numeric: true }
    )
  )
)


/*
|--------------------------------------------------------------------------
| DATA TAHUNAN
|--------------------------------------------------------------------------
*/

const annualData = computed(() => {

  return sortedData.value.filter(
    item =>
      isAnnual(item.TAHUN)
  )

})


/*
|--------------------------------------------------------------------------
| DATA TRIWULANAN
|--------------------------------------------------------------------------
*/

const quarterlyData = computed(() => {

  return sortedData.value.filter(
    item =>
      isQuarterly(item.TAHUN)
  )

})


/*
|--------------------------------------------------------------------------
| TABEL STATISTIK
|--------------------------------------------------------------------------
*/

const statisticTable = computed(() => {

  const map = new Map()
  const canonicalRows = new Map()


  sortedData.value.forEach(item => {

    const periode =
      item.TAHUN

    const sektor =
      normalizeRatioSektor(item.SEKTOR)

    const jenis =
      item['JENIS RASIO']


    if (!periode || !sektor || !jenis) {

      return

    }


    const key =
      `${periode}__${sektor}`


    if (!map.has(key)) {

      map.set(
        key,
        {
          key,
          periode,
          sektor,
          values: {}
        }
      )

    }


    const row =
      map.get(key)


    const canonicalKey = `${key}__${jenis}`
    const isCanonicalSector =
      String(item.SEKTOR ?? '').trim().toUpperCase() === sektor


    if (!canonicalRows.get(canonicalKey) || isCanonicalSector) {

      row.values[jenis] = rawValue(item.NILAI)
      canonicalRows.set(canonicalKey, isCanonicalSector)

    }

  })


  return Array
    .from(map.values())
    .sort(
      (a, b) => {
        const periodOrder =
          String(a.periode).localeCompare(
            String(b.periode),
          undefined,
          {
            numeric: true
          }
        )

        return periodOrder ||
          a.sektor.localeCompare(b.sektor)
      }
    )

})


function getPeriodRange(periods) {

  const ordered = [...new Set(periods)].sort((first, second) =>
    String(first).localeCompare(String(second), undefined, { numeric: true })
  )


  if (ordered.length === 0) {

    return '-'

  }


  if (ordered.length === 1) {

    return ordered[0]

  }


  return `${ordered[0]} - ${ordered[ordered.length - 1]}`

}


const summaryMetrics = computed(() => {

  const rows = filteredData.value
  const annualPeriods = rows
    .filter(item => isAnnual(item.TAHUN))
    .map(item => item.TAHUN)
  const quarterlyPeriods = rows
    .filter(item => isQuarterly(item.TAHUN))
    .map(item => item.TAHUN)
  const sectors = new Set(
    rows.map(item => normalizeRatioSektor(item.SEKTOR)).filter(Boolean)
  )


  return {
    observations: rows.length,
    sectors: sectors.size,
    annualPeriodCount: new Set(annualPeriods).size,
    quarterlyPeriodCount: new Set(quarterlyPeriods).size,
    annualCoverage: getPeriodRange(annualPeriods),
    quarterlyCoverage: getPeriodRange(quarterlyPeriods)
  }

})


const tableRatioTypes = computed(() => {

  const query = tableSearch.value.trim().toLocaleLowerCase('id-ID')
  const matchingRatios = displayedRatioTypes.value.filter(ratio =>
    ratio.toLocaleLowerCase('id-ID').includes(query)
  )


  return query && matchingRatios.length > 0
    ? matchingRatios
    : displayedRatioTypes.value

})


const searchedTable = computed(() => {

  const query = tableSearch.value.trim().toLocaleLowerCase('id-ID')


  if (!query) {

    return statisticTable.value

  }


  if (tableRatioTypes.value.length < displayedRatioTypes.value.length) {

    return statisticTable.value

  }


  return statisticTable.value.filter(row => {
    const searchableValues = [
      row.periode,
      row.periode.includes('/Q') ? 'triwulan' : 'tahunan',
      row.sektor,
      ...displayedRatioTypes.value.map(ratio => row.values[ratio])
    ]

    return searchableValues
      .join(' ')
      .toLocaleLowerCase('id-ID')
      .includes(query)
  })

})


const canExportCsv = computed(() =>
  canExportRatioCsv({
    loading: loading.value,
    sectors: selectedSektor.value,
    rowCount: searchedTable.value.length
  })
)


function getTableSortValue(row, key) {

  if (key.startsWith('ratio:')) {

    return numericValue(row.values[key.slice(6)])

  }


  if (key === 'sektor') {

    return getSectorName(row.sektor)

  }


  return row.periode

}


const sortedTable = computed(() => {

  return [...searchedTable.value].sort((first, second) => {
    const firstValue = getTableSortValue(first, tableSortKey.value)
    const secondValue = getTableSortValue(second, tableSortKey.value)
    let comparison = 0


    if (firstValue === null || firstValue === undefined) {

      return secondValue === null || secondValue === undefined ? 0 : 1

    }


    if (secondValue === null || secondValue === undefined) {

      return -1

    }


    if (typeof firstValue === 'number' && typeof secondValue === 'number') {

      comparison = firstValue - secondValue

    } else {

      comparison = String(firstValue).localeCompare(
        String(secondValue),
        'id',
        { numeric: true, sensitivity: 'base' }
      )

    }


    if (comparison === 0) {

      comparison = String(first.periode).localeCompare(
        String(second.periode),
        undefined,
        { numeric: true }
      ) || first.sektor.localeCompare(second.sektor)

    }


    return tableSortDirection.value === 'asc'
      ? comparison
      : -comparison
  })

})


const pageNumbers = computed(() => {

  const total = totalPages.value


  if (sortedTable.value.length === 0) {

    return []

  }


  if (total <= 5) {

    return Array.from({ length: total }, (_, index) => index + 1)

  }


  if (currentPage.value <= 3) {

    return [1, 2, 3, '...', total]

  }


  if (currentPage.value >= total - 2) {

    return [1, '...', total - 2, total - 1, total]

  }


  return [1, '...', currentPage.value - 1, currentPage.value, currentPage.value + 1, '...', total]

})


const pageRangeStart = computed(() =>
  sortedTable.value.length === 0
    ? 0
    : (currentPage.value - 1) * itemsPerPage.value + 1
)


const pageRangeEnd = computed(() =>
  Math.min(currentPage.value * itemsPerPage.value, sortedTable.value.length)
)


function toggleTableSort(key) {

  if (tableSortKey.value === key) {

    tableSortDirection.value = tableSortDirection.value === 'asc'
      ? 'desc'
      : 'asc'

  } else {

    tableSortKey.value = key
    tableSortDirection.value = 'asc'

  }


  currentPage.value = 1

}


function getTableSortIcon(key) {

  if (tableSortKey.value !== key) {

    return ArrowUpDown

  }


  return tableSortDirection.value === 'asc'
    ? ArrowUp
    : ArrowDown

}


/*
|--------------------------------------------------------------------------
| PAGINATION
|--------------------------------------------------------------------------
*/

const totalPages = computed(() => {

  return Math.max(
    1,
    Math.ceil(
      sortedTable.value.length /
      itemsPerPage.value
    )
  )

})


const paginatedTable = computed(() => {

  const start =
    (
      currentPage.value - 1
    ) *
    itemsPerPage.value


  return sortedTable.value.slice(
    start,
    start + itemsPerPage.value
  )

})


function goToPage(page) {

  if (
    page < 1 ||
    page > totalPages.value
  ) {

    return

  }


  currentPage.value =
    page

}


function resetPage() {

  currentPage.value =
    1

}


/*
|--------------------------------------------------------------------------
| RESET FILTER
|--------------------------------------------------------------------------
*/

function resetFilters() {

  selectedSektor.value = []

  selectedPeriode.value = []

  selectedJenisRasio.value = []

  resetPage()

}


function resetSektor() {

  selectedSektor.value = []

  resetPage()

}


/*
|--------------------------------------------------------------------------
| CHART ROW BUILDER
|--------------------------------------------------------------------------
*/

function buildChartRows(sourceData, ratio) {

  const map = new Map()
  const sectors = new Set()


  sourceData.forEach(item => {

    if (item['JENIS RASIO'] !== ratio) {

      return

    }


    const periode = String(item.TAHUN ?? '').trim()
    const rawSektor = String(item.SEKTOR ?? '').trim().toUpperCase()
    const sektor = normalizeRatioSektor(item.SEKTOR)


    if (!periode || !sektor) {

      return

    }


    if (!map.has(periode)) {

      map.set(
        periode,
        { periode }
      )

    }


    const row =
      map.get(periode)


    const isCanonicalSector = rawSektor === sektor
    const hasCanonicalValue = row[`_${sektor}Canonical`]

    if (!hasCanonicalValue || isCanonicalSector) {

      row[sektor] = numericValue(item.NILAI)
      row[`_${sektor}Canonical`] = isCanonicalSector

    }

    sectors.add(sektor)

  })


  return {
    rows: Array
      .from(map.values())
      .sort(
      (a, b) =>
        String(a.periode).localeCompare(
          String(b.periode),
          undefined,
          {
            numeric: true
          }
        )
      ),
    sectors: Array.from(sectors)
  }

}


/*
|--------------------------------------------------------------------------
| DATA CHART TAHUNAN
|--------------------------------------------------------------------------
*/

const annualChartRows =
  computed(() => {

    return buildChartRows(
      annualData.value
    )

  })


/*
|--------------------------------------------------------------------------
| DATA CHART TRIWULANAN
|--------------------------------------------------------------------------
*/

const quarterlyChartRows =
  computed(() => {

    return buildChartRows(
      quarterlyData.value
    )

  })


/*
|--------------------------------------------------------------------------
| ACTIVE SERIES
|--------------------------------------------------------------------------
*/

function getActiveRatios() {
  const selectedRatios =
    selectedJenisRasio.value.filter(ratio => !isExcludedRatioType(ratio))

  if (selectedRatios.length > 0) {
    return selectedRatios
  }


  return ratioTypes

}


/*
|--------------------------------------------------------------------------
| FORMAT CHART VALUE
|--------------------------------------------------------------------------
*/

function formatChartValue(value) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {

    return ''

  }


  return String(value)
    .replace('.', ',')

}


/*
|--------------------------------------------------------------------------
| CHART OPTION TAHUNAN
|--------------------------------------------------------------------------
*/

const annualChartOption =
  computed(() => {

    const activeRatios =
      getActiveRatios()


    return {

      animationDuration: 500,


      tooltip: {

        trigger: 'axis',

        formatter(params) {

          if (
            !params?.length
          ) {

            return ''

          }


          let html =
            `<div style="font-weight:600;margin-bottom:6px">
              ${params[0].axisValue}
            </div>`


          params.forEach(item => {

            if (
              item.value === null ||
              item.value === undefined
            ) {

              return

            }


            html +=
              `<div style="display:flex;gap:18px;justify-content:space-between">
                <span>${item.seriesName}</span>
                <strong>
                  ${formatChartValue(item.value)}
                </strong>
              </div>`

          })


          return html

        }

      },


      legend: {

        top: 0,

        left: 'left',

        icon: 'circle'

      },


      grid: {

        top: 45,

        right: 20,

        bottom: 55,

        left: 55,

        containLabel: true

      },


      xAxis: {

        type: 'category',

        data:
          annualChartRows.value.map(
            item =>
              item.periode
          ),

        boundaryGap: false

      },


      yAxis: {

        type: 'value',

        axisLabel: {

          formatter(value) {

            return formatChartValue(
              value
            )

          }

        }

      },


      series:
        activeRatios.map(
          ratio => ({

            name: ratio,

            type: 'line',

            smooth: true,

            symbol: 'circle',

            symbolSize: 6,

            connectNulls: false,

            data:
              annualChartRows.value.map(
                item =>
                  item[ratio]
              )

          })
        )

    }

  })


/*
|--------------------------------------------------------------------------
| CHART OPTION TRIWULANAN
|--------------------------------------------------------------------------
*/

const quarterlyChartOption =
  computed(() => {

    const activeRatios =
      getActiveRatios()


    return {

      animationDuration: 500,


      tooltip: {

        trigger: 'axis',

        formatter(params) {

          if (
            !params?.length
          ) {

            return ''

          }


          let html =
            `<div style="font-weight:600;margin-bottom:6px">
              ${params[0].axisValue}
            </div>`


          params.forEach(item => {

            if (
              item.value === null ||
              item.value === undefined
            ) {

              return

            }


            html +=
              `<div style="display:flex;gap:18px;justify-content:space-between">
                <span>${item.seriesName}</span>
                <strong>
                  ${formatChartValue(item.value)}
                </strong>
              </div>`

          })


          return html

        }

      },


      legend: {

        top: 0,

        left: 'left',

        icon: 'circle'

      },


      dataZoom: [

        {
          type: 'inside',

          zoomOnMouseWheel: true,

          moveOnMouseMove: true,

          moveOnMouseWheel: true,

          start: 0,

          end: 35
        },

        {
          type: 'slider',

          height: 22,

          bottom: 8,

          start: 0,

          end: 35
        }

      ],


      grid: {

        top: 45,

        right: 20,

        bottom: 90,

        left: 55,

        containLabel: true

      },


      xAxis: {

        type: 'category',

        data:
          quarterlyChartRows.value.map(
            item =>
              item.periode
          ),

        boundaryGap: false,

        axisLabel: {

          hideOverlap: true

        }

      },


      yAxis: {

        type: 'value',

        axisLabel: {

          formatter(value) {

            return formatChartValue(
              value
            )

          }

        }

      },


      series:
        activeRatios.map(
          ratio => ({

            name: ratio,

            type: 'line',

            smooth: true,

            symbol: 'circle',

            symbolSize: 5,

            connectNulls: false,

            data:
              quarterlyChartRows.value.map(
                item =>
                  item[ratio]
              )

          })
        )

    }

  })


const sectorColors = {
  FC: '#2563eb',
  NFC: '#e76f51',
  HH: '#16a34a',
  GG: '#d4a72c',
  NPISHS: '#7c3aed',
  ROW: '#0891b2'
}


function createChartOption(chartData, isQuarterly) {
  return {
    animationDuration: 650,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.96)',
      borderWidth: 0,
      padding: [10, 12],
      textStyle: {
        color: '#ffffff',
        fontSize: 11
      },
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: '#94a3b8',
          type: 'dashed'
        }
      },
      formatter(parameters) {
        if (!parameters?.length) {
          return ''
        }

        let html = `<div style="font-weight:700;margin-bottom:8px;color:#f8fafc">${parameters[0].axisValue}</div>`

        parameters.forEach(parameter => {
          if (parameter.value === null || parameter.value === undefined) {
            return
          }

          html += `<div style="display:flex;gap:18px;justify-content:space-between;margin-top:4px"><span style="color:#cbd5e1">${parameter.marker}${parameter.seriesName}</span><strong style="color:#ffffff">${formatChartValue(parameter.value)}</strong></div>`
        })

        return html
      }
    },
    legend: {
      top: 4,
      left: 58,
      right: 16,
      type: 'scroll',
      icon: 'circle',
      itemWidth: 12,
      itemHeight: 9,
      textStyle: {
        color: '#475569',
        fontSize: 11
      }
    },
    grid: {
      top: 50,
      right: 26,
      bottom: isQuarterly ? 96 : 58,
      left: 58,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: chartData.rows.map(row => row.periode),
      boundaryGap: false,
      axisLine: {
        lineStyle: {
          color: '#dbe4ec'
        }
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#64748b',
        fontSize: isQuarterly ? 9 : 11,
        margin: 12,
        hideOverlap: true,
        rotate: isQuarterly && chartData.rows.length > 14 ? 35 : 0
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#64748b',
        fontSize: 10,
        formatter: value => formatChartValue(value)
      },
      splitLine: {
        lineStyle: {
          color: '#e8edf3'
        }
      }
    },
    dataZoom: isQuarterly
      ? [
          {
            type: 'inside',
            start: 0,
            end: 35,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: false
          },
          {
            type: 'slider',
            height: 16,
            bottom: 8,
            start: 0,
            end: 35,
            borderColor: '#dbe4ec',
            backgroundColor: '#f1f5f9',
            fillerColor: 'rgba(15, 118, 110, 0.10)',
            handleStyle: {
              color: '#0f766e'
            },
            textStyle: {
              color: '#64748b',
              fontSize: 9
            }
          }
        ]
      : undefined,
    series: chartData.sectors.map(sector => ({
      name: sector,
      type: 'line',
      smooth: 0.25,
      symbol: 'circle',
      symbolSize: isQuarterly ? 5 : 7,
      connectNulls: false,
      itemStyle: {
        color: '#ffffff',
        borderColor: sectorColors[sector] || '#64748b',
        borderWidth: 2
      },
      lineStyle: {
        width: 3,
        color: sectorColors[sector] || '#64748b'
      },
      emphasis: {
        focus: 'series',
        lineStyle: {
          width: 4
        },
        itemStyle: {
          color: sectorColors[sector] || '#64748b',
          borderColor: '#ffffff',
          borderWidth: 2,
          shadowBlur: 8
        }
      },
      data: chartData.rows.map(row => row[sector] ?? null)
    }))
  }
}


function hasRatioChartData(chartData) {
  return chartData.rows.some(row =>
    chartData.sectors.some(sector => row[sector] !== null)
  )
}


const chartDataByRatio = computed(() => {
  const selectedRatios = selectedJenisRasio.value
    .filter(ratio => !isExcludedRatioType(ratio))
  const activeRatios = selectedRatios.length > 0
    ? selectedRatios
    : jenisRasioOptions.value

  return activeRatios
    .map(ratio => ({
      ratio,
      annualChartData: buildChartRows(annualData.value, ratio),
      quarterlyChartData: buildChartRows(quarterlyData.value, ratio)
    }))
})


const availableRatioChartModes = computed(() => [
  ...(chartDataByRatio.value.some(item => hasRatioChartData(item.annualChartData))
    ? ['Tahunan']
    : []),
  ...(chartDataByRatio.value.some(item => hasRatioChartData(item.quarterlyChartData))
    ? ['Triwulanan']
    : [])
])


const selectedRatioChartMode = computed(() =>
  availableRatioChartModes.value.includes(ratioChartMode.value)
    ? ratioChartMode.value
    : availableRatioChartModes.value[0] || 'Tahunan'
)


watch(availableRatioChartModes, modes => {
  if (modes.length > 0 && !modes.includes(ratioChartMode.value)) {
    ratioChartMode.value = modes[0]
  }
})


function setRatioChartMode(mode) {
  ratioChartMode.value = mode
}


const charts = computed(() => {
  const quarterly = selectedRatioChartMode.value === 'Triwulanan'

  return chartDataByRatio.value
    .map(item => {
      const chartData = quarterly
        ? item.quarterlyChartData
        : item.annualChartData

      if (!hasRatioChartData(chartData)) {
        return null
      }

      return {
        key: item.ratio,
        ratio: item.ratio,
        periodLabel: selectedRatioChartMode.value,
        chartData,
        hasData: true,
        option: createChartOption(chartData, quarterly)
      }
    })
    .filter(Boolean)

})

function getRatioExportContext() {
  return {
    mode: 'rasio',
    period: selectedPeriode.value.length > 0
      ? selectedPeriode.value.join('_')
      : 'semua-periode',
    filters: {
      Sektor: selectedSektor.value,
      Periode: selectedPeriode.value,
      JenisRasio: selectedJenisRasio.value,
      Pencarian: tableSearch.value
    }
  }
}

function downloadAnalysisCsv() {
  if (!canExportCsv.value) {
    return
  }

  const { headers, rows } = buildRatioCsvExportData(
    sortedTable.value,
    tableRatioTypes.value
  )

  if (rows.length === 0) {
    alert('Tidak ada baris tabel yang sesuai untuk diekspor.')
    return
  }

  const context = getRatioExportContext()
  downloadCsvFile(
    buildExportFilename({
      page: 'analisis-rasio',
      ...context,
      extension: 'csv'
    }),
    headers,
    rows
  )
}

async function downloadAnalysisPdf() {
  if (exportingRatioPdf.value) {
    return
  }

  const context = getRatioExportContext()
  exportingRatioPdf.value = true

  try {
    await nextTick()
    const chartElements = document.querySelectorAll('[data-pdf-chart="ratio"]')

    await exportChartsPdf({
      filename: buildExportFilename({
        page: 'analisis-rasio',
        ...context,
        extension: 'pdf'
      }),
      reportTitle: 'BPS - Analisis Rasio',
      mode: context.mode,
      period: context.period,
      filters: context.filters,
      chartElements
    })
  } catch (exportError) {
    console.error('Gagal mengekspor PDF Analisis Rasio:', exportError)
    alert(exportError?.message || 'Gagal membuat PDF Analisis Rasio.')
  } finally {
    exportingRatioPdf.value = false
  }
}


/*
|--------------------------------------------------------------------------
| WATCH
|--------------------------------------------------------------------------
*/

watch(
  [
    selectedSektor,
    selectedPeriode,
    selectedJenisRasio,
    tableSearch,
    itemsPerPage
  ],
  () => {

    currentPage.value = 1

  },
  {
    deep: true
  }
)


/*
|--------------------------------------------------------------------------
| LIFECYCLE
|--------------------------------------------------------------------------
*/

onMounted(() => {
  window.addEventListener(
    CACHE_REFRESH_EVENT,
    loadData
  )
  loadData()

})

onBeforeUnmount(() => {
  window.removeEventListener(
    CACHE_REFRESH_EVENT,
    loadData
  )
})
</script>


<template>

  <div class="space-y-5 pb-10">

    <!-- =====================================================
         HEADER
    ====================================================== -->

    <section
      class="
        relative overflow-hidden rounded-2xl border border-slate-200/80
        border-t-4 border-t-teal-600
        bg-gradient-to-br from-white via-white to-teal-50/60
        px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] lg:px-6
      "
    >
      <div class="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            Statistik Ekonomi
          </p>

          <h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Analisis Rasio
          </h1>

          <p class="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Menampilkan perkembangan rasio ekonomi sektoral
            berdasarkan data tahunan dan triwulanan.
          </p>
        </div>

        <ExportActions
          class="shrink-0"
          :csv-disabled="!canExportCsv"
          :pdf-disabled="loading || !charts.some(chart => chart.hasData)"
          :pdf-busy="exportingRatioPdf"
          @csv="downloadAnalysisCsv"
          @pdf="downloadAnalysisPdf"
        />
      </div>
    </section>


    <!-- =====================================================
         FILTER
    ====================================================== -->

    <section
      class="
        overflow-visible
        rounded-2xl
        border
        border-slate-200/80
        border-t-2 border-t-teal-500
        bg-white
        shadow-[0_8px_24px_rgba(15,23,42,0.045)]
      "
    >

      <!-- FILTER HEADER -->

      <div
        class="
          flex
          flex-col
          gap-3
          border-b
          border-slate-100
          px-5
          py-4
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >

        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <SlidersHorizontal :size="15" :stroke-width="1.8" />
          </div>

          <div>
          <h2
            class="
              text-sm
              font-bold
              text-slate-800
            "
          >
            Filter Analisis Rasio
          </h2>

          <p
            class="
              mt-1
              text-xs
              text-slate-400
            "
          >
            Filter berlaku pada seluruh grafik dan tabel.
          </p>
          </div>

          <span
            v-if="activeFilterCount > 0"
            class="rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-bold text-teal-800"
          >
            {{ formatDisplayNumber(activeFilterCount) }} aktif
          </span>
        </div>

        <button
          type="button"
          @click="resetFilters"
          :disabled="activeFilterCount === 0"
          class="
            self-start
            rounded-lg
            border
            border-slate-200
            bg-white
            px-3
            py-2
            text-xs
            font-medium
            text-slate-600
            transition
            disabled:cursor-not-allowed
            disabled:opacity-40
            hover:border-slate-300
            hover:bg-slate-50
            sm:self-auto
          "
        >
          <RotateCcw :size="12" />
          Reset
        </button>

      </div>


      <div class="grid grid-cols-1 gap-3 px-4 pb-4 pt-3 sm:grid-cols-2 lg:grid-cols-3">
        <MultiSelectFilter
          v-model="selectedSektor"
          label="Sektor"
          placeholder="Semua sektor"
          :options="sektorOptions"
        />

        <MultiSelectFilter
          v-model="selectedPeriode"
          label="Periode"
          placeholder="Semua periode"
          :options="periodeOptions"
        />

        <MultiSelectFilter
          v-model="selectedJenisRasio"
          label="Jenis Rasio"
          placeholder="Semua jenis rasio"
          :options="jenisRasioOptions"
        />
      </div>


      <div
        v-if="false"
        class="
          grid
          grid-cols-1
          gap-5
          p-5
          lg:grid-cols-3
        "
      >

<!-- =================================================
     SEKTOR
================================================== -->

<div class="lg:col-span-1">

  <div
    class="
      mb-2
      flex
      items-center
      justify-between
    "
  >

    <div>
      <label
        class="
          text-xs
          font-semibold
          text-slate-600
        "
      >
        Sektor
      </label>

      <p
        class="
          mt-0.5
          text-[11px]
          text-slate-400
        "
      >
        Pilih satu atau beberapa sektor
      </p>
    </div>

    <button
      type="button"
      @click="resetSektor"
      class="
        rounded-md
        px-2
        py-1
        text-[11px]
        font-medium
        text-blue-600
        transition
        hover:bg-blue-50
        hover:text-blue-700
      "
    >
      Reset
    </button>

  </div>


  <!-- SELECTOR -->

  <button
    type="button"
    @click="isSektorOpen = !isSektorOpen"
    class="
      flex
      w-full
      items-center
      justify-between
      rounded-xl
      border
      border-slate-200
      bg-slate-50
      px-3
      py-2.5
      text-left
      transition
      hover:border-slate-300
      hover:bg-white
      focus:outline-none
      focus:ring-2
      focus:ring-blue-100
    "
  >

    <div class="flex min-w-0 items-center gap-2.5">

      <div
        class="
          flex
          h-7
          w-7
          shrink-0
          items-center
          justify-center
          rounded-lg
          bg-blue-50
          text-blue-600
        "
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="h-4 w-4"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </div>

      <span
        class="
          truncate
          text-sm
          font-medium
          text-slate-700
        "
      >
        {{ selectedSektor.length }} sektor dipilih
      </span>

    </div>


    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class="
        h-4
        w-4
        shrink-0
        text-slate-400
        transition-transform
      "
      :class="{
        'rotate-180': isSektorOpen
      }"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m6 9 6 6 6-6"
      />
    </svg>

  </button>


  <!-- CHECKBOX LIST -->

  <div
    v-if="isSektorOpen"
    class="
      mt-2
      max-h-52
      overflow-y-auto
      rounded-xl
      border
      border-slate-200
      bg-slate-50
      p-2
    "
  >

    <div
      class="
        grid
        grid-cols-2
        gap-1
      "
    >

      <label
        v-for="sektor in sektorOptions"
        :key="sektor"
        class="
          flex
          cursor-pointer
          items-center
          gap-2.5
          rounded-lg
          px-2.5
          py-2
          transition
          hover:bg-white
        "
        :class="{
          'bg-white shadow-sm ring-1 ring-slate-200':
            selectedSektor.includes(sektor)
        }"
      >

        <input
          type="checkbox"
          :value="sektor"
          v-model="selectedSektor"
          class="
            h-4
            w-4
            shrink-0
            rounded
            border-slate-300
            text-blue-600
            focus:ring-2
            focus:ring-blue-500
            focus:ring-offset-0
          "
        />

        <span
          class="
            truncate
            text-xs
            font-medium
            text-slate-700
          "
        >
          {{ sektor }}
        </span>

      </label>

    </div>

  </div>


  <!-- INFO -->

  <div
    class="
      mt-2
      flex
      items-center
      justify-between
    "
  >

    <span
      class="
        text-[11px]
        text-slate-400
      "
    >
      {{ selectedSektor.length }} sektor dipilih
    </span>

    <button
      v-if="isSektorOpen"
      type="button"
      @click="isSektorOpen = false"
      class="
        text-[11px]
        font-medium
        text-blue-600
        hover:text-blue-700
      "
    >
      Selesai
    </button>

  </div>

</div>


        <!-- =================================================
             PERIODE
        ================================================== -->

        <div>

          <label
            class="
              mb-2
              block
              text-xs
              font-semibold
              text-slate-600
            "
          >
            Periode
          </label>

          <select
            v-model="selectedPeriode"
            class="
              w-full
              rounded-xl
              border
              border-slate-200
              bg-slate-50
              px-3
              py-2.5
              text-sm
              text-slate-700
              outline-none
              transition
              hover:border-slate-300
              focus:border-blue-400
              focus:bg-white
              focus:ring-2
              focus:ring-blue-100
            "
          >

            <option value="">
              Semua Periode
            </option>

            <option
              v-for="periode in periodeOptions"
              :key="periode"
              :value="periode"
            >
              {{ periode }}
            </option>

          </select>

          <p
            class="
              mt-2
              text-[11px]
              leading-5
              text-slate-400
            "
          >
            Pilih periode tertentu untuk melihat
            data secara lebih spesifik.
          </p>

        </div>


        <!-- =================================================
             JENIS RASIO
        ================================================== -->

        <div>

          <label
            class="
              mb-2
              block
              text-xs
              font-semibold
              text-slate-600
            "
          >
            Jenis Rasio
          </label>

          <select
            v-model="selectedJenisRasio"
            class="
              w-full
              rounded-xl
              border
              border-slate-200
              bg-slate-50
              px-3
              py-2.5
              text-sm
              text-slate-700
              outline-none
              transition
              hover:border-slate-300
              focus:border-blue-400
              focus:bg-white
              focus:ring-2
              focus:ring-blue-100
            "
          >

            <option value="">
              Semua Rasio
            </option>

            <option
              v-for="jenis in jenisRasioOptions"
              :key="jenis"
              :value="jenis"
            >
              {{ jenis }}
            </option>

          </select>

          <p
            class="
              mt-2
              text-[11px]
              leading-5
              text-slate-400
            "
          >
            Pilih indikator rasio yang ingin
            dianalisis.
          </p>

        </div>

      </div>

    </section>


    <!-- =====================================================
         LOADING
    ====================================================== -->

    <section
      v-if="loading"
      class="
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-12
        text-center
        shadow-sm
      "
    >

      <div
        class="
          mx-auto
          h-8
          w-8
          animate-spin
          rounded-full
          border-2
          border-slate-200
          border-t-blue-600
        "
      ></div>

      <p
        class="
          mt-4
          text-sm
          font-medium
          text-slate-500
        "
      >
        Memuat data statistik...
      </p>

      <p
        class="
          mt-1
          text-xs
          text-slate-400
        "
      >
        Mengambil data analisis rasio.
      </p>

    </section>


    <!-- =====================================================
         ERROR
    ====================================================== -->

    <section
      v-else-if="error"
      class="
        rounded-2xl
        border
        border-red-200
        bg-red-50
        p-5
      "
    >

      <div class="flex gap-3">

        <div
          class="
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-lg
            bg-red-100
            text-red-600
          "
        >
          !
        </div>

        <div>

          <p
            class="
              font-semibold
              text-red-700
            "
          >
            Gagal memuat data
          </p>

          <p
            class="
              mt-1
              text-sm
              leading-5
              text-red-600
            "
          >
            {{ error }}
          </p>

        </div>

      </div>

    </section>


    <!-- =====================================================
         CONTENT
    ====================================================== -->

    <section
      v-else-if="selectedSektor.length === 0"
      class="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm"
    >
      <h2 class="text-base font-semibold text-slate-800">
        Pilih sektor untuk memulai analisis
      </h2>
      <p class="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
        Pilih satu atau lebih sektor pada filter di atas untuk menampilkan grafik dan data rasio.
      </p>
    </section>


    <template v-else>

      <!-- ===================================================
           ACTIVE FILTER
      ==================================================== -->

      <section
        class="
          rounded-2xl
          border
          border-slate-200/80
          border-l-4 border-l-teal-500
          bg-white
          px-5
          py-4
          shadow-[0_5px_18px_rgba(15,23,42,0.045)]
        "
      >

        <div
          class="
            flex
            flex-col
            gap-3
            sm:flex-row
            sm:items-center
          "
        >

          <span
            class="
              shrink-0
              text-xs
              font-semibold
              text-slate-500
            "
          >
            Filter aktif
          </span>

          <div
            class="
              flex
              flex-wrap
              gap-2
            "
          >

            <span
              class="
                rounded-full
                bg-teal-50
                px-3
                py-1.5
                text-[11px]
                font-semibold
                text-teal-800
              "
            >
              Sektor:
              {{ selectedSektor.join(', ') || 'Belum dipilih' }}
            </span>

            <span
              class="
                rounded-full
                px-3
                py-1.5
                text-[11px]
                font-medium
              "
              :class="
                selectedPeriode.length > 0
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-slate-50 text-slate-400'
              "
            >
              Periode:
              {{ selectedPeriode.join(', ') || 'Semua' }}
            </span>

            <span
              class="
                rounded-full
                px-3
                py-1.5
                text-[11px]
                font-medium
              "
              :class="
                selectedJenisRasio.length > 0
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-slate-50 text-slate-400'
              "
            >
              Rasio:
              {{ selectedJenisRasio.join(', ') || 'Semua' }}
            </span>

          </div>

        </div>

      </section>


      <!-- ===================================================
           KPI
      ==================================================== -->

      <section>

        <div
          class="
            mb-4
            flex
            flex-col
            gap-1
            sm:flex-row
            sm:items-end
            sm:justify-between
          "
        >

          <div>

            <h2
              class="
                text-base
                font-bold
                text-slate-800
              "
            >
              Ringkasan Cakupan Data
            </h2>

            <p
              class="
                mt-1
                text-xs
                text-slate-400
              "
            >
              Ringkasan jumlah data dan rentang periode sesuai filter.
            </p>

          </div>

        </div>


        <div
          class="grid grid-cols-2 items-start gap-3 xl:grid-cols-4 [&>div]:overflow-hidden [&>div]:border-slate-200/80 [&>div]:border-t-2 [&>div]:shadow-[0_5px_18px_rgba(15,23,42,0.045)] [&>div]:transition [&>div]:duration-200 [&>div:hover]:-translate-y-0.5 [&>div:hover]:shadow-md [&>div:nth-child(1)]:border-t-teal-500 [&>div:nth-child(2)]:border-t-cyan-600 [&>div:nth-child(3)]:border-t-amber-500 [&>div:nth-child(4)]:border-t-rose-500"
        >
          <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p class="text-[10px] font-semibold uppercase text-slate-400">Observasi</p>
            <p class="mt-1 text-xl font-bold tabular-nums text-slate-800">
              {{ summaryMetrics.observations.toLocaleString('id-ID') }}
            </p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p class="text-[10px] font-semibold uppercase text-slate-400">Sektor</p>
            <p class="mt-1 text-xl font-bold tabular-nums text-slate-800">
              {{ formatDisplayNumber(summaryMetrics.sectors) }}
            </p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p class="text-[10px] font-semibold uppercase text-slate-400">Periode Tahunan</p>
            <p class="mt-1 text-sm font-bold text-slate-800">
              {{ summaryMetrics.annualPeriodCount.toLocaleString('id-ID') }} periode
            </p>
            <p class="mt-0.5 text-[10px] text-slate-400">{{ summaryMetrics.annualCoverage }}</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p class="text-[10px] font-semibold uppercase text-slate-400">Periode Triwulanan</p>
            <p class="mt-1 text-sm font-bold text-slate-800">
              {{ summaryMetrics.quarterlyPeriodCount.toLocaleString('id-ID') }} periode
            </p>
            <p class="mt-0.5 text-[10px] text-slate-400">{{ summaryMetrics.quarterlyCoverage }}</p>
          </div>
        </div>
      </section>


      <!-- ===================================================
           CHART TAHUNAN
      ==================================================== -->

      <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs font-semibold text-slate-500">
          Frekuensi grafik rasio
        </p>
        <div
          v-if="availableRatioChartModes.length > 1"
          class="inline-flex w-fit rounded-lg bg-slate-100 p-1"
          role="group"
          aria-label="Frekuensi semua grafik rasio"
        >
          <button
            v-for="mode in availableRatioChartModes"
            :key="mode"
            type="button"
            class="rounded-md px-3 py-1.5 text-[10px] font-semibold transition-all duration-200"
            :class="selectedRatioChartMode === mode
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'"
            :aria-pressed="selectedRatioChartMode === mode"
            @click="setRatioChartMode(mode)"
          >
            {{ mode }}
          </button>
        </div>
        <span
          v-else-if="availableRatioChartModes.length === 1"
          class="text-[10px] font-semibold text-slate-500"
        >
          {{ availableRatioChartModes[0] }}
        </span>
      </div>

      <p
        v-if="charts.length === 0"
        role="status"
        class="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500"
      >
        Tidak ada grafik rasio untuk frekuensi dan filter yang dipilih.
      </p>

      <div v-else class="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">

      <section
        v-for="chart in charts"
        :key="chart.key"
        class="
          overflow-hidden
          rounded-xl
          border border-slate-200/80
          border-t-2 border-t-teal-500
          bg-white
          shadow-[0_6px_20px_rgba(15,23,42,0.045)]
          transition-shadow duration-200
          hover:shadow-md
        "
      >

        <div
          class="
            border-b
            border-slate-100
            px-5
            py-4
          "
        >

          <div
            class="
              flex
              flex-col
              gap-1
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >

            <div>

              <h2
                class="
                  text-base
                  font-bold
                  text-slate-800
                "
              >
                Grafik {{ chart.ratio }}
              </h2>

              <p
                class="
                  mt-1
                  text-xs
                  text-slate-400
                "
              >
                {{ ratioDescriptions[chart.ratio] || chart.ratio }}
              </p>

            </div>

          </div>

        </div>


        <div
          v-if="chart.hasData"
          data-pdf-chart="ratio"
          :data-pdf-title="`Grafik ${chart.ratio} - ${chart.periodLabel}`"
          class="h-[350px] min-w-0 p-3 sm:p-5"
        >

          <VChart
            :option="chart.option"
            autoresize
            class="h-full w-full"
          />

        </div>


        <div
          v-else
          class="
            flex
            h-[350px]
            items-center
            justify-center
            text-sm
            text-slate-400
          "
        >
          Tidak ada data {{ chart.ratio }} {{ chart.periodLabel.toLowerCase() }} yang sesuai dengan filter.
        </div>

      </section>


      </div>


      <!-- ===================================================
           TABEL STATISTIK
      ==================================================== -->

      <section
        class="
          border-t-2
          border-teal-200
          pt-5
        "
        aria-labelledby="glosarium-indikator-title"
      >
        <div
          class="
            flex
            flex-col
            gap-3
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div class="flex min-w-0 items-center gap-3">
            <div
              class="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-lg
                bg-teal-50
                text-teal-800
              "
            >
              <BookOpen :size="16" :stroke-width="1.8" />
            </div>

            <div class="min-w-0">
              <h2
                id="glosarium-indikator-title"
                class="text-xs font-bold text-slate-800"
              >
                Glosarium Indikator Sektoral
              </h2>
              <p class="mt-0.5 text-[10px] text-slate-500">
                Arti singkatan dan rasio yang digunakan
              </p>
            </div>
          </div>

          <p
            class="
              pl-12
              text-[10px]
              leading-4
              text-slate-400
              sm:pl-0
              sm:text-right
            "
          >
            Klasifikasi Standar: Sistem Neraca Nasional (SNA 2008)
          </p>
        </div>

        <dl
          class="
            mt-4
            grid
            grid-cols-1
            gap-2.5
            sm:grid-cols-2
            xl:grid-cols-3
            2xl:grid-cols-6
          "
        >
          <div
            v-for="indicator in [
              { code: 'COE / VA', description: 'Kompensasi tenaga kerja terhadap nilai tambah bruto', accent: 'border-blue-500' },
              { code: 'PMTB / DI', description: 'Pembentukan modal tetap bruto terhadap pendapatan disposabel', accent: 'border-emerald-500' },
              { code: 'IA / OUTPUT', description: 'Alokasi investasi terhadap total output sektoral', accent: 'border-amber-500' },
              { code: 'KMT / PMTB', description: 'Rasio pinjaman neto terhadap pembentukan modal tetap bruto', accent: 'border-orange-500' },
              { code: 'NET / NTB', description: 'Neraca neto sektoral terhadap nilai tambah bruto', accent: 'border-violet-500' },
              { code: 'CAB / GDP', description: 'Keseimbangan Eksternal Berjalan / Nilai Tambah Bruto', accent: 'border-rose-500' }
            ]"
            :key="indicator.code"
            class="
              min-w-0
              rounded-xl
              border-l-2
              border-y
              border-r
              border-y-slate-200/80
              border-r-slate-200/80
              bg-white
              px-3.5
              py-3
              shadow-[0_3px_12px_rgba(15,23,42,0.035)]
              transition duration-200
              hover:-translate-y-0.5
              hover:bg-slate-50/80
              hover:shadow-sm
            "
            :class="indicator.accent"
          >
            <dt class="text-[10px] font-bold text-slate-800">
              {{ indicator.code }}
            </dt>
            <dd class="mt-1.5 text-[10px] leading-[1.45] text-slate-500">
              {{ indicator.description }}
            </dd>
          </div>
        </dl>
      </section>


      <section
        class="
          overflow-hidden
          rounded-2xl
          border border-slate-200/80
          border-t-2 border-t-cyan-600
          bg-white
          shadow-[0_6px_20px_rgba(15,23,42,0.045)]
        "
      >

        <!-- TABLE HEADER -->

        <div
          class="
            border-b
            border-slate-200
            px-4
            py-3
          "
        >

          <div
            class="
              flex
              flex-col
              gap-2
              sm:flex-row
              sm:items-end
              sm:justify-between
            "
          >

            <div>

              <h2
                class="
                  text-base
                  font-bold
                  text-slate-800
                "
              >
                Tabel Statistik
              </h2>

              <p
                class="
                  mt-1
                  text-xs
                  text-slate-400
                "
              >
                Cari berdasarkan periode, sektor, frekuensi, jenis rasio, atau nilai.
              </p>

            </div>

            <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <label class="relative block w-full sm:w-72">
                <Search
                  :size="15"
                  class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  v-model="tableSearch"
                  type="search"
                  aria-label="Cari tabel statistik"
                  placeholder="Cari sektor, periode, rasio..."
                  class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
                />
                <button
                  v-if="tableSearch"
                  type="button"
                  aria-label="Hapus pencarian tabel"
                  title="Hapus pencarian"
                  class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  @click="tableSearch = ''"
                >
                  <X :size="13" />
                </button>
              </label>

              <span class="whitespace-nowrap text-[10px] font-semibold text-slate-500">
                {{ searchedTable.length.toLocaleString('id-ID') }} / {{ statisticTable.length.toLocaleString('id-ID') }} baris
              </span>
            </div>

          </div>

        </div>


        <!-- TABLE -->

        <div class="overflow-x-auto">

          <table
            class="
              min-w-max
              w-full
              border-collapse
            "
          >

            <thead>

              <tr
                class="
                  sticky
                  top-0
                  z-10
                  border-b
                  border-slate-200
                  bg-slate-50
                "
              >

                <th
                  class="
                    px-3
                    py-2.5
                    text-left
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-wide
                    text-slate-500
                  "
                >
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 hover:text-slate-800"
                    :aria-sort="tableSortKey === 'periode'
                      ? (tableSortDirection === 'asc' ? 'ascending' : 'descending')
                      : 'none'"
                    @click="toggleTableSort('periode')"
                  >
                    Periode
                    <component :is="getTableSortIcon('periode')" :size="12" />
                  </button>
                </th>

                <th
                  class="
                    px-3
                    py-2.5
                    text-left
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-wide
                    text-slate-500
                  "
                >
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 hover:text-slate-800"
                    :aria-sort="tableSortKey === 'sektor'
                      ? (tableSortDirection === 'asc' ? 'ascending' : 'descending')
                      : 'none'"
                    @click="toggleTableSort('sektor')"
                  >
                    Sektor
                    <component :is="getTableSortIcon('sektor')" :size="12" />
                  </button>
                </th>

                <th
                  v-for="ratio in tableRatioTypes"
                  :key="ratio"
                  class="
                    whitespace-nowrap
                    px-3
                    py-2.5
                    text-right
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-wide
                    text-slate-500
                  "
                >
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 hover:text-slate-800"
                    :aria-sort="tableSortKey === `ratio:${ratio}`
                      ? (tableSortDirection === 'asc' ? 'ascending' : 'descending')
                      : 'none'"
                    @click="toggleTableSort(`ratio:${ratio}`)"
                  >
                    {{ ratio }}
                    <component :is="getTableSortIcon(`ratio:${ratio}`)" :size="12" />
                  </button>
                </th>

              </tr>

            </thead>


            <tbody>

              <tr
                v-for="row in paginatedTable"
                :key="row.key"
                class="
                  border-b
                  border-slate-100
                  even:bg-slate-50/50
                  transition
                  hover:bg-slate-50
                "
              >

                <td
                  class="
                    whitespace-nowrap
                    px-3
                    py-2.5
                    text-sm
                    font-semibold
                    text-slate-700
                  "
                >
                  <span>{{ row.periode }}</span>
                  <span
                    class="ml-1.5 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase"
                    :class="row.periode.includes('/Q')
                      ? 'bg-cyan-50 text-cyan-700'
                      : 'bg-teal-50 text-teal-800'"
                  >
                    {{ row.periode.includes('/Q') ? 'Triwulan' : 'Tahunan' }}
                  </span>
                </td>

                <td
                  class="
                    whitespace-nowrap
                    px-3
                    py-2.5
                    text-xs
                    text-slate-600
                  "
                >
                  <span class="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1">
                    <span
                      class="h-1.5 w-1.5 shrink-0 rounded-full"
                      :style="{ backgroundColor: sectorColors[row.sektor] || '#64748b' }"
                    ></span>
                    <span class="text-[10px] font-bold text-slate-700">{{ row.sektor }}</span>
                    <span class="text-[9px] text-slate-500">{{ getSectorName(row.sektor) }}</span>
                  </span>
                </td>

                <td
                  v-for="ratio in tableRatioTypes"
                  :key="ratio"
                  class="
                    whitespace-nowrap
                    px-3
                    py-2.5
                    text-right
                    text-xs
                    tabular-nums
                  "
                  :class="numericValue(row.values[ratio]) === null
                    ? 'text-slate-400'
                    : numericValue(row.values[ratio]) > 0
                      ? 'text-emerald-700'
                      : numericValue(row.values[ratio]) < 0
                        ? 'text-rose-600'
                        : 'text-slate-600'"
                >
                  {{ formatRatioValue(row.values[ratio]) }}
                </td>

              </tr>


              <tr
                v-if="paginatedTable.length === 0"
              >

                <td
                  :colspan="tableRatioTypes.length + 2"
                  class="
                    px-5
                    py-12
                    text-center
                    text-sm
                    text-slate-400
                  "
                >
                  {{ tableSearch
                    ? 'Tidak ada baris yang cocok dengan pencarian.'
                    : 'Tidak ada data yang sesuai dengan filter.' }}
                </td>

              </tr>

            </tbody>

          </table>

        </div>


        <!-- PAGINATION -->

        <div
          class="
            flex
            flex-col
            gap-4
            border-t
            border-slate-200
            px-4
            py-3
            lg:flex-row
            lg:items-center
            lg:justify-between
          "
        >

          <div class="flex flex-col gap-1 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:gap-2">
            <span>
              Menampilkan
              <strong class="text-slate-700">{{ pageRangeStart }} - {{ pageRangeEnd }}</strong>
              dari
              <strong class="text-slate-700">{{ sortedTable.length.toLocaleString('id-ID') }}</strong>
              baris
            </span>
            <span v-if="tableSearch" class="text-slate-400">(hasil pencarian)</span>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
            <label class="flex items-center gap-2 whitespace-nowrap text-[10px] text-slate-500">
              Baris per halaman
              <select
                v-model.number="itemsPerPage"
                class="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option :value="10">10</option>
                <option :value="25">25</option>
                <option :value="50">50</option>
              </select>
            </label>

            <nav class="flex items-center gap-1" aria-label="Navigasi halaman tabel">
              <button
                type="button"
                aria-label="Halaman sebelumnya"
                @click="goToPage(currentPage - 1)"
                :disabled="currentPage === 1 || sortedTable.length === 0"
                class="rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sebelumnya
              </button>

              <template v-for="page in pageNumbers" :key="`page-${page}`">
                <button
                  v-if="typeof page === 'number'"
                  type="button"
                  :aria-label="`Halaman ${page}`"
                  :aria-current="currentPage === page ? 'page' : undefined"
                  @click="goToPage(page)"
                  class="h-7 min-w-7 rounded-md px-2 text-[10px] font-semibold transition"
                  :class="currentPage === page
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'"
                >
                  {{ page }}
                </button>
                <span v-else class="px-1 text-[10px] text-slate-400">...</span>
              </template>

              <button
                type="button"
                aria-label="Halaman berikutnya"
                @click="goToPage(currentPage + 1)"
                :disabled="currentPage === totalPages || sortedTable.length === 0"
                class="rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Berikutnya
              </button>
            </nav>
          </div>

        </div>

      </section>


      <!-- ===================================================
           KETERANGAN
      ==================================================== -->

      <section
        class="
          rounded-2xl
          border
          border-slate-200
          bg-slate-50
          px-5
          py-4
        "
      >

        <div class="flex gap-3">

          <div
            class="
              mt-0.5
              flex
              h-7
              w-7
              shrink-0
              items-center
              justify-center
              rounded-lg
              bg-white
              text-xs
              font-bold
              text-slate-500
              shadow-sm
            "
          >
            i
          </div>

          <p
            class="
              text-xs
              leading-5
              text-slate-500
            "
          >
            <span
              class="
                font-semibold
                text-slate-700
              "
            >
              Keterangan:
            </span>

            Data tahunan dan triwulanan ditampilkan
            pada visualisasi yang terpisah. Nilai
            indikator ditampilkan sesuai dengan
            data sumber.
          </p>

        </div>

      </section>

    </template>

  </div>

</template>
