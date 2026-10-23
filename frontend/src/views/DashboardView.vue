<script setup>
import {
  ref,
  computed
} from 'vue'

import {
  LayoutDashboard,
  Sparkles,
  CalendarRange
} from 'lucide-vue-next'

import ExportActions
  from '../components/ExportActions.vue'

import NeracaFilter
  from '../components/dashboard/NeracaFilter.vue'

import NeracaSummary
  from '../components/dashboard/NeracaSummary.vue'

import DonutChart
  from '../components/charts/DonutChart.vue'

import RankingChart
  from '../components/charts/RankingChart.vue'

import {
  getTahunanSummary,
  getTriwulananSummary
} from '../services/dashboardApi'

import {
  normalizeDisplayText
} from '../utils/dashboardText.js'

import {
  formatDisplayNumber
} from '../utils/displayFormatters.js'

import {
  buildExportFilename,
  downloadCsvFile,
  exportChartsPdf
} from '../utils/reportExport.js'

import {
  publishChangedFilters
} from '../composables/filterState.js'


/*
|--------------------------------------------------------------------------
| FILTER AKTIF
|--------------------------------------------------------------------------
*/

const activeFilters = ref({
  periode: 'tahunan',
  jenis: [],
  tahun: [],
  triwulan: [],
  neraca: [],
  klasifikasi: [],
  institusi: []
})

let previousSharedFilters = null


/*
|--------------------------------------------------------------------------
| SUMMARY BACKEND
|--------------------------------------------------------------------------
*/

const backendSummary = ref({
  jumlahBaris: 0,
  totalNilai: 0,
  kontributorTerbesar: null,
  institusi: [],
  metadata: null
})


/*
|--------------------------------------------------------------------------
| STATUS REQUEST
|--------------------------------------------------------------------------
*/

const summaryLoading = ref(false)
const summaryError = ref('')
const exportingDashboardPdf = ref(false)

let summaryRequestId = 0


/*
|--------------------------------------------------------------------------
| LABEL INSTITUSI
|--------------------------------------------------------------------------
|
| Donut dan Ranking menggunakan fungsi yang sama.
| Jadi nama yang tampil selalu konsisten.
|
*/

function getInstitutionLabel(item) {
  return normalizeDisplayText(
    item.nama ||
    item.kode ||
    '-'
  )
}


/*
|--------------------------------------------------------------------------
| DATA INSTITUSI VALID
|--------------------------------------------------------------------------
|
| Semua institusi mengikuti data backend.
|
| NFC Private / NFC Public:
| - tidak ditampilkan di Dashboard
| - tetap tersedia untuk halaman Asset nanti
|
*/

const institutionData =
  computed(() => {
    const data =
      backendSummary.value
        .institusi || []

    return data
      .filter(item => {
        const kode =
          String(
            item.kode ?? ''
          )
            .trim()
            .toUpperCase()

        /*
         * Khusus Dashboard:
         * sembunyikan detail NFC.
         */
        if (
          kode === 'NFC PRIVATE' ||
          kode === 'NFC PUBLIC'
        ) {
          return false
        }

        /*
         * Nilai kosong bukan 0.
         */
        if (
          item.nilai === null ||
          item.nilai === undefined ||
          item.nilai === ''
        ) {
          return false
        }

        const nilai =
          Number(item.nilai)

        return Number.isFinite(
          nilai
        )
      })

      /*
       * Pastikan nilai selalu Number.
       */
      .map(item => ({
        ...item,

        nilai:
          Number(item.nilai)
      }))
  })



  const rankingChartHeight =
  computed(() => {
    const total =
      rankingLabels.value.length

    /*
     * Tinggi minimum.
     */
    if (total <= 4) {
      return 280
    }

    /*
     * Tambah tinggi per institusi.
     */
    return total * 58
  })
/*
|--------------------------------------------------------------------------
| ADA SUMMARY DATA?
|--------------------------------------------------------------------------
|
| Jika backend memiliki institusi dengan nilai valid,
| berarti summary mempunyai data.
|
*/

const hasSummaryData =
  computed(() => {
    return (
      institutionData.value.length >
      0
    )
  })


