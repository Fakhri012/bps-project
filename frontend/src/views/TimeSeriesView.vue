<script setup>
import {
  ref,
  computed,
  nextTick
} from 'vue'

import {
  Activity,
  CalendarRange,
  TrendingUp
} from 'lucide-vue-next'

import {
  getTahunanTimeSeries,
  getTriwulananTimeSeries
} from '../services/dashboardApi'

import TimeSeriesFilter
  from '../components/timeseries/TimeSeriesFilter.vue'

import ExportActions
  from '../components/ExportActions.vue'

import TimeSeriesActiveFilters
  from '../components/timeseries/TimeSeriesActiveFilters.vue'

import TimeSeriesKpi
  from '../components/timeseries/TimeSeriesKpi.vue'

import AnnualTimeSeriesChart
  from '../components/timeseries/AnnualTimeSeriesChart.vue'

import QuarterlyTimeSeriesChart
  from '../components/timeseries/QuarterlyTimeSeriesChart.vue'

import TimeSeriesNeracaComparisonChart
  from '../components/timeseries/TimeSeriesNeracaComparisonChart.vue'

import {
  publishChangedFilters
} from '../composables/filterState.js'

import {
  formatDisplayNumber
} from '../utils/displayFormatters.js'

import {
  buildExportFilename,
  downloadCsvFile,
  exportChartsPdf
} from '../utils/reportExport.js'

const loading =
  ref(false)

const hasAppliedFilters =
  ref(false)

const error =
  ref('')

const exportingPdf =
  ref(false)

const tahunanData =
  ref([])

const triwulananData =
  ref([])

const tahunanKlasifikasiData =
  ref([])

const triwulananKlasifikasiData =
  ref([])

const chartMode =
  ref('both')


/*
|--------------------------------------------------------------------------
| CHART RENDER KEY
|--------------------------------------------------------------------------
|
| Digunakan untuk memaksa ECharts
| dibuat ulang ketika ukuran layout berubah.
|
*/

const chartRenderKey =
  ref(0)


/*
|--------------------------------------------------------------------------
| SET CHART MODE
|--------------------------------------------------------------------------
*/

async function setChartMode(
  mode
) {
  if (
    chartMode.value ===
    mode
  ) {
    return
  }


  chartMode.value =
    mode


  /*
   * Tunggu Vue menyelesaikan perubahan
   * grid 1 / 2 kolom.
   */

  await nextTick()


  /*
   * Tunggu browser selesai
   * menghitung ukuran container.
   */

  requestAnimationFrame(
    () => {
      requestAnimationFrame(
        () => {
          chartRenderKey.value += 1
        }
      )
    }
  )
}


/*
|--------------------------------------------------------------------------
| CHART VISIBILITY
|--------------------------------------------------------------------------
*/

const showAnnual =
  computed(
    () => {
      return (
        chartMode.value ===
          'both' ||
        chartMode.value ===
          'annual'
      )
    }
  )


const showQuarterly =
  computed(
    () => {
      return (
        chartMode.value ===
          'both' ||
        chartMode.value ===
          'quarterly'
      )
    }
  )


/*
|--------------------------------------------------------------------------
| ACTIVE FILTER
|--------------------------------------------------------------------------
*/

const activeFilters =
  ref({
    tahun: [],
    triwulan: [],
    sisi: [],
    neraca: [],
    klasifikasi: [],
    institusi: []
  })

let previousSharedFilters = null


/*
|--------------------------------------------------------------------------
| CAKUPAN TAHUNAN
|--------------------------------------------------------------------------
*/

const annualRange =
  computed(
    () => {
      if (
        !Array.isArray(
          tahunanData.value
        ) ||
        tahunanData.value.length ===
          0
      ) {
        return 'Belum tersedia'
      }


      const years =
        tahunanData.value
          .map(
            item =>
              Number(
                item.tahun
              )
          )
          .filter(
            Number.isFinite
          )
          .sort(
            (a, b) =>
              a - b
          )


      if (
        years.length === 0
      ) {
        return 'Belum tersedia'
      }


      const first =
        years[0]

      const last =
        years[
          years.length - 1
        ]


      if (
        first === last
      ) {
        return String(
          first
        )
      }


      return `${first} – ${last}`
    }
  )

