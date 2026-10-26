<script setup>
import {
  ref,
  toRef,
  watch,
  onMounted
} from 'vue'

import {
  RotateCcw,
  Check,
  LoaderCircle
} from 'lucide-vue-next'

import MultiSelectFilter
  from './MultiSelectFilter.vue'

import {
  getTahunanFilters,
  getTriwulananFilters
} from '../../services/dashboardApi'

import {
  normalizeDisplayText,
  formatNeracaOptionLabel
} from '../../utils/dashboardText.js'

import {
  usePersistentFilterState
} from '../../composables/filterState.js'


/*
|--------------------------------------------------------------------------
| EMIT
|--------------------------------------------------------------------------
*/

const emit = defineEmits([
  'change'
])


/*
|--------------------------------------------------------------------------
| PERIODE
|--------------------------------------------------------------------------
*/

const { state: savedFilters } =
  usePersistentFilterState('dashboard', {
    periode: 'tahunan',
    jenis: [],
    tahun: [],
    triwulan: [],
    neraca: [],
    klasifikasi: []
  }, {
    periode: 'periode',
    jenis: 'jenis',
    tahun: 'tahun',
    triwulan: 'triwulan',
    neraca: 'neraca',
    klasifikasi: 'klasifikasi'
  })

const periode = toRef(savedFilters, 'periode')
const jenis = toRef(savedFilters, 'jenis')
const tahun = toRef(savedFilters, 'tahun')
const triwulan = toRef(savedFilters, 'triwulan')
const neraca = toRef(savedFilters, 'neraca')
const klasifikasi = toRef(savedFilters, 'klasifikasi')

/*
|--------------------------------------------------------------------------
| OPTIONS DARI BACKEND
|--------------------------------------------------------------------------
*/

const jenisOptions = ref([])
const tahunOptions = ref([])
const triwulanOptions = ref([])
const neracaOptions = ref([])
const klasifikasiOptions = ref([])


/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

const loading = ref(false)
const error = ref(null)

let requestId = 0


/*
|--------------------------------------------------------------------------
| NORMALISASI TEXT OPTIONS
|--------------------------------------------------------------------------
|
| Contoh data asli:
|
| Neraca PenGG 2unaan Pendapatan Disposabel
|
| Menjadi:
|
| value:
| Neraca PenGG 2unaan Pendapatan Disposabel
|
| label:
| Neraca Penggunaan Pendapatan Disposabel
|
*/

function normalizeTextOptions(
  options = []
) {
  return options.map(item => {
    /*
     * Jika backend mengirim object.
     */
    if (
      typeof item === 'object' &&
      item !== null
    ) {
      const value =
        item.value ??
        item.kode ??
        item.nama ??
        ''

      const label =
        item.label ??
        item.nama ??
        value

      return {
        ...item,

        /*
         * Raw value.
         * Jangan dinormalisasi.
         */
        value,

        /*
         * Hanya label UI
         * yang diperbaiki.
         */
        label:
          normalizeDisplayText(
            label
          )
      }
    }


    /*
     * Jika backend mengirim string.
     */
    return {
      value: item,

      label:
        normalizeDisplayText(
          item
        )
    }
  })
}

function keepValidSelections(selection, options) {
  const available = new Set(
    options.map(option =>
      String(
        typeof option === 'object' && option !== null
          ? option.value ?? option.kode ?? ''
          : option
      )
    )
  )
  const valid = selection.value.filter(value =>
    available.has(String(value))
  )

  if (valid.length !== selection.value.length) {
    selection.value = valid
  }
}


/*
|--------------------------------------------------------------------------
| FILTER CHANGE GUARD
|--------------------------------------------------------------------------
|
| Mencegah request dan emit berulang
| ketika filter sebenarnya tidak berubah.
|
*/

let lastFilterKey = ''
let initializing = true


function createFilterKey() {
  return JSON.stringify({
    periode:
      periode.value,

    jenis:
      [...jenis.value],

    tahun:
      [...tahun.value],

    triwulan:
      [...triwulan.value],

    neraca:
      [...neraca.value],

    klasifikasi:
      [...klasifikasi.value]
  })
}


function getCurrentFilters() {
  return {
    periode:
      periode.value,

    jenis:
      [...jenis.value],

    tahun:
      [...tahun.value],

    triwulan:
      [...triwulan.value],

    neraca:
      [...neraca.value],

    klasifikasi:
      [...klasifikasi.value]
  }
}


/*
|--------------------------------------------------------------------------
| NORMALISASI JENIS / SISI
|--------------------------------------------------------------------------
|
| UI hanya menampilkan:
|
| PENGGUNAAN
| SUMBER
|
*/

