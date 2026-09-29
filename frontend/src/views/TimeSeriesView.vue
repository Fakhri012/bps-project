<script setup>
import {
  ref,
  computed,
  nextTick
} from 'vue'

import {
  Activity,
  CalendarRange,
  TrendingUp,
  Download,
  FileText
} from 'lucide-vue-next'

import html2canvas
  from 'html2canvas-pro'

import jsPDF
  from 'jspdf'

import {
  getTahunanTimeSeries,
  getTriwulananTimeSeries
} from '../services/dashboardApi'

import TimeSeriesFilter
  from '../components/timeseries/TimeSeriesFilter.vue'

import TimeSeriesActiveFilters
  from '../components/timeseries/TimeSeriesActiveFilters.vue'

import TimeSeriesKpi
  from '../components/timeseries/TimeSeriesKpi.vue'

import AnnualTimeSeriesChart
  from '../components/timeseries/AnnualTimeSeriesChart.vue'

import QuarterlyTimeSeriesChart
  from '../components/timeseries/QuarterlyTimeSeriesChart.vue'


/*
|--------------------------------------------------------------------------
| STATE
|--------------------------------------------------------------------------
*/

const loading =
  ref(false)

const error =
  ref('')

const exportingPdf =
  ref(false)

const tahunanData =
  ref([])

const triwulananData =
  ref([])


/*
|--------------------------------------------------------------------------
| MODE GRAFIK
|--------------------------------------------------------------------------
|
| both
| annual
| quarterly
|
*/

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
      Array.isArray(
        tahunanResponse?.data
      )
        ? tahunanResponse.data
        : []


    triwulananData.value =
      Array.isArray(
        triwulananResponse?.data
      )
        ? triwulananResponse.data
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
  filters = {}
) {
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


  loadTimeSeries(
    activeFilters.value
  )
}


/*
|--------------------------------------------------------------------------
| FORMAT TANGGAL FILE
|--------------------------------------------------------------------------
*/

function getExportDate() {
  const now =
    new Date()


  const year =
    now.getFullYear()


  const month =
    String(
      now.getMonth() +
      1
    ).padStart(
      2,
      '0'
    )


  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      '0'
    )


  return `${year}-${month}-${day}`
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


/*
|--------------------------------------------------------------------------
| CSV HELPER
|--------------------------------------------------------------------------
*/