const annualPeriodCount =
  computed(
    () =>
      new Set(
        tahunanData.value.map(
          item =>
            Number(item.tahun)
        ).filter(
          Number.isFinite
        )
      ).size
  )


/*
|--------------------------------------------------------------------------
| CAKUPAN TRIWULANAN
|--------------------------------------------------------------------------
*/

const quarterlyRange =
  computed(
    () => {
      if (
        !Array.isArray(
          triwulananData.value
        ) ||
        triwulananData.value.length ===
          0
      ) {
        return 'Belum tersedia'
      }


      const rows =
        [
          ...triwulananData.value
        ]
          .filter(
            item => {
              const tahun =
                Number(
                  item.tahun
                )

              const triwulan =
                Number(
                  item.triwulan
                )


              return (
                Number.isFinite(
                  tahun
                ) &&
                Number.isInteger(
                  triwulan
                ) &&
                triwulan >= 1 &&
                triwulan <= 4
              )
            }
          )
          .sort(
            (a, b) => {
              const yearDiff =
                Number(
                  a.tahun
                ) -
                Number(
                  b.tahun
                )


              if (
                yearDiff !== 0
              ) {
                return yearDiff
              }


              return (
                Number(
                  a.triwulan
                ) -
                Number(
                  b.triwulan
                )
              )
            }
          )


      if (
        rows.length === 0
      ) {
        return 'Belum tersedia'
      }


      const first =
        rows[0]

      const last =
        rows[
          rows.length - 1
        ]


      const firstLabel =
        `${first.tahun} Q${first.triwulan}`

      const lastLabel =
        `${last.tahun} Q${last.triwulan}`


      if (
        firstLabel ===
        lastLabel
      ) {
        return firstLabel
      }


      return `${firstLabel} – ${lastLabel}`
    }
  )

const quarterlyPeriodCount =
  computed(
    () =>
      new Set(
        triwulananData.value.map(
          item =>
            `${Number(item.tahun)}-Q${Number(item.triwulan)}`
        )
      ).size
  )


/*
|--------------------------------------------------------------------------
| REQUEST ID
|--------------------------------------------------------------------------
|
| Mencegah response request lama
| menimpa request terbaru.
|
*/

let loadRequestId =
  0


/*
|--------------------------------------------------------------------------
| LOAD TIME SERIES
|--------------------------------------------------------------------------
*/

