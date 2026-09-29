<script setup>
import {
  ref,
  computed,
  watch,
  onMounted
} from 'vue'

import {
  RotateCcw,
  LoaderCircle,
  SlidersHorizontal
} from 'lucide-vue-next'

import MultiSelectFilter
  from '../dashboard/MultiSelectFilter.vue'

import {
  getTahunanAssetFilters,
  getTriwulananAssetFilters
} from '../../services/dashboardApi'


/*
|--------------------------------------------------------------------------
| EMIT
|--------------------------------------------------------------------------
*/

const emit =
  defineEmits([
    'change'
  ])


/*
|--------------------------------------------------------------------------
| FILTER TERPILIH
|--------------------------------------------------------------------------
*/

const tahun =
  ref([])

const triwulan =
  ref([])

const jenis =
  ref([])

const neraca =
  ref([])

const klasifikasi =
  ref([])

const institusi =
  ref([])


/*
|--------------------------------------------------------------------------
| OPTIONS
|--------------------------------------------------------------------------
*/

const tahunOptions =
  ref([])

const triwulanOptions =
  ref([])

const jenisOptions =
  ref([])

const neracaOptions =
  ref([])

const klasifikasiOptions =
  ref([])

const institusiOptions =
  ref([])


/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

const loading =
  ref(false)

const error =
  ref('')

let requestId = 0


/*
|--------------------------------------------------------------------------
| ACTIVE COUNT
|--------------------------------------------------------------------------
*/

const activeCount =
  computed(() => {
    return (
      tahun.value.length +
      triwulan.value.length +
      jenis.value.length +
      neraca.value.length +
      klasifikasi.value.length +
      institusi.value.length
    )
  })


/*
|--------------------------------------------------------------------------
| CURRENT FILTER
|--------------------------------------------------------------------------
|
| Backend Time Series menggunakan:
|
| tahun
| triwulan
| sisi
| neraca
| klasifikasi
| institusi
|
*/

function getCurrentFilters() {
  return {
    tahun:
      [...tahun.value],

    triwulan:
      [...triwulan.value],

    sisi:
      [...jenis.value],

    neraca:
      [...neraca.value],

    klasifikasi:
      [...klasifikasi.value],

    institusi:
      [...institusi.value]
  }
}


/*
|--------------------------------------------------------------------------
| PARAM FILTER OPTIONS
|--------------------------------------------------------------------------
*/

function buildFilterParams() {
  return {
    tahun:
      [...tahun.value],

    triwulan:
      [...triwulan.value],

    sisi:
      [...jenis.value],

    neraca:
      [...neraca.value],

    klasifikasi:
      [...klasifikasi.value],

    institusi:
      [...institusi.value]
  }
}


/*
|--------------------------------------------------------------------------
| NORMALIZE TEXT
|--------------------------------------------------------------------------
*/

