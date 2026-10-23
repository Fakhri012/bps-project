<script setup>
import {
  ref,
  toRef,
  computed,
  watch,
  onMounted
} from 'vue'

import {
  RotateCcw,
  LoaderCircle,
  SlidersHorizontal,
  X,
  ChevronDown
} from 'lucide-vue-next'

import MultiSelectFilter
  from '../dashboard/MultiSelectFilter.vue'

import {
  getTahunanAssetFilters,
  getTriwulananAssetFilters
} from '../../services/dashboardApi'

import {
  usePersistentFilterState
} from '../../composables/filterState.js'

import {
  formatDisplayNumber
} from '../../utils/displayFormatters.js'

import {
  formatNeracaOptionLabel,
  prioritizeSectorOptions
} from '../../utils/dashboardText.js'


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
| STATE FILTER
|--------------------------------------------------------------------------
*/

const { state: savedFilters } =
  usePersistentFilterState('asset', {
    periode: 'tahunan',
    tahun: [],
    triwulan: [],
    jenis: [],
    neraca: [],
    klasifikasi: [],
    institusi: []
  }, {
    periode: 'periode',
    jenis: 'jenis',
    tahun: 'tahun',
    triwulan: 'triwulan',
    neraca: 'neraca',
    klasifikasi: 'klasifikasi'
  })

const periode = toRef(savedFilters, 'periode')
const tahun = toRef(savedFilters, 'tahun')
const triwulan = toRef(savedFilters, 'triwulan')
const jenis = toRef(savedFilters, 'jenis')
const neraca = toRef(savedFilters, 'neraca')
const klasifikasi = toRef(savedFilters, 'klasifikasi')
const institusi = toRef(savedFilters, 'institusi')


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
      return {
        value:
          `Q${item.value}`,

        label:
          item.label ||
          `Q${item.value}`
      }
    }

    const value =
      String(item)

    return {
      value:
        value.startsWith('Q')
          ? value
          : `Q${value}`,

      label:
        value.startsWith('Q')
          ? value
          : `Q${value}`
    }
  })
}


/*
|--------------------------------------------------------------------------
| NORMALISASI INSTITUSI ASSET
|--------------------------------------------------------------------------
|
| BERBEDA dengan Dashboard.
|
| Asset TIDAK menyembunyikan:
|
| NFC Private
| NFC Public
|
*/

function normalizeInstitusiOptions(
  options = []
) {
  return options
    .map(item => {
      if (
        typeof item === 'object' &&
        item !== null
      ) {
        const kode =
          String(
            item.kode ??
            item.value ??
            ''
          ).trim()

        const nama =
          String(
            item.nama ??
            item.label ??
            kode
          ).trim()

        return {
          value: kode,
          label:
            nama || kode
        }
      }

      const value =
        String(
          item ?? ''
        ).trim()

      return {
        value,
        label: value
      }
    })
    .filter(
      item =>
        item.value !== ''
    )
}


/*
|--------------------------------------------------------------------------
| NORMALISASI OPTION TEXT
|--------------------------------------------------------------------------
*/

function normalizeTextOptions(
  options = []
) {
  return options.map(item => {
    if (
      typeof item === 'object' &&
      item !== null
    ) {
      return {
        value:
          String(
            item.value ??
            item.label ??
            ''
          ),

        label:
          String(
            item.label ??
            item.value ??
            ''
          )
      }
    }

    return {
      value:
        String(item ?? ''),

      label:
        String(item ?? '')
    }
  })
}


/*
|--------------------------------------------------------------------------
| FILTER AKTIF
|--------------------------------------------------------------------------
*/