async function loadTimeSeries(
  filters = {}
) {
  const currentRequest =
    ++loadRequestId

  loading.value =
    true

  error.value =
    ''


  try {
    /*
    |--------------------------------------------------------------------------
    | FILTER TAHUNAN
    |--------------------------------------------------------------------------
    |
    | Tahunan tidak menggunakan triwulan.
    |
    */

    const tahunanFilters = {
      tahun:
        filters.tahun ||
        [],

      sisi:
        filters.sisi ||
        [],

      neraca:
        filters.neraca ||
        [],

      klasifikasi:
        filters.klasifikasi ||
        [],

      institusi:
        filters.institusi ||
        []
    }


    /*
    |--------------------------------------------------------------------------
    | FILTER TRIWULANAN
    |--------------------------------------------------------------------------
    */

    const triwulananFilters = {
      tahun:
        filters.tahun ||
        [],

      triwulan:
        filters.triwulan ||
        [],

      sisi:
        filters.sisi ||
        [],

      neraca:
        filters.neraca ||
        [],

      klasifikasi:
        filters.klasifikasi ||
        [],

      institusi:
        filters.institusi ||
        []
    }


    /*
    |--------------------------------------------------------------------------
    | REQUEST PARALEL
    |--------------------------------------------------------------------------
    */

    const [
      tahunanResponse,
      triwulananResponse
    ] =
      await Promise.all(
        [
          getTahunanTimeSeries(
            tahunanFilters
          ),

          getTriwulananTimeSeries(
            triwulananFilters
          )
        ]
      )


    /*
    |--------------------------------------------------------------------------
    | ABAIKAN RESPONSE LAMA
    |--------------------------------------------------------------------------
    */

    if (
      currentRequest !==
      loadRequestId
    ) {
      return
    }


    /*
    |--------------------------------------------------------------------------
    | SET DATA
    |--------------------------------------------------------------------------
    */

    tahunanData.value =
      Array.isArray(tahunanResponse?.data)
        ? tahunanResponse.data
        : []


    triwulananData.value =
      Array.isArray(triwulananResponse?.data)
        ? triwulananResponse.data
        : []

    tahunanKlasifikasiData.value =
      Array.isArray(
        tahunanResponse?.statistikKlasifikasi
      )
        ? tahunanResponse.statistikKlasifikasi
        : []

    triwulananKlasifikasiData.value =
      Array.isArray(
        triwulananResponse?.statistikKlasifikasi
      )
        ? triwulananResponse.statistikKlasifikasi
        : []


    /*
     * Paksa chart mengambil ukuran
     * terbaru setelah data berubah.
     */

    await nextTick()


    requestAnimationFrame(
      () => {
        chartRenderKey.value += 1
      }
    )


  } catch (err) {
    if (
      currentRequest !==
      loadRequestId
    ) {
      return
    }


    console.error(
      'Load Time Series Error:',
      err
    )


    error.value =
      err
        ?.response
        ?.data
        ?.message ||

      err
        ?.message ||

      'Gagal mengambil data Time Series.'


    tahunanData.value =
      []

    triwulananData.value =
      []

    tahunanKlasifikasiData.value =
      []

    triwulananKlasifikasiData.value =
      []


  } finally {
    if (
      currentRequest ===
      loadRequestId
    ) {
      loading.value =
        false
    }
  }
}


/*
|--------------------------------------------------------------------------
| FILTER CHANGE
|--------------------------------------------------------------------------
*/

function handleFilterChange(
  filters = {},
  metadata = {}
) {
  console.log(
  '[TimeSeries] handleFilterChange:',
  filters
)
  activeFilters.value = {
    tahun:
      Array.isArray(
        filters.tahun
      )
        ? [
            ...filters.tahun
          ]
        : [],

    triwulan:
      Array.isArray(
        filters.triwulan
      )
        ? [
            ...filters.triwulan
          ]
        : [],

    sisi:
      Array.isArray(
        filters.sisi
      )
        ? [
            ...filters.sisi
          ]
        : [],

    neraca:
      Array.isArray(
        filters.neraca
      )
        ? [
            ...filters.neraca
          ]
        : [],

    klasifikasi:
      Array.isArray(
        filters.klasifikasi
      )
        ? [
            ...filters.klasifikasi
          ]
        : [],

    institusi:
      Array.isArray(
        filters.institusi
      )
        ? [
            ...filters.institusi
          ]
        : []
  }

  if (!metadata.initial) {
    previousSharedFilters = publishChangedFilters(
      previousSharedFilters,
      {
        tahun: activeFilters.value.tahun,
        triwulan: activeFilters.value.triwulan,
        jenis: activeFilters.value.sisi,
        neraca: activeFilters.value.neraca,
        klasifikasi: activeFilters.value.klasifikasi
      },
      [
        'tahun',
        'triwulan',
        'jenis',
        'neraca',
        'klasifikasi'
      ]
    )
  } else {
    previousSharedFilters = publishChangedFilters(
      null,
      {
        tahun: activeFilters.value.tahun,
        triwulan: activeFilters.value.triwulan,
        jenis: activeFilters.value.sisi,
        neraca: activeFilters.value.neraca,
        klasifikasi: activeFilters.value.klasifikasi
      },
      []
    )
  }

  const canLoadData =
    activeFilters.value.neraca.length > 0 &&
    activeFilters.value.klasifikasi.length > 0

  hasAppliedFilters.value =
    canLoadData

  if (!canLoadData) {
    loadRequestId += 1
    loading.value = false
    error.value = ''
    tahunanData.value = []
    triwulananData.value = []
    tahunanKlasifikasiData.value = []
    triwulananKlasifikasiData.value = []
    return
  }

  loadTimeSeries(
    activeFilters.value
  )
}


