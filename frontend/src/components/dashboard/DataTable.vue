<script setup>
import {
  computed,
  ref,
  watch
} from 'vue'

import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next'

/* =========================================================
   PROPS
========================================================= */

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
})

/* =========================================================
   STATE
========================================================= */

const search = ref('')
const currentPage = ref(1)
const perPage = 10

/* =========================================================
   HELPERS
========================================================= */

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0
  }

  if (typeof value === 'number') {
    return value
  }

  let normalized = String(value)
    .trim()
    .replace(/\s/g, '')

  if (
    normalized.includes('.') &&
    normalized.includes(',')
  ) {
    normalized = normalized
      .replace(/\./g, '')
      .replace(',', '.')
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.')
  }

  const result = Number(normalized)

  return Number.isFinite(result)
    ? result
    : 0
}

function formatNumber(value) {
  return toNumber(value).toLocaleString(
    'id-ID'
  )
}

function calculateAchievement(item) {
  const target = toNumber(item.Target)
  const realization = toNumber(
    item.Realisasi
  )

  if (target === 0) {
    return 0
  }

  return (
    (realization / target) *
    100
  ).toFixed(1)
}

/* =========================================================
   SEARCH
========================================================= */

const filteredData = computed(() => {
  const keyword = search.value
    .trim()
    .toLowerCase()

  if (!keyword) {
    return props.data
  }

  return props.data.filter((item) => {
    return Object.values(item).some(
      (value) => {
        return String(value ?? '')
          .toLowerCase()
          .includes(keyword)
      }
    )
  })
})

/* =========================================================
   PAGINATION
========================================================= */

const totalPages = computed(() => {
  return Math.max(
    1,
    Math.ceil(
      filteredData.value.length /
      perPage
    )
  )
})

const paginatedData = computed(() => {
  const start =
    (currentPage.value - 1) *
    perPage

  return filteredData.value.slice(
    start,
    start + perPage
  )
})

const startItem = computed(() => {
  if (filteredData.value.length === 0) {
    return 0
  }

  return (
    (currentPage.value - 1) *
      perPage +
    1
  )
})

const endItem = computed(() => {
  return Math.min(
    currentPage.value * perPage,
    filteredData.value.length
  )
})

function nextPage() {
  if (
    currentPage.value <
    totalPages.value
  ) {
    currentPage.value++
  }
}

function previousPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

/* Reset ke halaman pertama ketika search berubah */

watch(search, () => {
  currentPage.value = 1
})

/*
  Kalau data Google Sheet berkurang,
  jangan sampai posisi halaman berada
  di halaman yang sudah tidak ada.
*/

watch(
  () => props.data.length,
  () => {
    if (
      currentPage.value >
      totalPages.value
    ) {
      currentPage.value =
        totalPages.value
    }
  }
)

/* =========================================================
   STATUS STYLE
========================================================= */

function getStatusClass(status) {
  const value = String(
    status || ''
  ).toLowerCase()

  if (
    value === 'selesai' ||
    value === 'done'
  ) {
    return 'bg-emerald-50 text-emerald-700'
  }

  if (
    value === 'dalam proses' ||
    value === 'proses' ||
    value === 'pending'
  ) {
    return 'bg-blue-50 text-blue-700'
  }

  if (
    value === 'belum mulai'
  ) {
    return 'bg-slate-100 text-slate-600'
  }

  if (
    value === 'terkendala' ||
    value === 'batal'
  ) {
    return 'bg-red-50 text-red-700'
  }

  return 'bg-orange-50 text-orange-700'
}

/* =========================================================
   EXPORT CSV
========================================================= */