/*
|--------------------------------------------------------------------------
| DATA RANKING
|--------------------------------------------------------------------------
|
| Ranking menjadi urutan utama.
|
| Positif  : tampil
| Negatif  : tampil
| Nol      : tidak tampil
|
| Diurutkan:
| nilai terbesar -> nilai terkecil.
|
*/

const rankingInstitutionData =
  computed(() => {
    return institutionData.value
      .filter(
        item =>
          item.nilai !== 0
      )
      .sort(
        (a, b) =>
          b.nilai -
          a.nilai
      )
  })


/*
|--------------------------------------------------------------------------
| DATA DONUT
|--------------------------------------------------------------------------
|
| Donut mengikuti urutan Ranking.
|
| Tetapi Donut hanya menerima nilai positif.
|
| Nilai negatif tidak cocok dimasukkan
| ke pie / donut.
|
*/

const donutInstitutionData =
  computed(() => {
    return rankingInstitutionData.value
      .filter(
        item =>
          item.nilai > 0
      )
  })


/*
|--------------------------------------------------------------------------
| ADA DATA RANKING?
|--------------------------------------------------------------------------
*/

const hasRankingData =
  computed(() => {
    return (
      rankingInstitutionData
        .value
        .length > 0
    )
  })


/*
|--------------------------------------------------------------------------
| ADA DATA DONUT?
|--------------------------------------------------------------------------
*/

const hasDonutData =
  computed(() => {
    return (
      donutInstitutionData
        .value
        .length > 0
    )
  })


/*
|--------------------------------------------------------------------------
| ADA NILAI NEGATIF?
|--------------------------------------------------------------------------
|
| Disiapkan apabila nanti ingin menampilkan
| informasi tambahan di UI.
|
*/

const hasNegativeValue =
  computed(() => {
    return institutionData.value.some(
      item =>
        item.nilai < 0
    )
  })


/*
|--------------------------------------------------------------------------
| DONUT LABEL
|--------------------------------------------------------------------------
|
| Urutan otomatis mengikuti ranking.
|
*/

const donutLabels =
  computed(() => {
    return donutInstitutionData
      .value
      .map(
        item =>
          getInstitutionLabel(
            item
          )
      )
  })


/*
|--------------------------------------------------------------------------
| DONUT VALUE
|--------------------------------------------------------------------------
*/

const donutValues =
  computed(() => {
    return donutInstitutionData
      .value
      .map(
        item =>
          item.nilai
      )
  })


/*
|--------------------------------------------------------------------------
| RANKING LABEL
|--------------------------------------------------------------------------
*/

const rankingLabels =
  computed(() => {
    return rankingInstitutionData
      .value
      .map(
        item =>
          getInstitutionLabel(
            item
          )
      )
  })


/*
|--------------------------------------------------------------------------
| RANKING VALUE
|--------------------------------------------------------------------------
*/

const rankingValues =
  computed(() => {
    return rankingInstitutionData
      .value
      .map(
        item =>
          item.nilai
      )
  })


/*
|--------------------------------------------------------------------------
| TOTAL POSITIF DONUT
|--------------------------------------------------------------------------
|
| Berbeda dengan KPI Total Nilai.
|
| Donut:
| hanya nilai positif.
|
| KPI Total Nilai:
| positif + negatif (net).
|
*/

const donutTotalPositif =
  computed(() => {
    return donutValues.value.reduce(
      (
        total,
        value
      ) =>
        total +
        Number(value || 0),

      0
    )
  })


/*
|--------------------------------------------------------------------------
| TOTAL NILAI
|--------------------------------------------------------------------------
|
| Total tetap menggunakan nilai NET dari backend.
|
| Contoh:
|
| +358,99
| -482,85
| --------
| -123,86
|
*/

const totalNilai =
  computed(() => {
    if (
      !hasSummaryData.value
    ) {
      return 'Tidak ada data'
    }

    const total =
      Number(
        backendSummary.value
          .totalNilai
      )

    if (
      !Number.isFinite(total)
    ) {
      return 'Tidak ada data'
    }

    return formatDisplayNumber(total)
  })