/*
|--------------------------------------------------------------------------
| NAMA MODE EXPORT
|--------------------------------------------------------------------------
*/

function getExportModeName() {
  if (
    chartMode.value ===
    'annual'
  ) {
    return 'tahunan'
  }


  if (
    chartMode.value ===
    'quarterly'
  ) {
    return 'triwulanan'
  }


  return 'tahunan-triwulanan'
}

function getExportFilters() {
  return {
    Tahun: activeFilters.value.tahun,
    Triwulan: activeFilters.value.triwulan,
    Jenis: activeFilters.value.sisi,
    Neraca: activeFilters.value.neraca,
    Klasifikasi: activeFilters.value.klasifikasi,
    Sektor: activeFilters.value.institusi
  }
}

function getExportPeriod() {
  if (chartMode.value === 'annual') {
    return annualRange.value
  }

  if (chartMode.value === 'quarterly') {
    return quarterlyRange.value
  }

  return `Tahunan ${annualRange.value}; Triwulanan ${quarterlyRange.value}`
}

function getExportFilename(extension) {
  return buildExportFilename({
    page: 'time-series',
    mode: getExportModeName(),
    period: getExportPeriod(),
    filters: getExportFilters(),
    extension
  })
}


/*
|--------------------------------------------------------------------------
| DOWNLOAD CSV
|--------------------------------------------------------------------------
*/

function downloadTimeSeriesCsv() {
  try {
    const rows =
      []


    /*
    |--------------------------------------------------------------------------
    | HEADER
    |--------------------------------------------------------------------------
    */

    rows.push(
      [
        'Jenis Periode',
        'Tahun',
        'Triwulan',
        'Periode',
        'Sektor',
        'Nilai'
      ]
    )


    /*
    |--------------------------------------------------------------------------
    | DATA TAHUNAN
    |--------------------------------------------------------------------------
    */

    if (
      chartMode.value ===
        'both' ||
      chartMode.value ===
        'annual'
    ) {
      tahunanData.value.forEach(
        item => {
          rows.push(
            [
              'Tahunan',

              item.tahun ??
                '',

              '',

              String(
                item.tahun ??
                ''
              ),

              item.seriesName ??
                '',

              item.nilai ??
                ''
            ]
          )
        }
      )
    }


    /*
    |--------------------------------------------------------------------------
    | DATA TRIWULANAN
    |--------------------------------------------------------------------------
    */

    if (
      chartMode.value ===
        'both' ||
      chartMode.value ===
        'quarterly'
    ) {
      triwulananData.value.forEach(
        item => {
          rows.push(
            [
              'Triwulanan',

              item.tahun ??
                '',

              item.triwulan
                ? `Q${item.triwulan}`
                : '',

              item.periode ??
                '',

              item.seriesName ??
                '',

              item.nilai ??
                ''
            ]
          )
        }
      )
    }


    /*
    |--------------------------------------------------------------------------
    | TIDAK ADA DATA
    |--------------------------------------------------------------------------
    */

    if (
      rows.length <= 1
    ) {
      alert(
        'Tidak ada data yang dapat diexport.'
      )

      return
    }


    /*
    |--------------------------------------------------------------------------
    | BUILD CSV
    |--------------------------------------------------------------------------
    */

    downloadCsvFile(
      getExportFilename('csv'),
      rows[0],
      rows.slice(1)
    )


  } catch (err) {
    console.error(
      'Export CSV Error:',
      err
    )


    alert(
      'Gagal melakukan export CSV.'
    )
  }
}