function escapeCSV(value) {
  const text = String(
    value ?? ''
  ).replace(/"/g, '""')

  return `"${text}"`
}

function exportCSV() {
  if (
    filteredData.value.length === 0
  ) {
    return
  }

  const headers = [
    'ID',
    'Tanggal',
    'Tahun',
    'Bulan',
    'Provinsi',
    'Kabupaten',
    'Kecamatan',
    'Target',
    'Realisasi',
    'Capaian',
    'Status'
  ]

  const rows =
    filteredData.value.map(
      (item) => [
        item.ID,
        item.Tanggal,
        item.Tahun,
        item.Bulan,
        item.Provinsi,
        item.Kabupaten,
        item.Kecamatan,
        item.Target,
        item.Realisasi,
        `${calculateAchievement(
          item
        )}%`,
        item.Status
      ]
    )

  const csvContent = [
    headers,
    ...rows
  ]
    .map((row) =>
      row
        .map(escapeCSV)
        .join(';')
    )
    .join('\n')

  /*
    BOM supaya karakter Indonesia
    terbaca dengan baik ketika dibuka
    menggunakan Excel.
  */

  const blob = new Blob(
    [
      '\uFEFF',
      csvContent
    ],
    {
      type:
        'text/csv;charset=utf-8;'
    }
  )

  const url =
    URL.createObjectURL(blob)

  const link =
    document.createElement('a')

  link.href = url

  link.download =
    `data-dashboard-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`

  document.body.appendChild(link)

  link.click()

  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl
           border border-slate-200
           bg-white shadow-sm"
  >

    <!-- ==================================================
         HEADER
    =================================================== -->

    <div
      class="flex flex-col gap-4
             border-b border-slate-100
             p-6
             lg:flex-row
             lg:items-center
             lg:justify-between"
    >
      <div>
        <h2
          class="font-semibold
                 text-slate-800"
        >
          Data Detail
        </h2>

        <p
          class="mt-1 text-xs
                 text-slate-400"
        >
          Data hasil monitoring
          Google Spreadsheet
        </p>
      </div>

      <div
        class="flex flex-col gap-3
               sm:flex-row"
      >

        <!-- SEARCH -->

        <div class="relative">

          <Search
            :size="17"
            class="absolute left-3
                   top-1/2
                   -translate-y-1/2
                   text-slate-400"
          />

          <input
            v-model="search"
            type="text"
            placeholder="Cari data..."
            class="h-10 w-full
                   rounded-xl border
                   border-slate-200
                   bg-white pl-10 pr-4
                   text-sm outline-none
                   transition
                   focus:border-blue-500
                   focus:ring-2
                   focus:ring-blue-100
                   sm:w-64"
          />

        </div>

        <!-- EXPORT -->

        <button
          @click="exportCSV"
          :disabled="
            filteredData.length === 0
          "
          class="flex h-10
                 items-center
                 justify-center gap-2
                 rounded-xl border
                 border-slate-200
                 px-4 text-sm
                 font-medium
                 text-slate-600
                 transition
                 hover:bg-slate-50
                 disabled:cursor-not-allowed
                 disabled:opacity-40"
        >
          <Download :size="17" />

          Export
        </button>

      </div>
    </div>

    <!-- ==================================================
         TABLE
    =================================================== -->

    <div class="overflow-x-auto">

      <table class="w-full">

        <thead>

          <tr
            class="border-b
                   border-slate-100
                   bg-slate-50"
          >

            <th class="table-heading">
              ID
            </th>

            <th class="table-heading">
              Tanggal
            </th>

            <th class="table-heading">
              Wilayah
            </th>

            <th class="table-heading">
              Target
            </th>

            <th class="table-heading">
              Realisasi
            </th>

            <th class="table-heading">
              Capaian
            </th>

            <th class="table-heading">
              Status
            </th>

          </tr>

        </thead>

        <tbody>

          <tr
            v-for="(item, index)
              in paginatedData"
            :key="
              item.ID ??
              `${currentPage}-${index}`
            "
            class="border-b
                   border-slate-100
                   transition
                   last:border-0
                   hover:bg-slate-50"
          >

            <!-- ID -->

            <td class="table-cell">
              <span
                class="font-medium
                       text-slate-500"
              >
                {{ item.ID || '-' }}
              </span>
            </td>

            <!-- TANGGAL -->

            <td class="table-cell">
              {{ item.Tanggal || '-' }}

              <div
                class="mt-1 text-xs
                       text-slate-400"
              >
                {{
                  item.Bulan || '-'
                }}
                ·
                {{
                  item.Tahun || '-'
                }}
              </div>
            </td>

            <!-- WILAYAH -->

            <td
              class="table-cell
                     min-w-[220px]"
            >

              <div
                class="font-medium
                       text-slate-800"
              >
                {{
                  item.Kecamatan ||
                  '-'
                }}
              </div>

              <div
                class="mt-1 text-xs
                       text-slate-400"
              >
                {{
                  item.Kabupaten ||
                  '-'
                }}
                •
                {{
                  item.Provinsi ||
                  '-'
                }}
              </div>

            </td>

            <!-- TARGET -->

            <td class="table-cell">
              {{
                formatNumber(
                  item.Target
                )
              }}
            </td>

            <!-- REALISASI -->

            <td class="table-cell">
              {{
                formatNumber(
                  item.Realisasi
                )
              }}
            </td>

            <!-- CAPAIAN -->

            <td class="table-cell">

              <span
                class="font-semibold
                       text-slate-700"
              >
                {{
                  calculateAchievement(
                    item
                  )
                }}%
              </span>

            </td>

            <!-- STATUS -->

            <td class="table-cell">

              <span
                :class="[
                  'inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold',
                  getStatusClass(
                    item.Status
                  )
                ]"
              >
                {{
                  item.Status ||
                  'Tidak Diketahui'
                }}
              </span>

            </td>

          </tr>

          <!-- EMPTY STATE -->

          <tr
            v-if="
              paginatedData.length === 0
            "
          >
            <td
              colspan="7"
              class="px-6 py-12
                     text-center"
            >
              <tr
  v-if="paginatedData.length === 0"
>
  <td
    colspan="7"
    class="px-6 py-12 text-center"
  >
    <p
      class="text-sm font-medium
             text-slate-600"
    >
      Data tidak ditemukan
    </p>

    <p
      class="mt-1 text-xs
             text-slate-400"
    >
      Coba gunakan kata kunci pencarian
      yang berbeda.
    </p>
  </td>
</tr>
            </td>
          </tr>

        </tbody>

      </table>

    </div>

    <!-- ==================================================
         FOOTER
    =================================================== -->

    <div
      class="flex flex-col gap-3
             border-t border-slate-100
             px-6 py-4
             sm:flex-row
             sm:items-center
             sm:justify-between"
    >

      <div>

        <p
          class="text-xs
                 text-slate-500"
        >
          Menampilkan
          {{ startItem }}
          –
          {{ endItem }}
          dari
          {{ filteredData.length }}
          data
        </p>

        <p
          class="mt-1 text-xs
                 text-slate-400"
        >
          Halaman
          {{ currentPage }}
          dari
          {{ totalPages }}
        </p>

      </div>

      <div class="flex gap-2">

        <button
          @click="previousPage"
          :disabled="
            currentPage === 1
          "
          class="pagination-button"
          title="Halaman sebelumnya"
        >
          <ChevronLeft :size="17" />
        </button>

        <div
          class="flex h-9
                 min-w-9
                 items-center
                 justify-center
                 rounded-lg
                 bg-blue-50
                 px-3 text-xs
                 font-semibold
                 text-blue-600"
        >
          {{ currentPage }}
        </div>

        <button
          @click="nextPage"
          :disabled="
            currentPage ===
            totalPages
          "
          class="pagination-button"
          title="Halaman berikutnya"
        >
          <ChevronRight :size="17" />
        </button>

      </div>

    </div>

  </div>
</template>

<style scoped>
@reference "../../style.css";

.table-heading {
  @apply whitespace-nowrap
         px-6 py-4
         text-left
         text-xs
         font-semibold
         uppercase
         tracking-wider
         text-slate-500;
}

.table-cell {
  @apply px-6 py-4
         text-sm
         text-slate-600;
}

.pagination-button {
  @apply flex h-9 w-9
         items-center
         justify-center
         rounded-lg
         border
         border-slate-200
         text-slate-500
         transition
         hover:bg-slate-50
         disabled:cursor-not-allowed
         disabled:opacity-40;
}
</style>