function getCurrentFilters() {
  return {
    periode:
      periode.value,

    tahun:
      [...tahun.value],

    triwulan:
      [...triwulan.value],

    jenis:
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
| DEFINISI GRUP FILTER
|--------------------------------------------------------------------------
|
| Satu sumber untuk: chip aktif, label, dan
| akses ke ref masing-masing filter.
|
*/

const filterGroups =
  computed(() => {
    const groups = [
      {
        key: 'tahun',
        label: 'Tahun',
        model: tahun,
        options: tahunOptions.value
      },

      {
        key: 'jenis',
        label: 'Jenis',
        model: jenis,
        options: jenisOptions.value
      },

      {
        key: 'neraca',
        label: 'Neraca',
        model: neraca,
        options: neracaOptions.value
      },

      {
        key: 'klasifikasi',
        label: 'Klasifikasi',
        model: klasifikasi,
        options: klasifikasiOptions.value
      },

      {
        key: 'institusi',
        label: 'Institusi',
        model: institusi,
        options: institusiOptions.value
      }
    ]

    if (
      periode.value ===
      'triwulanan'
    ) {
      groups.splice(1, 0, {
        key: 'triwulan',
        label: 'Triwulan',
        model: triwulan,
        options: triwulanOptions.value
      })
    }

    return groups
  })


/*
|--------------------------------------------------------------------------
| CHIP FILTER AKTIF
|--------------------------------------------------------------------------
*/

function findLabel(options, value) {
  const found =
    options.find(
      opt => opt.value === value
    )

  return (
    found?.label ??
    value
  )
}

const activeChips =
  computed(() => {
    const chips = []

    for (const group of filterGroups.value) {
      for (const value of group.model.value) {
        chips.push({
          group: group.key,
          groupLabel: group.label,
          value,
          label:
            findLabel(
              group.options,
              value
            )
        })
      }
    }

    return chips
  })

const activeCount =
  computed(() =>
    activeChips.value.length
  )

const activeChipGroups =
  computed(() => {
    const groups = new Map()

    for (const chip of activeChips.value) {
      if (!groups.has(chip.group)) {
        groups.set(chip.group, {
          key: chip.group,
          label: chip.groupLabel,
          chips: []
        })
      }

      groups.get(chip.group).chips.push(chip)
    }

    return [...groups.values()]
  })

const expandedFilterGroup = ref('')

const expandedChipGroup =
  computed(() =>
    activeChipGroups.value.find(
      group => group.key === expandedFilterGroup.value
    )
  )

function toggleFilterGroup(key) {
  expandedFilterGroup.value =
    expandedFilterGroup.value === key
      ? ''
      : key
}

function removeChip(chip) {
  const group =
    filterGroups.value.find(
      g => g.key === chip.group
    )

  if (!group) {
    return
  }

  group.model.value =
    group.model.value.filter(
      v => v !== chip.value
    )
}


/*
|--------------------------------------------------------------------------
| PARAMETER FILTER OPTIONS
|--------------------------------------------------------------------------
*/

function buildFilterParams() {
  const params = {
    tahun:
      tahun.value,

    sisi:
      jenis.value,

    neraca:
      neraca.value,

    klasifikasi:
      klasifikasi.value,

    institusi:
      institusi.value
  }


  if (
    periode.value ===
    'triwulanan'
  ) {
    params.triwulan =
      triwulan.value.map(
        item =>
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
| LOAD FILTER OPTIONS
|--------------------------------------------------------------------------
*/

async function loadFilterOptions() {
  const currentRequest =
    ++requestId

  try {
    loading.value = true
    error.value = ''


    const params =
      buildFilterParams()


    let response


    if (
      periode.value ===
      'triwulanan'
    ) {
response =
  await getTriwulananAssetFilters(
    params
  )

    } else {
        response =
        await getTahunanAssetFilters(
            params
        )
    }


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
      normalizeTextOptions(
        filters.tahun || []
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
    | JENIS
    |--------------------------------------------------------------------------
    */

    jenisOptions.value =
      normalizeTextOptions(
        filters.sisi || []
      )


    /*
    |--------------------------------------------------------------------------
    | NERACA
    |--------------------------------------------------------------------------
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
      normalizeTextOptions(
        filters.klasifikasi || []
      )


    /*
    |--------------------------------------------------------------------------
    | INSTITUSI
    |--------------------------------------------------------------------------
    |
    | Tidak ada filter NFC Private/Public.
    |
    */

    institusiOptions.value =
      prioritizeSectorOptions(
        normalizeInstitusiOptions(
        filters.institusi || []
        )
      )

  } catch (err) {
    console.error(
      'Gagal mengambil filter Asset:',
      err
    )

    error.value =
      err?.response
        ?.data
        ?.message ||
      err.message ||
      'Gagal mengambil filter'

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
*/

function setPeriode(value) {
  if (
    periode.value === value
  ) {
    return
  }

  periode.value =
    value

  tahun.value = []
  triwulan.value = []
  jenis.value = []
  neraca.value = []
  klasifikasi.value = []
  institusi.value = []
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
| WATCH FILTER
|--------------------------------------------------------------------------
*/

watch(
  [
    periode,
    tahun,
    triwulan,
    jenis,
    neraca,
    klasifikasi,
    institusi
  ],

  async () => {
    /*
     * Kirim ke AssetView.
     */

    emit(
      'change',
      getCurrentFilters()
    )


    /*
     * Refresh cascading options.
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
| LOAD AWAL
|--------------------------------------------------------------------------
*/

onMounted(async () => {
  await loadFilterOptions()

  emit(
    'change',
    getCurrentFilters(),
    { initial: true }
  )
})
</script>


<template>
  <div
    class="
      rounded-xl
      border border-slate-200/80
      border-t-2 border-t-teal-500
      bg-white
      shadow-[0_8px_24px_rgba(15,23,42,0.045)]
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
        px-4
        py-3
        sm:flex-row
        sm:items-center
        sm:justify-between
      "
    >
      <!-- TITLE -->
      <div
        class="
          flex
          min-w-0
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
            bg-teal-50
            text-teal-700
          "
        >
          <SlidersHorizontal
            :size="14"
          />
        </div>

        <div class="min-w-0">
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
              Filter Data
            </h2>

            <span
              v-if="activeCount > 0"
              class="
                inline-flex
                min-w-5
                items-center
                justify-center
                rounded-full
                bg-teal-700
                px-1.5
                py-0.5
                text-[9px]
                font-bold
                text-white
              "
            >
              {{ formatDisplayNumber(activeCount) }}
            </span>
          </div>

          <p
            class="
              mt-0.5
              flex
              items-center
              gap-1
              text-[10px]
              text-slate-400
            "
          >
            <span>
              Pilih data yang ingin ditampilkan
            </span>

            <span
              v-if="loading"
              class="
                inline-flex
                items-center
                gap-1
                text-teal-600
              "
            >
              ·

              <LoaderCircle
                :size="9"
                class="animate-spin"
              />
            </span>
          </p>
        </div>
      </div>


      <!-- CONTROLS -->
      <div
        class="
          flex
          shrink-0
          items-center
          gap-2
        "
      >
        <!-- PERIODE -->
        <div
          class="
            inline-flex
            rounded-lg
            bg-slate-100
            p-0.5
          "
        >
          <button
            type="button"
            class="
              rounded-md
              px-3
              py-1.5
              text-[11px]
              font-semibold
              transition
            "
            :class="
              periode === 'tahunan'
                ? `
                    bg-white
                    text-teal-700
                    shadow-sm
                  `
                : `
                    text-slate-500
                    hover:text-slate-700
                  `
            "
            @click="
              setPeriode(
                'tahunan'
              )
            "
          >
            Tahunan
          </button>


          <button
            type="button"
            class="
              rounded-md
              px-3
              py-1.5
              text-[11px]
              font-semibold
              transition
            "
            :class="
              periode === 'triwulanan'
                ? `
                    bg-white
                    text-teal-700
                    shadow-sm
                  `
                : `
                    text-slate-500
                    hover:text-slate-700
                  `
            "
            @click="
              setPeriode(
                'triwulanan'
              )
            "
          >
            Triwulanan
          </button>
        </div>


        <!-- RESET -->
        <button
          type="button"
          :disabled="
            activeCount === 0
          "
          title="Reset semua filter"
          class="
            inline-flex
            h-8
            items-center
            justify-center
            gap-1.5
            rounded-lg
            border border-slate-200
            bg-white
            px-2.5
            text-[10px]
            font-semibold
            text-slate-500
            transition

            hover:border-red-200
            hover:bg-red-50
            hover:text-red-600

            disabled:cursor-not-allowed
            disabled:opacity-35
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
    </div>


    <!-- =====================================================
         ERROR
    ====================================================== -->
    <div
      v-if="error"
      class="
        mx-4
        mb-3
        rounded-lg
        border border-red-100
        bg-red-50
        px-3
        py-2
        text-[11px]
        text-red-600
      "
    >
      {{ error }}
    </div>


    <!-- =====================================================
         ACTIVE FILTER CHIPS
    ====================================================== -->
    <div
      v-if="activeCount > 0"
      class="
        border-y
        border-slate-100
        bg-slate-50/40
        px-4
        py-2.5
      "
    >
      <div
        class="
          flex
          flex-wrap
          items-center
          gap-2
        "
      >
        <span
          class="
            mr-1
            text-[10px]
            font-semibold
            text-slate-500
          "
        >
          Filter aktif
        </span>

        <button
          v-for="group in activeChipGroups"
          :key="group.key"
          type="button"
          :aria-expanded="expandedFilterGroup === group.key"
          aria-controls="active-filter-values"
          class="
            inline-flex
            min-h-7
            items-center
            gap-1.5
            rounded-md
            border
            px-2
            text-[10px]
            font-medium
            transition
          "
          :class="
            expandedFilterGroup === group.key
              ? 'border-teal-200 bg-teal-50 text-teal-800'
              : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:text-teal-800'
          "
          @click="toggleFilterGroup(group.key)"
        >
          <span>{{ group.label }}</span>
          <span
            class="
              rounded-full
              bg-slate-100
              px-1.5
              py-0.5
              text-[9px]
              font-bold
              text-slate-600
            "
          >
            {{ formatDisplayNumber(group.chips.length) }}
          </span>
          <ChevronDown
            :size="12"
            class="transition-transform"
            :class="expandedFilterGroup === group.key ? 'rotate-180' : ''"
          />
        </button>
      </div>

      <div
        v-if="expandedChipGroup"
        id="active-filter-values"
        class="
          mt-2
          flex
          flex-wrap
          gap-1.5
          rounded-lg
          border
          border-slate-200
          bg-white
          p-2
        "
      >
        <TransitionGroup name="chip">
          <button
            v-for="chip in expandedChipGroup.chips"
            :key="`${chip.group}-${chip.value}`"
            type="button"
            class="
              group
              inline-flex
              max-w-full
              items-center
              gap-1
              rounded-md
              border
              border-teal-100
              bg-teal-50
              px-2
              py-1
              text-[10px]
              font-medium
              text-teal-800
              transition
              hover:bg-teal-100
            "
            :aria-label="`Hapus ${chip.label} dari filter ${chip.groupLabel}`"
            @click="removeChip(chip)"
          >
            <span class="max-w-[min(70vw,280px)] truncate" :title="chip.label">
              {{ chip.label }}
            </span>
            <X
              :size="10"
              class="shrink-0 text-teal-500 group-hover:text-teal-800"
            />
          </button>
        </TransitionGroup>
      </div>
    </div>


    <!-- =====================================================
         FILTER GRID
    ====================================================== -->
    <div
      class="
        grid
        gap-x-3
        gap-y-3
        px-4
        pb-4
        pt-3
        sm:grid-cols-2
        xl:grid-cols-3
        2xl:grid-cols-4
      "
    >
      <!-- TAHUN -->
      <MultiSelectFilter
        v-model="tahun"
        label="Tahun"
        placeholder="Semua Tahun"
        :options="tahunOptions"
      />


      <!-- TRIWULAN -->
      <Transition
        name="fade-scale"
      >
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
      </Transition>


      <!-- JENIS -->
      <MultiSelectFilter
        v-model="jenis"
        label="Jenis"
        placeholder="Semua Jenis"
        :options="jenisOptions"
      />


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
        placeholder="Semua Klasifikasi"
        :options="klasifikasiOptions"
      />


      <!-- INSTITUSI -->
      <MultiSelectFilter
        v-model="institusi"
        label="Institusi"
        placeholder="Semua Institusi"
        :options="institusiOptions"
      />
    </div>
  </div>
</template>


<style scoped>
/*
|--------------------------------------------------------------------------
| CHIP TRANSITION
|--------------------------------------------------------------------------
*/

.chip-enter-active,
.chip-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.chip-enter-from,
.chip-leave-to {
  opacity: 0;
  transform: scale(0.94);
}


/*
|--------------------------------------------------------------------------
| TRIWULAN TRANSITION
|--------------------------------------------------------------------------
*/

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}


/*
|--------------------------------------------------------------------------
| CHIP SCROLLBAR
|--------------------------------------------------------------------------
*/

.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color:
    #cbd5e1 transparent;
}

.scrollbar-thin::-webkit-scrollbar {
  height: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 999px;
}
</style>