<script setup>
import {
  computed,
  onMounted,
  ref,
  watch
} from 'vue'

import VChart from 'vue-echarts'

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
  getAnalisisRasio
} from '../services/dashboardApi'


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

const error = ref('')


/*
|--------------------------------------------------------------------------
| FILTER
|--------------------------------------------------------------------------
*/

const selectedSektor = ref([])

const isSektorOpen = ref(false)

const selectedPeriode = ref('')

const selectedJenisRasio = ref('')


/*
|--------------------------------------------------------------------------
| PAGINATION
|--------------------------------------------------------------------------
*/

const currentPage = ref(1)

const itemsPerPage = 10


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


const ratioDescriptions = {
  'COE/VA':
    'Kompensasi Tenaga Kerja / Nilai Tambah Bruto',

  'PMTB/DI':
    'Pembentukan Modal Tetap Bruto / Pendapatan Disposabel Bruto',

  'IA/Output':
    'Konsumsi Antara / Output'
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

function resetSektor() {

  selectedSektor.value = []

  resetPage()

}


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

  const parsed =
    Number(
      String(value)
        .trim()
        .replace(/\./g, '')
        .replace(',', '.')
    )

  return Number.isFinite(parsed)
    ? parsed
    : null

}


/*
|--------------------------------------------------------------------------
| FORMAT NUMBER
|--------------------------------------------------------------------------
|
| Untuk hasil agregasi.
|
*/

function formatAggregatedValue(value) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {

    return '-'

  }

  return String(value)
    .replace('.', ',')

}


/*
|--------------------------------------------------------------------------
| SEKTOR OPTIONS
|--------------------------------------------------------------------------
*/

const sektorOptions = computed(() => {

  return [
    ...new Set(
      data.value
        .map(
          item =>
            String(
              item.SEKTOR ?? ''
            ).trim()
        )
        .filter(Boolean)
    )
  ]

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
  ].sort(
    (a, b) =>
      String(a).localeCompare(
        String(b),
        undefined,
        {
          numeric: true
        }
      )
  )

})


/*
|--------------------------------------------------------------------------
| JENIS RASIO OPTIONS
|--------------------------------------------------------------------------
*/

const jenisRasioOptions = computed(() => {

  return [
    ...new Set(
      data.value
        .map(
          item =>
            item['JENIS RASIO']
        )
        .filter(Boolean)
    )
  ]

})


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

    const sektor =
      String(
        item.SEKTOR ?? ''
      ).trim()


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
      !selectedPeriode.value ||
      String(item.TAHUN) ===
        String(selectedPeriode.value)


    const matchJenisRasio =
      !selectedJenisRasio.value ||
      item['JENIS RASIO'] ===
        selectedJenisRasio.value


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

const aggregatedData = computed(() => {

  const map = new Map()


  filteredData.value.forEach(item => {

    const periode =
      item.TAHUN

    const jenis =
      item['JENIS RASIO']


    if (
      !periode ||
      !jenis
    ) {

      return

    }


    const key =
      `${periode}__${jenis}`


    if (!map.has(key)) {

      map.set(
        key,
        {
          ...item,
          NILAI: 0,
          _numericValue: 0,
          _hasNumericValue: false
        }
      )

    }


    const row =
      map.get(key)


    const numeric =
      numericValue(
        item.NILAI
      )


    if (
      numeric !== null
    ) {

      row._numericValue += numeric

      row._hasNumericValue = true

    }

  })


  return Array
    .from(map.values())
    .map(item => ({

      ...item,

      NILAI:
        item._hasNumericValue
          ? formatAggregatedValue(
              item._numericValue
            )
          : '-'

    }))
    .sort(
      (a, b) =>
        String(a.TAHUN).localeCompare(
          String(b.TAHUN),
          undefined,
          {
            numeric: true
          }
        )
    )

})


/*
|--------------------------------------------------------------------------
| DATA TAHUNAN
|--------------------------------------------------------------------------
*/