function normalizeTextOptions(
  options = []
) {
  const map =
    new Map()

  options.forEach(
    item => {
      let value = ''
      let label = ''

      if (
        typeof item === 'object' &&
        item !== null
      ) {
        value =
          String(
            item.value ?? ''
          ).trim()

        label =
          String(
            item.label ??
            item.value ??
            ''
          ).trim()
      } else {
        value =
          String(
            item ?? ''
          ).trim()

        label =
          value
      }

      if (!value) {
        return
      }

      const key =
        value.toLowerCase()

      if (
        !map.has(key)
      ) {
        map.set(
          key,
          {
            value,
            label
          }
        )
      }
    }
  )

  return Array.from(
    map.values()
  ).sort(
    (a, b) =>
      a.label.localeCompare(
        b.label,
        'id',
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  )
}


/*
|--------------------------------------------------------------------------
| NORMALIZE TAHUN
|--------------------------------------------------------------------------
*/

function normalizeTahunOptions(
  options = []
) {
  const values =
    options
      .map(item => {
        if (
          typeof item === 'object' &&
          item !== null
        ) {
          return Number(
            item.value ??
            item.label
          )
        }

        return Number(item)
      })
      .filter(
        Number.isFinite
      )

  return [
    ...new Set(values)
  ]
    .sort(
      (a, b) =>
        a - b
    )
    .map(
      item => ({
        value:
          String(item),

        label:
          String(item)
      })
    )
}


/*
|--------------------------------------------------------------------------
| NORMALIZE TRIWULAN
|--------------------------------------------------------------------------
*/

function normalizeTriwulanOptions(
  options = []
) {
  const values =
    options
      .map(item => {
        const raw =
          typeof item === 'object' &&
          item !== null

            ? item.value ??
              item.label

            : item

        const number =
          Number(
            String(raw ?? '')
              .replace(
                /^Q/i,
                ''
              )
          )

        return number
      })
      .filter(
        item =>
          Number.isInteger(item) &&
          item >= 1 &&
          item <= 4
      )

  return [
    ...new Set(values)
  ]
    .sort(
      (a, b) =>
        a - b
    )
    .map(
      item => ({
        value:
          String(item),

        label:
          `Q${item}`
      })
    )
}


/*
|--------------------------------------------------------------------------
| MERGE OPTIONS
|--------------------------------------------------------------------------
*/

function mergeOptions(
  first = [],
  second = []
) {
  return normalizeTextOptions([
    ...first,
    ...second
  ])
}


/*
|--------------------------------------------------------------------------
| MERGE TAHUN
|--------------------------------------------------------------------------
*/

function mergeTahunOptions(
  first = [],
  second = []
) {
  return normalizeTahunOptions([
    ...first,
    ...second
  ])
}


/*
|--------------------------------------------------------------------------
| LOAD FILTER OPTIONS
|--------------------------------------------------------------------------
|
| Kita ambil pilihan dari:
|
| - Dataset Tahunan
| - Dataset Triwulanan
|
| lalu digabung agar Time Series dapat
| mengontrol kedua grafik.
|
*/

async function loadFilterOptions() {
  const currentRequest =
    ++requestId

  loading.value = true
  error.value = ''

  try {
    const params =
      buildFilterParams()


    /*
     * Tahunan tidak membutuhkan
     * filter triwulan.
     */

    const tahunanParams = {
      tahun:
        params.tahun,

      sisi:
        params.sisi,

      neraca:
        params.neraca,

      klasifikasi:
        params.klasifikasi,

      institusi:
        params.institusi
    }


    const triwulananParams = {
      ...params
    }


    const [
      tahunanResponse,
      triwulananResponse
    ] = await Promise.all([
      getTahunanAssetFilters(
        tahunanParams
      ),

      getTriwulananAssetFilters(
        triwulananParams
      )
    ])


    /*
     * Kalau ada request baru,
     * abaikan response lama.
     */

    if (
      currentRequest !==
      requestId
    ) {
      return
    }


    const tahunanFilters =
      tahunanResponse?.filters ||
      {}

    const triwulananFilters =
      triwulananResponse?.filters ||
      {}


    /*
    |--------------------------------------------------------------------------
    | TAHUN
    |--------------------------------------------------------------------------
    */

    tahunOptions.value =
      mergeTahunOptions(
        tahunanFilters.tahun ||
        [],

        triwulananFilters.tahun ||
        []
      )


    /*
    |--------------------------------------------------------------------------
    | TRIWULAN
    |--------------------------------------------------------------------------
    |
    | Triwulan hanya berasal dari
    | dataset Triwulanan.
    |
    */

    triwulanOptions.value =
      normalizeTriwulanOptions(
        triwulananFilters.triwulan ||
        []
      )


    /*
    |--------------------------------------------------------------------------
    | JENIS / SISI
    |--------------------------------------------------------------------------
    */

    jenisOptions.value =
      mergeOptions(
        tahunanFilters.sisi ||
        [],

        triwulananFilters.sisi ||
        []
      )


    /*
    |--------------------------------------------------------------------------
    | NERACA
    |--------------------------------------------------------------------------
    */

    neracaOptions.value =
      mergeOptions(
        tahunanFilters.neraca ||
        [],

        triwulananFilters.neraca ||
        []
      )


    /*
    |--------------------------------------------------------------------------
    | KLASIFIKASI
    |--------------------------------------------------------------------------
    */

    klasifikasiOptions.value =
      mergeOptions(
        tahunanFilters.klasifikasi ||
        [],

        triwulananFilters.klasifikasi ||
        []
      )


    /*
    |--------------------------------------------------------------------------
    | INSTITUSI
    |--------------------------------------------------------------------------
    */

    institusiOptions.value =
      mergeOptions(
        tahunanFilters.institusi ||
        [],

        triwulananFilters.institusi ||
        []
      )

  } catch (err) {
    console.error(
      'Time Series Filter Error:',
      err
    )

    if (
      currentRequest ===
      requestId
    ) {
      error.value =
        err?.response
          ?.data
          ?.message ||
        err?.message ||
        'Gagal mengambil pilihan filter.'
    }

  } finally {
    if (
      currentRequest ===
      requestId
    ) {
      loading.value = false
    }
  }
}


/*
|--------------------------------------------------------------------------
| RESET
|--------------------------------------------------------------------------
*/

function resetFilters() {
  tahun.value = []
  triwulan.value = []
  jenis.value = []
  neraca.value = []
  klasifikasi.value = []
  institusi.value = []
}


/*
|--------------------------------------------------------------------------
| WATCH
|--------------------------------------------------------------------------
*/

watch(
  [
    tahun,
    triwulan,
    jenis,
    neraca,
    klasifikasi,
    institusi
  ],

  async () => {
    /*
     * Kirim filter ke TimeSeriesView.
     */

    emit(
      'change',
      getCurrentFilters()
    )


    /*
     * Refresh cascading filter.
     */

    await loadFilterOptions()
  },

  {
    deep: true,
    flush: 'post'
  }
)


/*
|--------------------------------------------------------------------------
| INIT
|--------------------------------------------------------------------------
*/

onMounted(
  async () => {
    await loadFilterOptions()

    emit(
      'change',
      getCurrentFilters()
    )
  }
)
</script>


<template>
  <section
    class="
      overflow-visible
      rounded-xl
      border
      border-slate-200/80
      bg-white
      shadow-[0_1px_3px_rgba(15,23,42,0.03)]
    "
  >
    <!-- =====================================================
         HEADER
    ====================================================== -->

    <div
      class="
        flex
        flex-col
        gap-3
        border-b
        border-slate-100
        px-4
        py-3
        sm:flex-row
        sm:items-center
        sm:justify-between
      "
    >
      <!-- LEFT -->
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
            bg-violet-50
            text-violet-600
          "
        >
          <SlidersHorizontal
            :size="15"
            :stroke-width="1.8"
          />
        </div>


        <div>
          <div
            class="
              flex
              items-center
              gap-2
            "
          >
            <h2
              class="
                text-sm
                font-bold
                text-slate-800
              "
            >
              Filter Time Series
            </h2>


            <span
              v-if="
                activeCount > 0
              "
              class="
                rounded-full
                bg-violet-50
                px-2
                py-0.5
                text-[9px]
                font-bold
                text-violet-600
              "
            >
              {{ activeCount }} aktif
            </span>


            <LoaderCircle
              v-if="loading"
              :size="13"
              class="
                animate-spin
                text-slate-400
              "
            />
          </div>


          <p
            class="
              mt-0.5
              text-[10px]
              text-slate-400
            "
          >
            Filter berlaku pada grafik Tahunan dan Triwulanan.
          </p>
        </div>
      </div>


      <!-- RESET -->
      <button
        type="button"
        class="
          inline-flex
          h-8
          w-fit
          items-center
          justify-center
          gap-1.5
          rounded-lg
          border
          border-slate-200
          bg-white
          px-3
          text-[10px]
          font-semibold
          text-slate-500
          transition
          hover:border-red-200
          hover:bg-red-50
          hover:text-red-600
          disabled:cursor-not-allowed
          disabled:opacity-40
        "
        :disabled="
          activeCount === 0
        "
        @click="
          resetFilters
        "
      >
        <RotateCcw
          :size="12"
        />

        Reset
      </button>
    </div>


    <!-- =====================================================
         ERROR
    ====================================================== -->

    <div
      v-if="error"
      class="
        mx-4
        mt-3
        rounded-lg
        border
        border-red-100
        bg-red-50
        px-3
        py-2
        text-[10px]
        text-red-600
      "
    >
      {{ error }}
    </div>


    <!-- =====================================================
         FILTER GRID
    ====================================================== -->

    <div
      class="
        grid
        grid-cols-1
        gap-3
        px-4
        pb-4
        pt-3
        sm:grid-cols-2
        lg:grid-cols-3
      "
    >
      <!-- TAHUN -->
      <MultiSelectFilter
        v-model="tahun"
        label="Tahun"
        placeholder="Semua tahun"
        :options="
          tahunOptions
        "
      />


      <!-- TRIWULAN -->
      <MultiSelectFilter
        v-model="triwulan"
        label="Triwulan"
        placeholder="Semua triwulan"
        :options="
          triwulanOptions
        "
      />


      <!-- JENIS -->
      <MultiSelectFilter
        v-model="jenis"
        label="Jenis"
        placeholder="Semua jenis"
        :options="
          jenisOptions
        "
      />


      <!-- INSTITUSI -->
      <MultiSelectFilter
        v-model="institusi"
        label="Institusi"
        placeholder="Semua institusi"
        :options="
          institusiOptions
        "
      />


      <!-- NERACA -->
      <MultiSelectFilter
        v-model="neraca"
        label="Neraca"
        placeholder="Semua neraca"
        :options="
          neracaOptions
        "
      />


      <!-- KLASIFIKASI -->
      <MultiSelectFilter
        v-model="klasifikasi"
        label="Klasifikasi"
        placeholder="Semua klasifikasi"
        :options="
          klasifikasiOptions
        "
      />
    </div>
  </section>
</template>