/*
|--------------------------------------------------------------------------
| KONTRIBUTOR TERBESAR
|--------------------------------------------------------------------------
*/

const kontributorTerbesar =
  computed(() => {
    if (
      !hasSummaryData.value
    ) {
      return 'Tidak ada data'
    }

    const item =
      backendSummary.value
        .kontributorTerbesar

    if (!item) {
      return 'Tidak ada data'
    }

    /*
     * Proteksi apabila backend
     * suatu saat langsung mengirim string.
     */
    if (
      typeof item === 'string'
    ) {
      return normalizeDisplayText(
        item
      )
    }

    return getInstitutionLabel(
      item
    )
  })


/*
|--------------------------------------------------------------------------
| PARAMETER SUMMARY API
|--------------------------------------------------------------------------
*/

function buildSummaryParams() {
  const params = {
    tahun:
      activeFilters.value
        .tahun || [],

    sisi:
      activeFilters.value
        .jenis || [],

    neraca:
      activeFilters.value
        .neraca || [],

    klasifikasi:
      activeFilters.value
        .klasifikasi || [],

    institusi:
      activeFilters.value
        .institusi || []
  }

  /*
   * Triwulan hanya dikirim
   * pada mode Triwulanan.
   *
   * Q1 -> 1
   * Q2 -> 2
   */
  if (
    activeFilters.value
      .periode ===
    'triwulanan'
  ) {
    params.triwulan =
      (
        activeFilters.value
          .triwulan || []
      ).map(item =>
        String(item)
          .replace(
            /^Q/i,
            ''
          )
      )
  }

  return params
}


/*
|--------------------------------------------------------------------------
| LOAD SUMMARY
|--------------------------------------------------------------------------
*/

async function loadSummary() {
  const currentRequestId =
    ++summaryRequestId

  summaryLoading.value =
    true

  summaryError.value =
    ''

  try {
    const params =
      buildSummaryParams()

    let response

    /*
    |--------------------------------------------------------------------------
    | PILIH ENDPOINT
    |--------------------------------------------------------------------------
    */

    if (
      activeFilters.value
        .periode ===
      'triwulanan'
    ) {
      response =
        await getTriwulananSummary(
          params
        )
    } else {
      response =
        await getTahunanSummary(
          params
        )
    }

    /*
     * Kalau filter sudah berubah lagi,
     * response lama diabaikan.
     */
    if (
      currentRequestId !==
      summaryRequestId
    ) {
      return
    }

    const summary =
      response?.summary || {}

    backendSummary.value = {
      jumlahBaris:
        summary.jumlahBaris ??
        0,

      totalNilai:
        summary.totalNilai ??
        0,

      kontributorTerbesar:
        summary
          .kontributorTerbesar ??
        null,

      institusi:
        summary.institusi ||
        [],

      metadata:
        summary.metadata || null
    }

  } catch (error) {
    /*
     * Abaikan error request lama.
     */
    if (
      currentRequestId !==
      summaryRequestId
    ) {
      return
    }

    console.error(
      'Gagal mengambil summary:',
      error
    )

    summaryError.value =
      error?.response
        ?.data
        ?.message ||
      error?.message ||
      'Gagal mengambil summary'

    backendSummary.value = {
      jumlahBaris: 0,
      totalNilai: 0,
      kontributorTerbesar: null,
      institusi: [],
      metadata: null
    }

  } finally {
    if (
      currentRequestId ===
      summaryRequestId
    ) {
      summaryLoading.value =
        false
    }
  }
}


/*
|--------------------------------------------------------------------------
| FILTER BERUBAH
|--------------------------------------------------------------------------
*/