/*
|--------------------------------------------------------------------------
| TUNGGU BROWSER STABIL
|--------------------------------------------------------------------------
*/

function waitForRender() {
  return new Promise(
    resolve => {
      requestAnimationFrame(
        () => {
          requestAnimationFrame(
            () => {
              setTimeout(
                resolve,
                100
              )
            }
          )
        }
      )
    }
  )
}


/*
|--------------------------------------------------------------------------
| EXPORT PDF
|--------------------------------------------------------------------------
*/

async function downloadTimeSeriesPdf() {
  if (
    exportingPdf.value
  ) {
    return
  }

  try {
    exportingPdf.value =
      true

    await nextTick()
    await waitForRender()

    const chartElements = document.querySelectorAll(
      '#time-series-report [data-pdf-chart]'
    )

    await exportChartsPdf({
      filename: getExportFilename('pdf'),
      reportTitle: 'BPS - Time Series Neraca Sektoral',
      mode: getExportModeName(),
      period: getExportPeriod(),
      filters: getExportFilters(),
      chartElements
    })

  } catch (err) {
    console.error(
      'Export PDF Error:',
      err
    )


    alert(
      `Gagal membuat PDF.\n\n${err?.message || 'Terjadi kesalahan saat export.'}`
    )


  } finally {
    exportingPdf.value =
      false
  }
}
</script>