const annualData = computed(() => {

  return aggregatedData.value.filter(
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

  return aggregatedData.value.filter(
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


  aggregatedData.value.forEach(item => {

    const periode =
      item.TAHUN


    if (!map.has(periode)) {

      map.set(
        periode,
        {
          periode,

          'COE/VA': '-',

          'PMTB/DI': '-',

          'IA/Output': '-'
        }
      )

    }


    const row =
      map.get(periode)


    const jenis =
      item['JENIS RASIO']


    if (
      Object.prototype.hasOwnProperty.call(
        row,
        jenis
      )
    ) {

      row[jenis] =
        rawValue(
          item.NILAI
        )

    }

  })


  return Array
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
    )

})


/*
|--------------------------------------------------------------------------
| PAGINATION
|--------------------------------------------------------------------------
*/

const totalPages = computed(() => {

  return Math.max(
    1,
    Math.ceil(
      statisticTable.value.length /
      itemsPerPage
    )
  )

})


const paginatedTable = computed(() => {

  const start =
    (
      currentPage.value - 1
    ) *
    itemsPerPage


  return statisticTable.value.slice(
    start,
    start + itemsPerPage
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

  selectedPeriode.value = ''

  selectedJenisRasio.value = ''

  resetPage()

}


/*
|--------------------------------------------------------------------------
| KPI
|--------------------------------------------------------------------------
*/

function getLatestRatio(ratio) {

  const rows =
    aggregatedData.value
      .filter(
        item =>
          item['JENIS RASIO'] ===
          ratio
      )
      .sort(
        (a, b) =>
          String(a.TAHUN).localeCompare(
            String(b.TAHUN),
            undefined,
            {
              numeric: true
            }
          )
      )


  if (
    rows.length === 0
  ) {

    return '-'

  }


  return rawValue(
    rows[
      rows.length - 1
    ].NILAI
  )

}


function getLatestPeriod() {

  const periods =
    statisticTable.value.map(
      item =>
        item.periode
    )


  if (
    periods.length === 0
  ) {

    return '-'

  }


  return periods[
    periods.length - 1
  ]

}


/*
|--------------------------------------------------------------------------
| CHART ROW BUILDER
|--------------------------------------------------------------------------
*/

function buildChartRows(sourceData) {

  const map = new Map()


  sourceData.forEach(item => {

    const periode =
      item.TAHUN


    if (!map.has(periode)) {

      map.set(
        periode,
        {
          periode,

          'COE/VA': null,

          'PMTB/DI': null,

          'IA/Output': null
        }
      )

    }


    const row =
      map.get(periode)


    const jenis =
      item['JENIS RASIO']


    const numeric =
      numericValue(
        item.NILAI
      )


    if (
      ratioTypes.includes(jenis)
    ) {

      row[jenis] =
        numeric !== null
          ? numeric
          : null

    }

  })


  return Array
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
    )

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

  if (
    selectedJenisRasio.value
  ) {

    return [
      selectedJenisRasio.value
    ]

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


/*
|--------------------------------------------------------------------------
| WATCH
|--------------------------------------------------------------------------
*/

watch(
  [
    selectedSektor,
    selectedPeriode,
    selectedJenisRasio
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

  loadData()

})
</script>


<template>

  <div class="space-y-6 pb-10">

    <!-- =====================================================
         HEADER
    ====================================================== -->

    <section>
      <div class="flex flex-col gap-1">

        <p
          class="
            text-xs
            font-semibold
            uppercase
            tracking-[0.18em]
            text-blue-600
          "
        >
          Statistik Ekonomi
        </p>

        <h1
          class="
            text-2xl
            font-bold
            tracking-tight
            text-slate-900
          "
        >
          Analisis Rasio
        </h1>

        <p
          class="
            max-w-3xl
            text-sm
            leading-6
            text-slate-500
          "
        >
          Menampilkan perkembangan rasio ekonomi sektoral
          berdasarkan data tahunan dan triwulanan.
        </p>

      </div>
    </section>


    <!-- =====================================================
         FILTER
    ====================================================== -->

    <section
      class="
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
        shadow-sm
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

        <div>
          <h2
            class="
              text-sm
              font-bold
              text-slate-800
            "
          >
            Pilih Data
          </h2>

          <p
            class="
              mt-1
              text-xs
              text-slate-400
            "
          >
            Sesuaikan sektor, periode, dan jenis rasio
            yang ingin ditampilkan.
          </p>
        </div>

        <button
          type="button"
          @click="resetFilters"
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
            hover:border-slate-300
            hover:bg-slate-50
            sm:self-auto
          "
        >
          Atur Ulang
        </button>

      </div>


      <!-- FILTER CONTENT -->

      <div
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

    <template v-else>

      <!-- ===================================================
           ACTIVE FILTER
      ==================================================== -->

      <section
        class="
          rounded-2xl
          border
          border-slate-200
          bg-white
          px-5
          py-4
          shadow-sm
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
                bg-blue-50
                px-3
                py-1.5
                text-[11px]
                font-semibold
                text-blue-700
              "
            >
              Sektor:
              {{ selectedSektor.join(', ') }}
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
                selectedPeriode
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-slate-50 text-slate-400'
              "
            >
              Periode:
              {{ selectedPeriode || 'Semua' }}
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
                selectedJenisRasio
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-slate-50 text-slate-400'
              "
            >
              Rasio:
              {{ selectedJenisRasio || 'Semua' }}
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
              Ringkasan Indikator
            </h2>

            <p
              class="
                mt-1
                text-xs
                text-slate-400
              "
            >
              Nilai indikator berdasarkan data
              yang telah dipilih.
            </p>

          </div>

          <span
            class="
              text-xs
              text-slate-400
            "
          >
            Periode terbaru:
            <span class="font-semibold text-slate-600">
              {{ getLatestPeriod() }}
            </span>
          </span>

        </div>


        <div
          class="
            grid
            grid-cols-1
            gap-4
            md:grid-cols-3
          "
        >

          <div
            v-for="ratio in ratioTypes"
            :key="ratio"
            class="
              group
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              shadow-sm
              transition
              hover:-translate-y-0.5
              hover:shadow-md
            "
          >

            <div
              class="
                flex
                items-center
                justify-between
              "
            >

              <span
                class="
                  text-sm
                  font-bold
                  text-slate-700
                "
              >
                {{ ratio }}
              </span>

              <span
                class="
                  rounded-full
                  bg-blue-50
                  px-2.5
                  py-1
                  text-[10px]
                  font-semibold
                  text-blue-600
                "
              >
                Rasio
              </span>

            </div>

            <div
              class="
                mt-4
                text-3xl
                font-bold
                tracking-tight
                text-slate-900
              "
            >
              {{ getLatestRatio(ratio) }}
            </div>

            <p
              class="
                mt-2
                text-xs
                leading-5
                text-slate-400
              "
            >
              {{ ratioDescriptions[ratio] }}
            </p>

          </div>

        </div>

      </section>


      <!-- ===================================================
           CHART TAHUNAN
      ==================================================== -->

      <section
        class="
          overflow-hidden
          rounded-2xl
          border
          border-slate-200
          bg-white
          shadow-sm
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
                Perkembangan Rasio Tahunan
              </h2>

              <p
                class="
                  mt-1
                  text-xs
                  text-slate-400
                "
              >
                Perkembangan indikator rasio
                berdasarkan tahun.
              </p>

            </div>

            <span
              class="
                w-fit
                rounded-full
                bg-slate-50
                px-2.5
                py-1
                text-[10px]
                font-semibold
                text-slate-500
              "
            >
              Data Tahunan
            </span>

          </div>

        </div>


        <div
          v-if="annualChartRows.length > 0"
          class="h-[380px] p-3 sm:p-4"
        >

          <VChart
            :option="annualChartOption"
            autoresize
            class="h-full w-full"
          />

        </div>


        <div
          v-else
          class="
            flex
            h-[280px]
            items-center
            justify-center
            text-sm
            text-slate-400
          "
        >
          Tidak ada data tahunan.
        </div>

      </section>


      <!-- ===================================================
           CHART TRIWULANAN
      ==================================================== -->

      <section
        class="
          overflow-hidden
          rounded-2xl
          border
          border-slate-200
          bg-white
          shadow-sm
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
                Perkembangan Rasio Triwulanan
              </h2>

              <p
                class="
                  mt-1
                  text-xs
                  text-slate-400
                "
              >
                Perkembangan indikator rasio
                berdasarkan periode triwulanan.
              </p>

            </div>

            <span
              class="
                w-fit
                rounded-full
                bg-slate-50
                px-2.5
                py-1
                text-[10px]
                font-semibold
                text-slate-500
              "
            >
              Data Triwulanan
            </span>

          </div>

        </div>


        <div
          v-if="quarterlyChartRows.length > 0"
          class="h-[380px] p-3 sm:p-4"
        >

          <VChart
            :option="quarterlyChartOption"
            autoresize
            class="h-full w-full"
          />

        </div>


        <div
          v-else
          class="
            flex
            h-[280px]
            items-center
            justify-center
            text-sm
            text-slate-400
          "
        >
          Tidak ada data triwulanan.
        </div>

      </section>


      <!-- ===================================================
           TABEL STATISTIK
      ==================================================== -->

      <section
        class="
          overflow-hidden
          rounded-2xl
          border
          border-slate-200
          bg-white
          shadow-sm
        "
      >

        <!-- TABLE HEADER -->

        <div
          class="
            border-b
            border-slate-200
            px-5
            py-5
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
                Nilai rasio menurut periode
                pengamatan.
              </p>

            </div>

            <span
              class="
                w-fit
                rounded-full
                bg-slate-50
                px-2.5
                py-1
                text-[10px]
                font-semibold
                text-slate-500
              "
            >
              {{ statisticTable.length }} periode
            </span>

          </div>

        </div>


        <!-- TABLE -->

        <div class="overflow-x-auto">

          <table
            class="
              min-w-full
              border-collapse
            "
          >

            <thead>

              <tr
                class="
                  border-b
                  border-slate-200
                  bg-slate-50
                "
              >

                <th
                  class="
                    px-5
                    py-3.5
                    text-left
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-wide
                    text-slate-500
                  "
                >
                  Periode
                </th>

                <th
                  class="
                    px-5
                    py-3.5
                    text-right
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-wide
                    text-slate-500
                  "
                >
                  COE/VA
                </th>

                <th
                  class="
                    px-5
                    py-3.5
                    text-right
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-wide
                    text-slate-500
                  "
                >
                  PMTB/DI
                </th>

                <th
                  class="
                    px-5
                    py-3.5
                    text-right
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-wide
                    text-slate-500
                  "
                >
                  IA/Output
                </th>

              </tr>

            </thead>


            <tbody>

              <tr
                v-for="row in paginatedTable"
                :key="row.periode"
                class="
                  border-b
                  border-slate-100
                  transition
                  hover:bg-slate-50
                "
              >

                <td
                  class="
                    whitespace-nowrap
                    px-5
                    py-3.5
                    text-sm
                    font-semibold
                    text-slate-700
                  "
                >
                  {{ row.periode }}
                </td>

                <td
                  class="
                    px-5
                    py-3.5
                    text-right
                    text-sm
                    tabular-nums
                    text-slate-600
                  "
                >
                  {{ row['COE/VA'] }}
                </td>

                <td
                  class="
                    px-5
                    py-3.5
                    text-right
                    text-sm
                    tabular-nums
                    text-slate-600
                  "
                >
                  {{ row['PMTB/DI'] }}
                </td>

                <td
                  class="
                    px-5
                    py-3.5
                    text-right
                    text-sm
                    tabular-nums
                    text-slate-600
                  "
                >
                  {{ row['IA/Output'] }}
                </td>

              </tr>


              <tr
                v-if="paginatedTable.length === 0"
              >

                <td
                  colspan="4"
                  class="
                    px-5
                    py-12
                    text-center
                    text-sm
                    text-slate-400
                  "
                >
                  Tidak ada data yang sesuai
                  dengan filter.
                </td>

              </tr>

            </tbody>

          </table>

        </div>


        <!-- PAGINATION -->

        <div
          v-if="totalPages > 1"
          class="
            flex
            flex-col
            gap-3
            border-t
            border-slate-200
            px-5
            py-4
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <button
            type="button"
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="
              rounded-lg
              border
              border-slate-200
              px-3
              py-2
              text-xs
              font-medium
              text-slate-600
              transition
              hover:bg-slate-50
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            ← Sebelumnya
          </button>


          <span
            class="
              text-center
              text-xs
              text-slate-400
            "
          >
            Halaman
            <span
              class="
                font-semibold
                text-slate-600
              "
            >
              {{ currentPage }}
            </span>
            dari
            <span
              class="
                font-semibold
                text-slate-600
              "
            >
              {{ totalPages }}
            </span>
          </span>


          <button
            type="button"
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="
              rounded-lg
              border
              border-slate-200
              px-3
              py-2
              text-xs
              font-medium
              text-slate-600
              transition
              hover:bg-slate-50
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            Berikutnya →
          </button>

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