function normalizeJenisOptions(
  options = []
) {
  return [
    ...new Set(
      options
        .map(item => {
          const value =
            String(item ?? '')
              .trim()
              .toUpperCase()

          /*
           * Semua variasi penggunaan
           * menjadi PENGGUNAAN di UI.
           */
          if (
            value === 'PENGGUNAAN' ||
            value === 'PENGGUNAAN 2' ||
            value === 'PENGG 2UNAAN'
          ) {
            return 'PENGGUNAAN'
          }

          /*
           * Semua variasi sumber.
           */
          if (
            value === 'SUMBER' ||
            value === 'SUMBER 2'
          ) {
            return 'SUMBER'
          }

          return value
        })
        .filter(Boolean)
    )
  ]
}


/*
|--------------------------------------------------------------------------
| NORMALISASI TRIWULAN
|--------------------------------------------------------------------------
*/

function normalizeTriwulanOptions(
  options = []
) {
  return options.map(item => {
    if (
      typeof item === 'object' &&
      item !== null
    ) {
      return item.label
    }

    return String(item)
  })
}


/*
|--------------------------------------------------------------------------
| MEMBUAT FILTER UNTUK API
|--------------------------------------------------------------------------
*/

function buildSelectedFilters() {
  const filters = {
    tahun:
      tahun.value,

    sisi:
      jenis.value,

    neraca:
      neraca.value,

    klasifikasi:
      klasifikasi.value
  }


  /*
   * Triwulan hanya dikirim
   * pada mode Triwulanan.
   *
   * Q1 -> 1
   * Q2 -> 2
   */
  if (
    periode.value ===
    'triwulanan'
  ) {
    filters.triwulan =
      triwulan.value.map(
        item =>
          String(item)
            .replace(
              /^Q/i,
              ''
            )
      )
  }

  return filters
}


/*
|--------------------------------------------------------------------------
| LOAD FILTER OPTIONS
|--------------------------------------------------------------------------
*/