<template>
  <!-- =====================================================
       ROOT / AREA YANG BISA DI-CAPTURE PDF
  ====================================================== -->

  <div
    id="time-series-report"
    class="
      mx-auto
      max-w-[1600px]
      space-y-5
    "
  >
    <!-- =====================================================
         HEADER
    ====================================================== -->

    <section
      class="
        relative
        overflow-hidden
        rounded-2xl
        border
        border-slate-200/80
        border-t-4 border-t-teal-600
        bg-gradient-to-br from-white via-white to-teal-50/60
        px-5
        py-5
        shadow-[0_8px_24px_rgba(15,23,42,0.05)]
        lg:px-6
      "
    >
      <div
        class="
          relative
          flex
          flex-col
          gap-5
          xl:flex-row
          xl:items-center
          xl:justify-between
        "
      >
        <!-- =========================
             LEFT
        ========================== -->

        <div class="min-w-0">
          <!-- BADGE -->

          <div
            class="
              mb-3
              inline-flex
              items-center
              gap-2
              rounded-full
              border border-teal-100
              bg-teal-50
              px-3
              py-1.5
            "
          >
            <TrendingUp
              :size="13"
              class="text-teal-700"
            />

            <span
              class="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.14em]
                text-teal-800
              "
            >
              Time Series
            </span>
          </div>


          <!-- TITLE -->

          <h1
            class="
              text-2xl
              font-bold
              tracking-tight
              text-slate-900
              lg:text-[28px]
            "
          >
            Perkembangan Neraca & Akun Sektoral
          </h1>


          <!-- DESCRIPTION -->

          <p
            class="
              mt-2
              max-w-3xl
              text-sm
              leading-6
              text-slate-500
            "
          >
            Analisis perkembangan nilai neraca institusi
            berdasarkan periode tahunan dan triwulanan
            dari waktu ke waktu.
          </p>
        </div>


        <!-- =========================
             RIGHT INFO
        ========================== -->

        <div
          class="
            flex
            flex-wrap
            items-center
            gap-2.5
            xl:justify-end
          "
        >
          <!-- TAHUNAN -->

          <div
            class="
              flex
              min-w-[165px]
              items-center
              gap-3
              rounded-xl
              border border-slate-200/80
              bg-white/90
              px-3
              py-2.5
              shadow-[0_3px_12px_rgba(15,23,42,0.04)]
            "
          >
            <div
              class="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-lg
                bg-sky-50
                text-sky-700
              "
            >
              <CalendarRange
                :size="16"
                :stroke-width="1.8"
              />
            </div>


            <div class="min-w-0">
              <p
                class="
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-wider
                  text-slate-400
                "
              >
                Cakupan Tahunan
              </p>

              <p
                class="
                  mt-0.5
                  whitespace-nowrap
                  text-[13px]
                  font-bold
                  text-slate-800
                "
              >
                {{ annualRange }}
              </p>

              <p
                class="
                  mt-0.5
                  text-[9px]
                  text-slate-400
                "
              >
                {{ tahunanData.length }}
                titik data
              </p>
            </div>
          </div>


          <!-- TRIWULANAN -->

          <div
            class="
              flex
              min-w-[185px]
              items-center
              gap-3
              rounded-xl
              border border-slate-200/80
              bg-white/90
              px-3
              py-2.5
              shadow-[0_3px_12px_rgba(15,23,42,0.04)]
            "
          >
            <div
              class="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-lg
                bg-emerald-50
                text-emerald-700
              "
            >
              <Activity
                :size="16"
                :stroke-width="1.8"
              />
            </div>


            <div class="min-w-0">
              <p
                class="
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-wider
                  text-slate-400
                "
              >
                Cakupan Triwulanan
              </p>

              <p
                class="
                  mt-0.5
                  whitespace-nowrap
                  text-[13px]
                  font-bold
                  text-slate-800
                "
              >
                {{ quarterlyRange }}
              </p>

              <p
                class="
                  mt-0.5
                  text-[9px]
                  text-slate-400
                "
              >
                {{ triwulananData.length }}
                titik data
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>


    <!-- =====================================================
         FILTER
         Tidak ikut ke PDF
    ====================================================== -->

    <div
      data-html2canvas-ignore="true"
    >
      <TimeSeriesFilter
        @change="handleFilterChange"
      />
    </div>


    <!-- =====================================================
         ACTIVE FILTER
         Ikut ke PDF
    ====================================================== -->

    <TimeSeriesActiveFilters
      :filters="activeFilters"
    />


    <!-- =====================================================
         KPI TIME SERIES
         Ikut ke PDF
    ====================================================== -->

    <TimeSeriesKpi
      v-if="hasAppliedFilters"
      :annual-data="tahunanData"
      :quarterly-data="triwulananData"
    />

    <!-- =====================================================
         CONTROL / EXPORT
         Tidak ikut ke PDF
    ====================================================== -->

    <section
      data-html2canvas-ignore="true"
      class="
        flex
        flex-col
        gap-3
        rounded-xl
        border
        border-slate-200/80
        bg-white
        px-4
        py-3
        shadow-[0_5px_18px_rgba(15,23,42,0.045)]
        sm:flex-row
        sm:items-center
        sm:justify-between
      "
    >
      <!-- =========================
           LEFT
      ========================== -->

      <div>
        <p
          class="
            text-[10px]
            font-bold
            uppercase
            tracking-[0.12em]
            text-slate-400
          "
        >
          Tampilan Grafik
        </p>

        <p
          class="
            mt-0.5
            text-xs
            text-slate-500
          "
        >
          Pilih grafik yang ingin ditampilkan.
        </p>
      </div>


      <!-- =========================
           RIGHT
      ========================== -->

      <div
        class="
          flex
          flex-wrap
          items-center
          gap-2
        "
      >
        <ExportActions
          :csv-disabled="loading || (!tahunanData.length && !triwulananData.length)"
          :pdf-disabled="loading || (!tahunanData.length && !triwulananData.length)"
          :pdf-busy="exportingPdf"
          @csv="downloadTimeSeriesCsv"
          @pdf="downloadTimeSeriesPdf"
        />


        <!-- =========================
             MODE GRAFIK
        ========================== -->

        <div
          class="
            inline-flex
            w-fit
            rounded-lg
            bg-slate-100
            p-1
          "
        >
          <!-- BOTH -->

          <button
            type="button"
            class="
              rounded-md
              px-3.5
              py-1.5
              text-[10px]
              font-semibold
              transition-all
              duration-200
            "
            :class="
              chartMode === 'both'
                ? `
                    bg-white
                    text-slate-800
                    shadow-sm
                  `
                : `
                    text-slate-500
                    hover:text-slate-700
                  `
            "
            @click="
              setChartMode('both')
            "
          >
            Keduanya
          </button>


          <!-- ANNUAL -->

          <button
            type="button"
            class="
              rounded-md
              px-3.5
              py-1.5
              text-[10px]
              font-semibold
              transition-all
              duration-200
            "
            :class="
              chartMode === 'annual'
                ? `
                    bg-white
                    text-blue-600
                    shadow-sm
                  `
                : `
                    text-slate-500
                    hover:text-slate-700
                  `
            "
            @click="
              setChartMode('annual')
            "
          >
            Tahunan
          </button>


          <!-- QUARTERLY -->

          <button
            type="button"
            class="
              rounded-md
              px-3.5
              py-1.5
              text-[10px]
              font-semibold
              transition-all
              duration-200
            "
            :class="
              chartMode === 'quarterly'
                ? `
                    bg-white
                    text-violet-600
                    shadow-sm
                  `
                : `
                    text-slate-500
                    hover:text-slate-700
                  `
            "
            @click="
              setChartMode('quarterly')
            "
          >
            Triwulanan
          </button>
        </div>
      </div>
    </section>


    <!-- =====================================================
         ERROR
    ====================================================== -->

    <div
      v-if="!hasAppliedFilters"
      class="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 text-center text-sm text-slate-500"
    >
      {{
        activeFilters.neraca.length === 0
          ? 'Pilih Neraca terlebih dahulu, lalu pilih Klasifikasi untuk menampilkan data.'
          : 'Pilih Klasifikasi untuk menampilkan data.'
      }}
    </div>

    <template v-else>
    <div
      v-if="error"
      class="
        rounded-xl
        border
        border-red-200
        bg-red-50
        px-4
        py-3
        text-sm
        text-red-700
      "
    >
      {{ error }}
    </div>


    <!-- =====================================================
         LOADING
    ====================================================== -->

    <div
      v-if="loading"
      class="
        grid
        min-w-0
        grid-cols-1
        gap-4
      "
      :class="
        chartMode === 'both'
          ? 'xl:grid-cols-2'
          : 'xl:grid-cols-1'
      "
    >
      <div
        v-for="
          item in
          chartMode === 'both'
            ? 2
            : 1
        "
        :key="item"
        class="
          h-[390px]
          min-w-0
          animate-pulse
          rounded-2xl
          border
          border-slate-200
          bg-gradient-to-br from-white to-slate-50
          p-5
        "
      >
        <div
          class="
            h-3
            w-28
            rounded
            bg-slate-100
          "
        ></div>

        <div
          class="
            mt-3
            h-5
            w-52
            rounded
            bg-slate-100
          "
        ></div>

        <div
          class="
            mt-10
            h-[260px]
            rounded-xl
            bg-slate-50
          "
        ></div>
      </div>
    </div>


    <!-- =====================================================
         CHART AREA
    ====================================================== -->

    <div
      v-else
      class="
        grid
        min-w-0
        w-full
        grid-cols-1
        gap-4
      "
      :class="
        chartMode === 'both'
          ? 'xl:grid-cols-2'
          : 'xl:grid-cols-1'
      "
    >
      <!-- ===================================================
           TAHUNAN
      ==================================================== -->

      <section
        v-if="showAnnual"
        class="
          min-w-0
          w-full
          overflow-hidden
          rounded-2xl
          border
          border-slate-200/80
          bg-white
          border-t-2 border-t-sky-500
          shadow-[0_8px_24px_rgba(15,23,42,0.045)]
          transition-shadow duration-200
          hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]
        "
      >
        <!-- HEADER CHART -->

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
              items-center
              gap-2
            "
          >
            <span
              class="
                h-2
                w-2
                rounded-full
                bg-sky-500
              "
            ></span>

            <p
              class="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.12em]
                text-slate-400
              "
            >
              Tren Tahunan
            </p>
          </div>


          <div
            class="
              mt-1.5
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
                  text-[15px]
                  font-bold
                  text-slate-800
                "
              >
                Perkembangan Nilai Tahunan
              </h2>

              <p
                class="
                  mt-1
                  text-[11px]
                  text-slate-400
                "
              >
                Perubahan nilai dari tahun ke tahun.
              </p>
            </div>


            <span
              class="
                w-fit
                rounded-lg
                bg-sky-50
                px-2.5
                py-1
                text-[9px]
                font-semibold
                text-sky-700
              "
            >
              {{ formatDisplayNumber(annualPeriodCount) }}
              periode
            </span>
          </div>
        </div>


        <!-- CHART -->

        <div
          class="
            h-[350px]
            min-w-0
            w-full
            px-3
            pb-3
            pt-2
          "
        >
          <AnnualTimeSeriesChart
            :data-pdf-chart="tahunanData.length > 0 ? 'annual' : null"
            data-pdf-title="Perkembangan Nilai Tahunan"
            :key="
              `annual-${chartRenderKey}`
            "
            :data="tahunanData"
            :empty-message="
              activeFilters.institusi.length === 0
                ? 'Pilih sektor pada filter Institusi untuk menampilkan grafik.'
                : 'Data Time Series Tahunan tidak tersedia.'
            "
          />
        </div>
      </section>


      <!-- ===================================================
           TRIWULANAN
      ==================================================== -->

      <section
        v-if="showQuarterly"
        class="
          min-w-0
          w-full
          overflow-hidden
          rounded-2xl
          border
          border-slate-200/80
          bg-white
          border-t-2 border-t-teal-500
          shadow-[0_8px_24px_rgba(15,23,42,0.045)]
          transition-shadow duration-200
          hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]
        "
      >
        <!-- HEADER CHART -->

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
              items-center
              gap-2
            "
          >
            <span
              class="
                h-2
                w-2
                rounded-full
                bg-teal-500
              "
            ></span>

            <p
              class="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.12em]
                text-slate-400
              "
            >
              Tren Triwulanan
            </p>
          </div>


          <div
            class="
              mt-1.5
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
                  text-[15px]
                  font-bold
                  text-slate-800
                "
              >
                Perkembangan Nilai Triwulanan
              </h2>

              <p
                class="
                  mt-1
                  text-[11px]
                  text-slate-400
                "
              >
                Perubahan nilai berdasarkan Q1 sampai Q4.
              </p>
            </div>


            <span
              class="
                w-fit
                rounded-lg
                bg-teal-50
                px-2.5
                py-1
                text-[9px]
                font-semibold
                text-teal-700
              "
            >
              {{ formatDisplayNumber(quarterlyPeriodCount) }}
              periode
            </span>
          </div>
        </div>


        <!-- CHART -->

        <div
          class="
            h-[350px]
            min-w-0
            w-full
            px-3
            pb-3
            pt-2
          "
        >
          <QuarterlyTimeSeriesChart
            :data-pdf-chart="triwulananData.length > 0 ? 'quarterly' : null"
            data-pdf-title="Perkembangan Nilai Triwulanan"
            :key="
              `quarterly-${chartRenderKey}`
            "
            :data="triwulananData"
            :empty-message="
              activeFilters.institusi.length === 0
                ? 'Pilih sektor pada filter Institusi untuk menampilkan grafik.'
                : 'Data Time Series Triwulanan tidak tersedia.'
            "
          />
        </div>
      </section>
    </div>

    <TimeSeriesNeracaComparisonChart
      :annual-data="tahunanKlasifikasiData"
      :quarterly-data="triwulananKlasifikasiData"
      :chart-mode="chartMode"
      :selected-klasifikasi="activeFilters.klasifikasi"
      :selected-sectors="activeFilters.institusi"
      :loading="loading"
    />
    </template>
  </div>
</template>