function handleFilterChange(
  filters,
  metadata = {}
) {
  activeFilters.value = {
    periode:
      filters.periode ||
      'tahunan',

    jenis:
      filters.jenis ||
      [],

    tahun:
      filters.tahun ||
      [],

    triwulan:
      filters.triwulan ||
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

  if (!metadata.initial) {
    previousSharedFilters = publishChangedFilters(
      previousSharedFilters,
      activeFilters.value,
      [
      'periode',
      'jenis',
      'tahun',
      'triwulan',
      'neraca',
      'klasifikasi'
      ]
    )
  } else {
    previousSharedFilters = publishChangedFilters(
      null,
      activeFilters.value,
      []
    )
  }

  loadSummary()
}


/*
|--------------------------------------------------------------------------
| LABEL PERIODE
|--------------------------------------------------------------------------
*/

const periodeLabel =
  computed(() => {
    return (
      activeFilters.value
        .periode ===
      'triwulanan'
    )
      ? 'Triwulanan'
      : 'Tahunan'
  })


/*
|--------------------------------------------------------------------------
| LABEL TAHUN
|--------------------------------------------------------------------------
*/

const tahunLabel =
  computed(() => {
    const selected =
      activeFilters.value
        .tahun || []

    if (
      selected.length === 0
    ) {
      return 'Semua Tahun'
    }

    if (
      selected.length === 1
    ) {
      return selected[0]
    }

    return selected.join(', ')
  })


/*
|--------------------------------------------------------------------------
| LABEL TRIWULAN
|--------------------------------------------------------------------------
*/

const triwulanLabel =
  computed(() => {
    if (
      activeFilters.value
        .periode !==
      'triwulanan'
    ) {
      return null
    }

    const selected =
      activeFilters.value
        .triwulan || []

    if (
      selected.length === 0
    ) {
      return 'Semua Triwulan'
    }

    if (
      selected.length === 1
    ) {
      return selected[0]
    }

    return selected.join(', ')
  })


/*
|--------------------------------------------------------------------------
| LABEL JENIS
|--------------------------------------------------------------------------
*/

const jenisSummary =
  computed(() => {
    const selected =
      activeFilters.value
        .jenis || []

    if (
      selected.length === 0
    ) {
      return 'Semua Jenis'
    }

    return selected
      .map(
        normalizeDisplayText
      )
      .join(', ')
  })


/*
|--------------------------------------------------------------------------
| LABEL NERACA
|--------------------------------------------------------------------------
*/

const neracaSummary =
  computed(() => {
    const selected =
      activeFilters.value
        .neraca || []

    if (
      selected.length === 0
    ) {
      return 'Semua Neraca'
    }

    if (
      selected.length === 1
    ) {
      return normalizeDisplayText(
        selected[0]
      )
    }

    return (
      `${selected.length} Neraca`
    )
  })


/*
|--------------------------------------------------------------------------
| LABEL KLASIFIKASI
|--------------------------------------------------------------------------
*/

const klasifikasiSummary =
  computed(() => {
    const selected =
      activeFilters.value
        .klasifikasi || []

    if (
      selected.length === 0
    ) {
      return 'Semua Klasifikasi'
    }

    if (
      selected.length === 1
    ) {
      return normalizeDisplayText(
        selected[0]
      )
    }

    return (
      `${selected.length} Klasifikasi`
    )
  })

/*
|--------------------------------------------------------------------------
| DESKRIPSI DASHBOARD
|--------------------------------------------------------------------------
*/

const sektorSummary =
  computed(() => {
    const selected =
      activeFilters.value.institusi || []

    const sektorMap = {
      FC: 'Korporasi Finansial',
      NFC: 'Korporasi Nonfinansial',
      HH: 'Rumah Tangga',
      GG: 'Pemerintah Umum',
      NPISHS: 'LNPRT',
      ROW: 'Luar Negeri',
      ODC: 'Lembaga Keuangan Lainnya'
    }

    // Default: 6 sektor utama
    if (selected.length === 0) {
      return [
        'Korporasi Finansial',
        'Korporasi Nonfinansial',
        'Rumah Tangga',
        'Pemerintah Umum',
        'LNPRT',
        'Luar Negeri'
      ].join(', ')
    }

    return selected
      .map(item => {
        const kode =
          String(item)
            .trim()
            .toUpperCase()

        return (
          sektorMap[kode] ||
          normalizeDisplayText(item)
        )
      })
      .join(', ')
  })


const dashboardTitle =
  computed(() => {
    return `Dashboard Neraca Sektoral — ${periodeLabel.value}`
  })


const dashboardDescription =
  computed(() => {
    return (
      `Menampilkan data neraca sektoral untuk ` +
      `${tahunLabel.value.toLowerCase()}, ` +
      `${jenisSummary.value.toLowerCase()}, dan ` +
      `${klasifikasiSummary.value.toLowerCase()}, ` +
      `dengan cakupan sektor ${sektorSummary.value}.`
    )
  })
/*
|--------------------------------------------------------------------------
| LABEL INSTITUSI
|--------------------------------------------------------------------------
*/

const institusiSummary =
  computed(() => {
    const selected =
      activeFilters.value
        .institusi || []

    if (
      selected.length === 0
    ) {
      return 'Semua Institusi'
    }

    if (
      selected.length === 1
    ) {
      return normalizeDisplayText(
        selected[0]
      )
    }

    return (
      `${selected.length} Institusi`
    )
  })


/*
|--------------------------------------------------------------------------
| JUMLAH BARIS
|--------------------------------------------------------------------------
*/

const jumlahBaris =
  computed(() => {
    return Number(
      backendSummary.value
        .jumlahBaris
    ) || 0
  })

function getDashboardExportContext() {
  const filters = activeFilters.value
  const mode = filters.periode === 'triwulanan'
    ? 'triwulanan'
    : 'tahunan'
  const years = filters.tahun || []
  const quarters = filters.triwulan || []
  const period = [
    ...years,
    ...quarters.map(value => `Q${String(value).replace(/^Q/i, '')}`)
  ].join('_') || 'semua-periode'

  return {
    mode,
    period,
    filters: {
      Tahun: years,
      Triwulan: quarters,
      Jenis: filters.jenis || [],
      Neraca: filters.neraca || [],
      Klasifikasi: filters.klasifikasi || [],
      Institusi: filters.institusi || []
    }
  }
}

function downloadDashboardCsv() {
  if (institutionData.value.length === 0) {
    alert('Tidak ada data institusi untuk diekspor.')
    return
  }

  const context = getDashboardExportContext()
  const filename = buildExportFilename({
    page: 'dashboard',
    ...context,
    extension: 'csv'
  })

  downloadCsvFile(
    filename,
    ['Kode Institusi', 'Institusi', 'Nilai'],
    institutionData.value.map(item => [
      item.kode || '',
      getInstitutionLabel(item),
      item.nilai
    ])
  )
}

async function downloadDashboardPdf() {
  if (exportingDashboardPdf.value) {
    return
  }

  const context = getDashboardExportContext()
  const charts = document.querySelectorAll('[data-pdf-chart="dashboard"]')

  exportingDashboardPdf.value = true

  try {
    await exportChartsPdf({
      filename: buildExportFilename({
        page: 'dashboard',
        ...context,
        extension: 'pdf'
      }),
      reportTitle: 'BPS - Dashboard Neraca Sektoral',
      mode: context.mode,
      period: context.period,
      filters: context.filters,
      chartElements: charts
    })
  } catch (error) {
    console.error('Gagal mengekspor PDF Dashboard:', error)
    alert(error?.message || 'Gagal membuat PDF Dashboard.')
  } finally {
    exportingDashboardPdf.value = false
  }
}
</script>


<template>
  <div
    class="
      mx-auto
      max-w-[1600px]
      space-y-4
    "
  >
    <!-- =====================================================
         PAGE HEADER
    ====================================================== -->
    <section
      class="
        relative
        overflow-hidden
        rounded-2xl
        border border-slate-200/80
        border-t-4 border-t-cyan-600
        bg-gradient-to-br from-white via-white to-cyan-50/60
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
        <!-- =================================================
             TITLE
        ================================================== -->
        <div class="min-w-0">
          <!-- BADGE -->
          <div
            class="
              mb-3
              inline-flex
              items-center
              gap-2
              rounded-full
              border border-cyan-100
              bg-cyan-50
              px-3
              py-1.5
            "
          >
            <span
              class="
                h-1.5
                w-1.5
                rounded-full
                bg-cyan-600
                shadow-[0_0_0_3px_rgba(8,145,178,0.12)]
              "
            ></span>

            <span
              class="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.14em]
                text-cyan-800
              "
            >
              Dashboard Analitik
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
            Neraca & Akun Sektoral
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
            Ringkasan dan komposisi neraca sektoral berdasarkan periode, jenis,
            klasifikasi, dan institusi.
          </p>
        </div>


        <!-- =================================================
             QUICK INFORMATION
        ================================================== -->
        <div
          class="
            flex
            flex-wrap
            items-stretch
            gap-2
            xl:justify-end
          "
        >
          <!-- MODE -->
          <div
            class="
              min-w-[145px]
              rounded-xl
              border border-slate-200
              bg-slate-50/70
              px-3.5
              py-3
            "
          >
            <div
              class="
                flex
                items-center
                gap-2.5
              "
            >
              <div
                class="
                  flex
                  h-8
                  w-8
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-white
                  text-blue-600
                  shadow-sm
                  ring-1
                  ring-slate-200/70
                "
              >
                <span
                  class="
                    text-[11px]
                    font-extrabold
                  "
                >
                  T
                </span>
              </div>

              <div>
                <p
                  class="
                    text-[9px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-slate-400
                  "
                >
                  Mode
                </p>

                <p
                  class="
                    mt-0.5
                    text-xs
                    font-bold
                    text-slate-700
                  "
                >
                  {{ periodeLabel }}
                </p>
              </div>
            </div>
          </div>


          <!-- PERIODE -->
          <div
            class="
              min-w-[145px]
              rounded-xl
              border border-slate-200
              bg-slate-50/70
              px-3.5
              py-3
            "
          >
            <div
              class="
                flex
                items-center
                gap-2.5
              "
            >
              <div
                class="
                  flex
                  h-8
                  w-8
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-white
                  text-emerald-600
                  shadow-sm
                  ring-1
                  ring-slate-200/70
                "
              >
                <span
                  class="
                    text-[10px]
                    font-extrabold
                  "
                >
                  01
                </span>
              </div>

              <div>
                <p
                  class="
                    text-[9px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-slate-400
                  "
                >
                  Periode Data
                </p>

                <p
                  class="
                    mt-0.5
                    max-w-[150px]
                    truncate
                    text-xs
                    font-bold
                    text-slate-700
                  "
                  :title="tahunLabel"
                >
                  {{ tahunLabel }}
                </p>
              </div>
            </div>
          </div>




        </div>
      </div>
    </section>


    <!-- =====================================================
         MAIN DASHBOARD
    ====================================================== -->
    <div
      class="
        grid
        grid-cols-1
        gap-4
        xl:grid-cols-12
      "
    >
      <!-- ===================================================
           FILTER SIDEBAR
      ==================================================== -->
      <aside
        class="
          xl:col-span-3
        "
      >
        <div
          class="
            xl:sticky
            xl:top-24
          "
        >
          <NeracaFilter
            @change="
              handleFilterChange
            "
          />
        </div>
      </aside>


      <!-- ===================================================
           MAIN CONTENT
      ==================================================== -->
      <section
        class="
          min-w-0
          space-y-4
          xl:col-span-9
        "
      >
<!-- =================================================
     DASHBOARD DESCRIPTION
================================================== -->
<div
  class="
    rounded-xl
    border border-slate-200/80
    border-l-4 border-l-cyan-500
    bg-white
    px-5
    py-4
    shadow-[0_4px_16px_rgba(15,23,42,0.04)]
  "
>
  <div class="min-w-0">
    <!-- JUDUL -->
    <h2
      class="
        text-base
        font-bold
        tracking-tight
        text-slate-800
      "
    >
      {{ dashboardTitle }}
    </h2>

    <!-- DESKRIPSI -->
    <p
      class="
        mt-1.5
        max-w-5xl
        text-[13px]
        leading-6
        text-slate-500
      "
    >
      {{ dashboardDescription }}
    </p>
  </div>
</div>

  <NeracaSummary
    :total-nilai="totalNilai"
    :kontributor="kontributorTerbesar"
    :metadata="backendSummary.metadata"
    :metadata-loading="summaryLoading"
  />

  <div class="flex justify-end" data-html2canvas-ignore="true">
    <ExportActions
      :csv-disabled="summaryLoading || institutionData.length === 0"
      :pdf-disabled="summaryLoading || (!hasDonutData && !hasRankingData)"
      :pdf-busy="exportingDashboardPdf"
      @csv="downloadDashboardCsv"
      @pdf="downloadDashboardPdf"
    />
  </div>

        <!-- =================================================
             TOP CONTENT
        ================================================== -->
        <div
          class="
            grid
            grid-cols-1
            gap-4
            lg:grid-cols-12
          "
        >
          <!-- ===============================================
               DONUT CARD
          ================================================ -->
          <div
            class="
              overflow-hidden
              rounded-2xl
              border border-slate-200/80
              bg-white
              shadow-[0_8px_24px_rgba(15,23,42,0.045)]
              transition-shadow duration-200
              hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]
              lg:col-span-12
            "
          >
            <!-- CARD HEADER -->
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
                sm:items-start
                sm:justify-between
              "
            >
              <div>
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
                      bg-cyan-600
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
                    Komposisi Institusi
                  </p>
                </div>


                <h3
                  class="
                    mt-1.5
                    text-[15px]
                    font-bold
                    text-slate-800
                  "
                >
                  Distribusi Nilai Berdasarkan Institusi
                </h3>


                <p
                  v-if="
                    hasDonutData
                  "
                  class="
                    mt-1
                    text-[11px]
                    leading-5
                    text-slate-400
                  "
                >
                  Proporsi nilai positif pada masing-masing institusi.
                </p>
              </div>


              <span
                v-if="
                  hasDonutData
                "
                class="
                  w-fit
                  shrink-0
                  rounded-full
                  border border-blue-100
                  bg-blue-50
                  px-2.5
                  py-1
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-wide
                  text-blue-600
                "
              >
                Komposisi
              </span>
            </div>


            <!-- NEGATIVE INFO -->
            <div
              v-if="
                hasNegativeValue
              "
              class="
                mx-5
                mt-3
                flex
                items-start
                gap-2
                rounded-lg
                border border-amber-100
                bg-amber-50/60
                px-3
                py-2
              "
            >
              <span
                class="
                  mt-1
                  h-1.5
                  w-1.5
                  shrink-0
                  rounded-full
                  bg-amber-500
                "
              ></span>

              <p
                class="
                  text-[10px]
                  leading-4
                  text-amber-700
                "
              >
                Nilai negatif tidak dimasukkan ke komposisi,
                tetapi tetap tersedia pada grafik peringkat.
              </p>
            </div>


            <!-- CHART -->
            <div
              :data-pdf-chart="hasDonutData ? 'dashboard' : null"
              :data-pdf-title="hasDonutData ? 'Komposisi Institusi - Distribusi Nilai' : null"
              class="
                h-[300px]
                px-2
                pb-5
                pt-2
                sm:h-[340px]
                sm:px-5
              "
            >
              <DonutChart
                v-if="
                  hasDonutData
                "
                :labels="
                  donutLabels
                "
                :values="
                  donutValues
                "
              />


              <!-- EMPTY STATE -->
              <div
                v-else
                class="
                  flex
                  h-full
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-dashed
                  border-slate-200
                  bg-slate-50/60
                "
              >
                <div
                  class="
                    max-w-[280px]
                    px-6
                    text-center
                  "
                >
                  <div
                    class="
                      mx-auto
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-xl
                      bg-white
                      text-slate-300
                      shadow-sm
                      ring-1
                      ring-slate-100
                    "
                  >
                    —
                  </div>

                  <p
                    class="
                      mt-3
                      text-xs
                      font-bold
                      text-slate-600
                    "
                  >
                    Data tidak tersedia
                  </p>

                  <p
                    class="
                      mt-1
                      text-[10px]
                      leading-4
                      text-slate-400
                    "
                  >
                    Tidak ada nilai positif untuk kombinasi filter yang dipilih.
                  </p>
                </div>
              </div>
            </div>
          </div>


        </div>


        <!-- =================================================
             RANKING
        ================================================== -->
        <div
          class="
            overflow-hidden
            rounded-2xl
            border border-slate-200/80
            bg-white
            shadow-[0_8px_24px_rgba(15,23,42,0.045)]
          "
        >
          <!-- HEADER -->
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
              sm:items-start
              sm:justify-between
            "
          >
            <!-- TITLE -->
            <div class="min-w-0">
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
                    bg-emerald-500
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
                  Peringkat Institusi
                </p>
              </div>


              <h3
                class="
                  mt-1.5
                  text-[15px]
                  font-bold
                  text-slate-800
                "
              >
                Nilai Berdasarkan Institusi
              </h3>


              <p
                v-if="
                  hasRankingData
                "
                class="
                  mt-1
                  text-[11px]
                  leading-5
                  text-slate-400
                "
              >
                Membandingkan

                <span
                  class="
                    font-semibold
                    text-slate-500
                  "
                >
                  {{
                    rankingLabels.length
                  }}
                </span>

                institusi berdasarkan nilai.
              </p>
            </div>


            <!-- LEGEND -->
            <div
              class="
                flex
                shrink-0
                flex-wrap
                items-center
                gap-2
              "
            >
              <span
                class="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-lg
                  border border-slate-200
                  bg-slate-50
                  px-2.5
                  py-1.5
                  text-[10px]
                  font-semibold
                  text-slate-500
                "
              >
                <span
                  class="
                    h-1.5
                    w-1.5
                    rounded-full
                    bg-blue-500
                  "
                ></span>

                Nilai Institusi
              </span>


              <span
                v-if="
                  hasNegativeValue
                "
                class="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-lg
                  border border-amber-100
                  bg-amber-50
                  px-2.5
                  py-1.5
                  text-[10px]
                  font-semibold
                  text-amber-700
                "
              >
                <span
                  class="
                    h-1.5
                    w-1.5
                    rounded-full
                    bg-amber-500
                  "
                ></span>

                Ada nilai negatif
              </span>
            </div>
          </div>


          <!-- NEGATIVE INFO -->
          <div
            v-if="
              hasRankingData &&
              hasNegativeValue
            "
            class="
              mx-5
              mt-3
              flex
              items-start
              gap-2
              rounded-lg
              border border-amber-100
              bg-amber-50/60
              px-3
              py-2
            "
          >
            <span
              class="
                mt-1
                h-1.5
                w-1.5
                shrink-0
                rounded-full
                bg-amber-500
              "
            ></span>

            <p
              class="
                text-[10px]
                leading-4
                text-amber-700
              "
            >
              Nilai negatif ditampilkan ke arah kiri agar mudah
              dibedakan dari nilai positif.
            </p>
          </div>


          <!-- CHART -->
          <div
            :data-pdf-chart="hasRankingData ? 'dashboard' : null"
            :data-pdf-title="hasRankingData ? 'Peringkat Institusi - Nilai Berdasarkan Institusi' : null"
            class="
              relative
              w-full
              px-3
              pb-5
              pt-3
              transition-[height]
              duration-300
              ease-out
            "
            :style="{
              height:
                `${rankingChartHeight + 32}px`
            }"
          >
            <RankingChart
              v-if="
                hasRankingData
              "
              :labels="
                rankingLabels
              "
              :values="
                rankingValues
              "
            />


            <!-- EMPTY STATE -->
            <div
              v-else
              class="
                flex
                h-full
                min-h-[240px]
                items-center
                justify-center
                rounded-xl
                border
                border-dashed
                border-slate-200
                bg-slate-50/60
              "
            >
              <div
                class="
                  max-w-[280px]
                  px-6
                  text-center
                "
              >
                <div
                  class="
                    mx-auto
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    bg-white
                    text-slate-300
                    shadow-sm
                    ring-1
                    ring-slate-100
                  "
                >
                  —
                </div>

                <p
                  class="
                    mt-3
                    text-xs
                    font-bold
                    text-slate-600
                  "
                >
                  Data tidak tersedia
                </p>

                <p
                  class="
                    mt-1
                    text-[10px]
                    leading-4
                    text-slate-400
                  "
                >
                  Tidak terdapat nilai institusi untuk kombinasi filter yang dipilih.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>