async function loadFilterOptions() {
  const currentRequest =
    ++requestId

  try {
    loading.value = true
    error.value = null


    const selectedFilters =
      buildSelectedFilters()


    let response


    /*
    |--------------------------------------------------------------------------
    | PILIH ENDPOINT
    |--------------------------------------------------------------------------
    */

    if (
      periode.value ===
      'triwulanan'
    ) {
      response =
        await getTriwulananFilters(
          selectedFilters
        )

    } else {
      response =
        await getTahunanFilters(
          selectedFilters
        )
    }


    /*
     * Abaikan response lama
     * jika request baru sudah dibuat.
     */
    if (
      currentRequest !==
      requestId
    ) {
      return
    }


    const filters =
      response.filters || {}


    /*
    |--------------------------------------------------------------------------
    | TAHUN
    |--------------------------------------------------------------------------
    */

    tahunOptions.value =
      (filters.tahun || [])
        .map(String)
        .sort((first, second) => Number(second) - Number(first))


    /*
    |--------------------------------------------------------------------------
    | JENIS / SISI
    |--------------------------------------------------------------------------
    */

    jenisOptions.value =
      normalizeJenisOptions(
        filters.sisi || []
      )


    /*
    |--------------------------------------------------------------------------
    | TRIWULAN
    |--------------------------------------------------------------------------
    */

    if (
      periode.value ===
      'triwulanan'
    ) {
      triwulanOptions.value =
        normalizeTriwulanOptions(
          filters.triwulan || []
        )

    } else {
      triwulanOptions.value = []
    }


    /*
    |--------------------------------------------------------------------------
    | NERACA
    |--------------------------------------------------------------------------
    |
    | Value asli tetap digunakan.
    | Hanya label yang diperbaiki.
    |
    */

    neracaOptions.value =
      normalizeTextOptions(
        filters.neraca || []
      ).map(option => ({
        ...option,
        label: formatNeracaOptionLabel(option.value)
      }))


    /*
    |--------------------------------------------------------------------------
    | KLASIFIKASI
    |--------------------------------------------------------------------------
    */

    klasifikasiOptions.value =
      filters.klasifikasi || []

    keepValidSelections(tahun, tahunOptions.value)
    keepValidSelections(jenis, jenisOptions.value)
    keepValidSelections(triwulan, triwulanOptions.value)
    keepValidSelections(neraca, neracaOptions.value)
    keepValidSelections(klasifikasi, klasifikasiOptions.value)

    if (!tahun.value.length && tahunOptions.value.length > 0) {
      tahun.value = [tahunOptions.value[0]]
    }

  } catch (err) {
    console.error(
      'Gagal mengambil filter:',
      err
    )

    error.value =
      err.response?.data?.message ||
      err.message ||
      'Gagal mengambil data filter'

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
| GANTI PERIODE
|--------------------------------------------------------------------------
|
| Saat Tahunan <-> Triwulanan,
| semua pilihan filter di-reset.
|
*/

function setPeriode(value) {
  if (
    periode.value === value
  ) {
    return
  }

  periode.value = value

  jenis.value = []
  tahun.value = []
  triwulan.value = []
  neraca.value = []
  klasifikasi.value = []
}


/*
|--------------------------------------------------------------------------
| TOGGLE JENIS
|--------------------------------------------------------------------------
*/

function toggleJenis(item) {
  if (
    jenis.value.includes(item)
  ) {
    jenis.value =
      jenis.value.filter(
        value =>
          value !== item
      )

    return
  }

  jenis.value.push(item)
}


/*
|--------------------------------------------------------------------------
| RESET FILTER
|--------------------------------------------------------------------------
*/

function resetFilter() {
  jenis.value = []
  tahun.value = []
  triwulan.value = []
  neraca.value = []
  klasifikasi.value = []
}


/*
|--------------------------------------------------------------------------
| WATCH PERUBAHAN FILTER
|--------------------------------------------------------------------------
*/

watch(
  neraca,
  () => {
    klasifikasi.value = []
  }
)

watch(
  [tahun, jenis],
  () => {
    neraca.value = []
    klasifikasi.value = []
  },
  { deep: true }
)


watch(
  () =>
    createFilterKey(),

  async (
    newKey,
    oldKey
  ) => {
    /*
     * Tidak ada perubahan nyata.
     */
    if (
      newKey === oldKey
    ) {
      return
    }

    if (initializing) {
      lastFilterKey = newKey
      return
    }


    lastFilterKey =
      newKey


    /*
     * Kirim kondisi terbaru
     * ke DashboardView.
     */
    const currentFilters =
      getCurrentFilters()

    emit(
      'change',
      currentFilters
    )


    /*
     * Refresh options untuk
     * cascading filter.
     */
    await loadFilterOptions()
  },

  {
    flush: 'post'
  }
)


/*
|--------------------------------------------------------------------------
| LOAD PERTAMA
|--------------------------------------------------------------------------
*/

onMounted(async () => {
  tahun.value = []
  jenis.value = []
  triwulan.value = []
  neraca.value = []
  klasifikasi.value = []

  /*
   * Simpan state awal.
   */
  lastFilterKey =
    createFilterKey()


  /*
   * Ambil options awal.
   */
  await loadFilterOptions()


  /*
   * Kirim initial filter
   * tepat satu kali.
   */
  emit(
    'change',
    getCurrentFilters(),
    { initial: true }
  )

  initializing = false
})
</script>


<template>
  <div
    class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.045)]"
  >

    <!-- HEADER -->

    <div
      class="mb-5 flex
             items-start
             justify-between"
    >

      <div>

        <h3
          class="text-sm font-bold
                 text-slate-900"
        >
          Filter Data
        </h3>


        <p
          class="mt-1 text-xs text-slate-500"
        >
          Sesuaikan data yang ditampilkan
        </p>

      </div>


      <button
        type="button"
        @click="resetFilter"
        title="Reset filter"
        class="flex h-8 w-8
               items-center
               justify-center
               rounded-lg
               border border-slate-200/80
               text-slate-500
               transition
               hover:border-cyan-200
               hover:bg-cyan-50
               hover:text-cyan-700"
      >
        <RotateCcw
          :size="15"
        />
      </button>

    </div>


    <!-- PERIODE -->

    <div class="mb-5">

      <p
        class="mb-2 text-[10px]
               font-semibold uppercase
               tracking-wider
               text-slate-400"
      >
        Periode Data
      </p>


      <div
        class="grid
               grid-cols-2
               gap-2"
      >

        <!-- TAHUNAN -->

        <button
          type="button"
          @click="
            setPeriode('tahunan')
          "
          class="rounded-xl border
                 px-3 py-2.5
                 text-xs font-semibold
                 transition"
          :class="
            periode === 'tahunan'
              ? 'border-cyan-700 bg-cyan-700 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50/70'
          "
        >
          Tahunan
        </button>


        <!-- TRIWULANAN -->

        <button
          type="button"
          @click="
            setPeriode(
              'triwulanan'
            )
          "
          class="rounded-xl border
                 px-3 py-2.5
                 text-xs font-semibold
                 transition"
          :class="
            periode === 'triwulanan'
              ? 'border-cyan-700 bg-cyan-700 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50/70'
          "
        >
          Triwulanan
        </button>

      </div>

    </div>


    <!-- DIVIDER -->

    <div
      class="mb-5
             border-t
             border-slate-100"
    ></div>


    <!-- LOADING AWAL -->

    <div
      v-if="
        loading &&
        tahunOptions.length === 0
      "
      class="mb-5 flex
             items-center
             gap-2
             rounded-xl
             bg-slate-50
             p-3"
    >

      <LoaderCircle
        :size="15"
        class="animate-spin
               text-blue-600"
      />


      <span
        class="text-xs
               text-slate-500"
      >
        Mengambil filter...
      </span>

    </div>


    <!-- ERROR -->

    <div
      v-if="error"
      class="mb-5
             rounded-xl
             border
             border-red-100
             bg-red-50
             p-3"
    >

      <p
        class="text-xs
               font-medium
               text-red-600"
      >
        {{ error }}
      </p>

    </div>


    <!-- FILTER -->

    <div class="space-y-5">

      <!-- TAHUN -->

      <MultiSelectFilter
        v-model="tahun"
        label="Tahun"
        placeholder="Pilih Tahun"
        :options="tahunOptions"
        single-select
      />


      <!-- TRIWULAN -->

      <MultiSelectFilter
        v-if="
          periode ===
          'triwulanan'
        "
        v-model="triwulan"
        label="Triwulan"
        placeholder="Semua Triwulan"
        :options="triwulanOptions"
      />


      <!-- JENIS -->

      <div>

        <p
          class="mb-2 text-[10px]
                 font-semibold uppercase
                 tracking-wider
                 text-slate-400"
        >
          Jenis
        </p>


        <div class="space-y-2">

          <button
            v-for="
              item in jenisOptions
            "
            :key="item"
            type="button"
            @click="
              toggleJenis(item)
            "
            class="flex w-full
                   items-center
                   gap-2.5
                   rounded-xl
                   border
                   px-3
                   py-2.5
                   text-left
                   transition"
            :class="
              jenis.includes(item)
                ? 'border-cyan-200 bg-cyan-50/70'
                : 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/40'
            "
          >

            <!-- CHECKBOX -->

            <div
              class="flex h-4 w-4
                     shrink-0
                     items-center
                     justify-center
                     rounded border"
              :class="
                jenis.includes(item)
                  ? 'border-cyan-700 bg-cyan-700'
                  : 'border-slate-300 bg-white'
              "
            >

              <Check
                v-if="
                  jenis.includes(item)
                "
                :size="11"
                class="text-white"
              />

            </div>


            <!-- LABEL -->

            <span
              class="text-xs
                     font-medium
                     text-slate-700"
            >
              {{ item }}
            </span>

          </button>

        </div>

      </div>


      <!-- NERACA -->

      <MultiSelectFilter
        v-model="neraca"
        label="Neraca"
        placeholder="Semua Neraca"
        :options="neracaOptions"
      />


      <!-- KLASIFIKASI -->

      <MultiSelectFilter
        v-model="klasifikasi"
        label="Klasifikasi"
        :placeholder="
          neraca.length > 0
            ? 'Semua Klasifikasi'
            : 'Pilih neraca terlebih dahulu'
        "
        :options="klasifikasiOptions"
        :disabled="neraca.length === 0"
      />


    </div>


    <!-- STATUS -->

    <div
      class="mt-5
             rounded-xl
             border
             p-3"
      :class="
        error
          ? 'border-red-100 bg-red-50/60'
          : 'border-emerald-100 bg-emerald-50/60'
      "
    >

      <div
        class="flex
               items-center
               gap-2"
      >

        <span
          class="h-2 w-2
                 rounded-full"
          :class="
            error
              ? 'bg-red-500'
              : loading
                ? 'bg-amber-500'
                : 'bg-emerald-500'
          "
        ></span>


        <span
          class="text-xs
                 font-semibold"
          :class="
            error
              ? 'text-red-700'
              : loading
                ? 'text-amber-700'
                : 'text-emerald-700'
          "
        >
          {{
            error
              ? 'Terjadi Kesalahan'
              : loading
                ? 'Memperbarui Data'
                : 'Data Aktif'
          }}
        </span>

      </div>


      <p
        class="mt-1
               pl-4
               text-[10px]
               text-slate-500"
      >
        {{
          periode === 'tahunan'
            ? 'Mode data tahunan'
            : 'Mode data triwulanan'
        }}
      </p>

    </div>

  </div>
</template>