function escapeCsvValue(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return ''
  }


  const text =
    String(
      value
    )


  /*
   * CSV menggunakan ;
   * agar lebih nyaman dibuka Excel
   * dengan regional Indonesia.
   */

  if (
    text.includes(';') ||
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r')
  ) {
    return `"${text.replace(
      /"/g,
      '""'
    )}"`
  }


  return text
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

    const csv =
      rows
        .map(
          row =>
            row
              .map(
                escapeCsvValue
              )
              .join(';')
        )
        .join(
          '\r\n'
        )


    /*
    |--------------------------------------------------------------------------
    | CREATE FILE
    |--------------------------------------------------------------------------
    */

    const blob =
      new Blob(
        [
          '\uFEFF',
          csv
        ],
        {
          type:
            'text/csv;charset=utf-8;'
        }
      )


    const url =
      URL.createObjectURL(
        blob
      )


    const link =
      document.createElement(
        'a'
      )


    link.href =
      url


    link.download =
      `time-series-${getExportModeName()}-${getExportDate()}.csv`


    link.style.display =
      'none'


    document.body.appendChild(
      link
    )


    link.click()


    /*
     * Jangan langsung revoke,
     * beri browser waktu untuk
     * memulai download.
     */

    setTimeout(
      () => {
        if (
          link.parentNode
        ) {
          link.parentNode.removeChild(
            link
          )
        }


        URL.revokeObjectURL(
          url
        )
      },
      500
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


  /*
  |--------------------------------------------------------------------------
  | CEK DATA
  |--------------------------------------------------------------------------
  */

  if (
    tahunanData.value.length ===
      0 &&
    triwulananData.value.length ===
      0
  ) {
    alert(
      'Tidak ada data yang dapat diexport.'
    )

    return
  }


  /*
  |--------------------------------------------------------------------------
  | CARI AREA REPORT
  |--------------------------------------------------------------------------
  */

  const element =
    document.getElementById(
      'time-series-report'
    )


  if (
    !element
  ) {
    console.error(
      'Element #time-series-report tidak ditemukan.'
    )


    alert(
      'Area Time Series untuk PDF tidak ditemukan.'
    )

    return
  }


  try {
    exportingPdf.value =
      true


    /*
    |--------------------------------------------------------------------------
    | PASTIKAN CHART SUDAH SESUAI UKURAN TERBARU
    |--------------------------------------------------------------------------
    */

/*
|--------------------------------------------------------------------------
| TUNGGU CHART BENAR-BENAR SELESAI
|--------------------------------------------------------------------------
|
| Jangan remount ECharts saat export.
| Kalau chart di-remount, animasi dimulai lagi
| dan html2canvas bisa menangkap garis setengah jadi.
|
*/

await nextTick()

await new Promise(
  resolve => {
    setTimeout(
      resolve,
      900
    )
  }
)


    /*
    |--------------------------------------------------------------------------
    | CAPTURE HTML
    |--------------------------------------------------------------------------
    */

    const canvas =
      await html2canvas(
        element,
        {
          /*
           * 2 cukup tajam tetapi
           * tidak terlalu berat.
           */
          scale: 2,

          useCORS: true,

          allowTaint: false,

          backgroundColor:
            '#ffffff',

          logging: false,

          /*
           * Pastikan capture mulai
           * dari posisi halaman yang benar.
           */
          scrollX:
            -window.scrollX,

          scrollY:
            -window.scrollY,

          /*
           * Capture ukuran element penuh.
           */
          width:
            element.scrollWidth,

          height:
            element.scrollHeight,

          windowWidth:
            Math.max(
              document.documentElement
                .clientWidth,

              element.scrollWidth
            ),

          windowHeight:
            Math.max(
              document.documentElement
                .clientHeight,

              element.scrollHeight
            )
        }
      )


    /*
    |--------------------------------------------------------------------------
    | VALIDASI CANVAS
    |--------------------------------------------------------------------------
    */

    if (
      !canvas ||
      canvas.width === 0 ||
      canvas.height === 0
    ) {
      throw new Error(
        'Canvas hasil export kosong.'
      )
    }


    /*
    |--------------------------------------------------------------------------
    | IMAGE DATA
    |--------------------------------------------------------------------------
    */

    const imageData =
      canvas.toDataURL(
        'image/jpeg',
        0.95
      )


    /*
    |--------------------------------------------------------------------------
    | CREATE PDF
    |--------------------------------------------------------------------------
    */

    const pdf =
      new jsPDF(
        {
          orientation:
            'landscape',

          unit:
            'mm',

          format:
            'a4',

          compress:
            true
        }
      )


    /*
    |--------------------------------------------------------------------------
    | PAGE SIZE
    |--------------------------------------------------------------------------
    */

    const pageWidth =
      pdf.internal
        .pageSize
        .getWidth()


    const pageHeight =
      pdf.internal
        .pageSize
        .getHeight()


    const margin =
      8


    const contentWidth =
      pageWidth -
      margin * 2


    const contentHeight =
      pageHeight -
      margin * 2


    /*
    |--------------------------------------------------------------------------
    | IMAGE SIZE
    |--------------------------------------------------------------------------
    */

    const imageWidth =
      contentWidth


    const imageHeight =
      (
        canvas.height *
        imageWidth
      ) /
      canvas.width


    /*
    |--------------------------------------------------------------------------
    | ADD MULTI PAGE
    |--------------------------------------------------------------------------
    */

    let heightLeft =
      imageHeight


    let position =
      margin


    /*
     * Halaman pertama.
     */

    pdf.addImage(
      imageData,
      'JPEG',
      margin,
      position,
      imageWidth,
      imageHeight,
      undefined,
      'FAST'
    )


    heightLeft -=
      contentHeight


    /*
     * Halaman berikutnya.
     */

    while (
      heightLeft > 0
    ) {
      pdf.addPage(
        'a4',
        'landscape'
      )


      position =
        margin -
        (
          imageHeight -
          heightLeft
        )


      pdf.addImage(
        imageData,
        'JPEG',
        margin,
        position,
        imageWidth,
        imageHeight,
        undefined,
        'FAST'
      )


      heightLeft -=
        contentHeight
    }


    /*
    |--------------------------------------------------------------------------
    | SAVE
    |--------------------------------------------------------------------------
    */

    pdf.save(
      `time-series-${getExportModeName()}-${getExportDate()}.pdf`
    )


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
      space-y-4
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
        bg-white
        px-5
        py-5
        shadow-[0_1px_3px_rgba(15,23,42,0.04)]
        lg:px-6
      "
    >
      <!-- DECORATION -->

      <div
        class="
          pointer-events-none
          absolute
          -right-20
          -top-24
          h-56
          w-56
          rounded-full
          bg-violet-100/60
          blur-3xl
        "
      ></div>


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
              border border-violet-100
              bg-violet-50/80
              px-3
              py-1.5
            "
          >
            <TrendingUp
              :size="13"
              class="text-violet-700"
            />

            <span
              class="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.14em]
                text-violet-700
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
              bg-white/80
              px-3
              py-2.5
              shadow-sm
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
                bg-blue-50
                text-blue-600
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
              bg-white/80
              px-3
              py-2.5
              shadow-sm
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
                bg-violet-50
                text-violet-600
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
        shadow-[0_1px_3px_rgba(15,23,42,0.03)]
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
        <!-- =========================
             EXPORT CSV
        ========================== -->

        <button
          type="button"
          class="
            inline-flex
            items-center
            gap-1.5
            rounded-lg
            border
            border-slate-200
            bg-white
            px-3
            py-2
            text-[10px]
            font-semibold
            text-slate-600
            shadow-sm
            transition
            hover:border-blue-200
            hover:bg-blue-50
            hover:text-blue-600
            disabled:cursor-not-allowed
            disabled:opacity-40
          "
          :disabled="
            loading ||
            (
              tahunanData.length === 0 &&
              triwulananData.length === 0
            )
          "
          @click="
            downloadTimeSeriesCsv
          "
        >
          <Download
            :size="13"
            :stroke-width="1.8"
          />

          Export CSV
        </button>


        <!-- =========================
             EXPORT PDF
        ========================== -->

        <button
          type="button"
          class="
            inline-flex
            items-center
            gap-1.5
            rounded-lg
            border
            border-slate-200
            bg-white
            px-3
            py-2
            text-[10px]
            font-semibold
            text-slate-600
            shadow-sm
            transition
            hover:border-red-200
            hover:bg-red-50
            hover:text-red-600
            disabled:cursor-not-allowed
            disabled:opacity-40
          "
          :disabled="
            loading ||
            exportingPdf ||
            (
              tahunanData.length === 0 &&
              triwulananData.length === 0
            )
          "
          @click="
            downloadTimeSeriesPdf
          "
        >
          <FileText
            :size="13"
            :stroke-width="1.8"
          />

          {{
            exportingPdf
              ? 'Membuat PDF...'
              : 'Export PDF'
          }}
        </button>


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
          bg-white
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
          shadow-[0_1px_3px_rgba(15,23,42,0.04)]
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
                bg-blue-500
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
                bg-blue-50
                px-2.5
                py-1
                text-[9px]
                font-semibold
                text-blue-600
              "
            >
              {{ tahunanData.length }}
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
            :key="
              `annual-${chartRenderKey}`
            "
            :data="tahunanData"
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
          shadow-[0_1px_3px_rgba(15,23,42,0.04)]
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
                bg-violet-500
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
                bg-violet-50
                px-2.5
                py-1
                text-[9px]
                font-semibold
                text-violet-600
              "
            >
              {{ triwulananData.length }}
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
            :key="
              `quarterly-${chartRenderKey}`
            "
            :data="triwulananData"
          />
        </div>
      </section>
    </div>
  </div>
</template>