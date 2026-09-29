<script setup>
import {
  ref
} from 'vue'

import {
  Search,
  Database,
  X,
  CalendarRange,
  Rows3
} from 'lucide-vue-next'

import AssetFilter
  from '../components/assets/AssetFilter.vue'

import AssetTable
  from '../components/assets/AssetTable.vue'

import {
  getTahunanAsset,
  getTriwulananAsset
} from '../services/dashboardApi'


/*
|--------------------------------------------------------------------------
| DATA
|--------------------------------------------------------------------------
*/

const rows =
  ref([])


const pagination =
  ref({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    from: 0,
    to: 0
  })


/*
|--------------------------------------------------------------------------
| FILTER
|--------------------------------------------------------------------------
*/

const activeFilters =
  ref({
    periode:
      'tahunan',

    tahun: [],

    triwulan: [],

    jenis: [],

    neraca: [],

    klasifikasi: [],

    institusi: []
  })


/*
|--------------------------------------------------------------------------
| SEARCH
|--------------------------------------------------------------------------
*/

const search =
  ref('')

let searchTimer = null


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
| PARAMETER API
|--------------------------------------------------------------------------
*/

function buildAssetParams() {
  const params = {
    page:
      pagination.value.page,

    limit:
      pagination.value.limit,

    tahun:
      activeFilters.value
        .tahun,

    sisi:
      activeFilters.value
        .jenis,

    neraca:
      activeFilters.value
        .neraca,

    klasifikasi:
      activeFilters.value
        .klasifikasi,

    institusi:
      activeFilters.value
        .institusi,

    search:
      search.value
        .trim()
  }


  if (
    activeFilters.value
      .periode ===
    'triwulanan'
  ) {
    params.triwulan =
      activeFilters.value
        .triwulan
        .map(item =>
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
| LOAD ASSET
|--------------------------------------------------------------------------
*/

async function loadAsset() {
  const currentRequest =
    ++requestId


  try {
    loading.value = true
    error.value = ''


    const params =
      buildAssetParams()


    let response


    if (
      activeFilters.value
        .periode ===
      'triwulanan'
    ) {
      response =
        await getTriwulananAsset(
          params
        )

    } else {
      response =
        await getTahunanAsset(
          params
        )
    }


    /*
     * Abaikan response lama.
     */

    if (
      currentRequest !==
      requestId
    ) {
      return
    }


    rows.value =
      response.data || []


    pagination.value = {
      page:
        response.pagination
          ?.page ?? 1,

      limit:
        response.pagination
          ?.limit ?? 25,

      total:
        response.pagination
          ?.total ?? 0,

      totalPages:
        response.pagination
          ?.totalPages ?? 0,

      from:
        response.pagination
          ?.from ?? 0,

      to:
        response.pagination
          ?.to ?? 0
    }

  } catch (err) {
    if (
      currentRequest !==
      requestId
    ) {
      return
    }


    console.error(
      'Gagal mengambil Asset:',
      err
    )


    error.value =
      err?.response
        ?.data
        ?.message ||
      err.message ||
      'Gagal mengambil data Asset'


    rows.value = []


    pagination.value = {
      ...pagination.value,

      total: 0,
      totalPages: 0,
      from: 0,
      to: 0
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
| FILTER CHANGE
|--------------------------------------------------------------------------
*/

function handleFilterChange(
  filters
) {
  activeFilters.value = {
    periode:
      filters.periode ||
      'tahunan',

    tahun:
      filters.tahun || [],

    triwulan:
      filters.triwulan || [],

    jenis:
      filters.jenis || [],

    neraca:
      filters.neraca || [],

    klasifikasi:
      filters.klasifikasi || [],

    institusi:
      filters.institusi || []
  }


  /*
   * Setiap filter berubah,
   * kembali ke page pertama.
   */

  pagination.value.page = 1


  loadAsset()
}


/*
|--------------------------------------------------------------------------
| SEARCH
|--------------------------------------------------------------------------
*/

function handleSearchInput() {
  /*
   * Debounce 400ms.
   *
   * Supaya tidak request setiap
   * satu karakter diketik.
   */

  if (searchTimer) {
    clearTimeout(
      searchTimer
    )
  }


  searchTimer =
    setTimeout(() => {
      pagination.value.page = 1

      loadAsset()
    }, 400)
}


function clearSearch() {
  search.value = ''

  pagination.value.page = 1

  loadAsset()
}


/*
|--------------------------------------------------------------------------
| PAGE CHANGE
|--------------------------------------------------------------------------
*/

function handlePageChange(page) {
  pagination.value.page =
    page

  loadAsset()
}


/*
|--------------------------------------------------------------------------
| LIMIT CHANGE
|--------------------------------------------------------------------------
*/

function handleLimitChange(limit) {
  pagination.value.limit =
    limit

  pagination.value.page = 1

  loadAsset()
}
</script>


<template>
  <section
    class="
      space-y-5
    "
  >
<!-- =====================================================
     PAGE HEADER
===================================================== -->
<section
  class="
    relative
    overflow-hidden
    rounded-2xl
    border border-slate-200/80
    bg-white
    px-5
    py-5
    shadow-[0_1px_3px_rgba(15,23,42,0.04)]
    lg:px-6
  "
>
  <!-- BACKGROUND DECORATION -->
  <div
    class="
      pointer-events-none
      absolute
      -right-20
      -top-24
      h-56
      w-56
      rounded-full
      bg-cyan-100/60
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
    <!-- LEFT -->
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
          bg-cyan-50/80
          px-3
          py-1.5
        "
      >
        <Database
          :size="13"
          class="text-cyan-700"
        />

        <span
          class="
            text-[10px]
            font-bold
            uppercase
            tracking-[0.14em]
            text-cyan-700
          "
        >
          Asset Data
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
        Data Detail Neraca Institusi
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
        Telusuri data neraca tahunan dan triwulanan secara
        lebih detail berdasarkan periode, jenis, neraca,
        klasifikasi, dan institusi.
      </p>
    </div>


<!-- RIGHT INFORMATION -->
<div
  class="
    flex
    flex-wrap
    items-center
    gap-2.5
    xl:justify-end
  "
>
  <!-- MODE DATA -->
  <div
    class="
      group
      flex
      min-w-[155px]
      items-center
      gap-3
      rounded-xl
      border border-slate-200/80
      bg-white/80
      px-3
      py-2.5
      shadow-sm
      transition-all
      duration-200
      hover:-translate-y-0.5
      hover:border-blue-200
      hover:shadow-md
    "
  >
    <!-- ICON -->
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
        transition
        group-hover:bg-blue-100
      "
    >
      <CalendarRange
        :size="16"
        :stroke-width="1.8"
      />
    </div>


    <!-- TEXT -->
    <div class="min-w-0">
      <p
        class="
          text-[9px]
          font-bold
          uppercase
          tracking-[0.11em]
          text-slate-400
        "
      >
        Mode Data
      </p>

      <p
        class="
          mt-0.5
          text-[13px]
          font-bold
          capitalize
          text-slate-800
        "
      >
        {{ activeFilters.periode }}
      </p>
    </div>
  </div>


  <!-- DATA DITEMUKAN -->
  <div
    class="
      group
      flex
      min-w-[175px]
      items-center
      gap-3
      rounded-xl
      border border-slate-200/80
      bg-white/80
      px-3
      py-2.5
      shadow-sm
      transition-all
      duration-200
      hover:-translate-y-0.5
      hover:border-cyan-200
      hover:shadow-md
    "
  >
    <!-- ICON -->
    <div
      class="
        flex
        h-9
        w-9
        shrink-0
        items-center
        justify-center
        rounded-lg
        bg-cyan-50
        text-cyan-600
        transition
        group-hover:bg-cyan-100
      "
    >
      <Rows3
        :size="16"
        :stroke-width="1.8"
      />
    </div>


    <!-- TEXT -->
    <div class="min-w-0">
      <p
        class="
          text-[9px]
          font-bold
          uppercase
          tracking-[0.11em]
          text-slate-400
        "
      >
        Data Ditemukan
      </p>

      <div
        class="
          mt-0.5
          flex
          items-baseline
          gap-1
        "
      >
        <span
          class="
            text-[17px]
            font-extrabold
            tracking-tight
            text-slate-900
          "
        >
          {{
            new Intl.NumberFormat(
              'id-ID'
            ).format(
              pagination.total
            )
          }}
        </span>

        <span
          class="
            text-[9px]
            font-medium
            text-slate-400
          "
        >
          baris
        </span>
      </div>
    </div>
  </div>
</div>
  </div>
</section>


 


    <!-- FILTER -->
    <AssetFilter
      @change="
        handleFilterChange
      "
    />


    <!-- SEARCH -->
    <div
      class="
        rounded-2xl
        border border-slate-200
        bg-white
        p-4
        shadow-sm
      "
    >
      <div
        class="
          relative
        "
      >
        <Search
          :size="17"
          class="
            absolute
            left-4
            top-1/2
            -translate-y-1/2
            text-slate-400
          "
        />

        <input
          v-model="search"
          type="text"
          placeholder="Cari institusi, kode, neraca, rincian..."
          class="
            w-full
            rounded-xl
            border border-slate-200
            bg-slate-50
            py-3
            pl-11
            pr-11
            text-sm
            text-slate-700
            outline-none
            transition
            placeholder:text-slate-400
            focus:border-blue-400
            focus:bg-white
            focus:ring-2
            focus:ring-blue-100
          "
          @input="
            handleSearchInput
          "
        />


        <button
          v-if="search"
          type="button"
          class="
            absolute
            right-3
            top-1/2
            flex
            h-7
            w-7
            -translate-y-1/2
            items-center
            justify-center
            rounded-lg
            text-slate-400
            transition
            hover:bg-slate-200
            hover:text-slate-600
          "
          @click="
            clearSearch
          "
        >
          <X
            :size="14"
          />
        </button>
      </div>
    </div>


    <!-- ERROR -->
    <div
      v-if="error"
      class="
        rounded-xl
        border border-red-100
        bg-red-50
        px-4
        py-3
        text-sm
        text-red-600
      "
    >
      {{ error }}
    </div>


    <!-- TABLE -->
    <AssetTable
      :rows="rows"
      :loading="loading"
      :pagination="pagination"
      @page-change="
        handlePageChange
      "
      @limit-change="
        handleLimitChange
      "
    />
  </section>
</template>