<script setup>
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount
} from 'vue'

import {
  CalendarDays,
  Database
} from 'lucide-vue-next'

import {
  getCacheInfo
} from '../../services/dashboardApi'


/*
|--------------------------------------------------------------------------
| TANGGAL
|--------------------------------------------------------------------------
*/

const currentDate = computed(() => {
  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }
  ).format(new Date())
})


/*
|--------------------------------------------------------------------------
| CACHE STATUS
|--------------------------------------------------------------------------
*/

const cacheLoading = ref(true)

const cacheError = ref(false)

const lastSyncedAt = ref(null)


/*
|--------------------------------------------------------------------------
| FORMAT JAM
|--------------------------------------------------------------------------
*/

function formatTime(date) {
  if (!date) {
    return null
  }

  const parsed = new Date(date)

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }
  ).format(parsed)
}


/*
|--------------------------------------------------------------------------
| LABEL SINKRON
|--------------------------------------------------------------------------
*/

const syncLabel = computed(() => {
  if (cacheLoading.value) {
    return 'Mengecek...'
  }

  if (cacheError.value) {
    return 'Status tidak tersedia'
  }

  if (!lastSyncedAt.value) {
    return 'Belum sinkron'
  }

  return `Diperbarui ${formatTime(
    lastSyncedAt.value
  )}`
})


/*
|--------------------------------------------------------------------------
| STATUS KONEKSI
|--------------------------------------------------------------------------
*/

const connectionLabel = computed(() => {
  if (cacheError.value) {
    return 'Gangguan'
  }

  return 'Terhubung'
})


/*
|--------------------------------------------------------------------------
| AMBIL INFO CACHE
|--------------------------------------------------------------------------
*/

async function loadCacheInfo() {
  try {
    cacheError.value = false

    const response =
      await getCacheInfo()

    /*
     * Response backend:
     *
     * {
     *   success: true,
     *   cache: {
     *     tahunan: {...},
     *     triwulanan: {...}
     *   }
     * }
     */

    const tahunanLoadedAt =
      response?.cache
        ?.tahunan
        ?.loadedAt ||
      null

    const triwulananLoadedAt =
      response?.cache
        ?.triwulanan
        ?.loadedAt ||
      null


    /*
     * Ambil semua timestamp valid.
     */

    const dates = [
      tahunanLoadedAt,
      triwulananLoadedAt
    ]
      .filter(Boolean)
      .map(value => {
        return new Date(value)
      })
      .filter(date => {
        return !Number.isNaN(
          date.getTime()
        )
      })


    /*
     * Cache belum tersedia.
     */

    if (dates.length === 0) {
      lastSyncedAt.value = null
      return
    }


    /*
     * Ambil waktu sinkron terbaru.
     */

    const newestTimestamp =
      Math.max(
        ...dates.map(date => {
          return date.getTime()
        })
      )

    lastSyncedAt.value =
      new Date(
        newestTimestamp
      ).toISOString()

  } catch (error) {
    console.error(
      'Gagal mengambil informasi cache:',
      error
    )

    cacheError.value = true

  } finally {
    cacheLoading.value = false
  }
}


/*
|--------------------------------------------------------------------------
| REFRESH STATUS CACHE
|--------------------------------------------------------------------------
|
| Hanya mengecek endpoint metadata cache
| setiap 15 detik.
|
| Ini tidak menarik seluruh data Google Sheets.
|
*/

let cacheInterval = null


onMounted(async () => {
  await loadCacheInfo()

  cacheInterval =
    setInterval(
      loadCacheInfo,
      15000
    )
})


onBeforeUnmount(() => {
  if (cacheInterval) {
    clearInterval(
      cacheInterval
    )

    cacheInterval = null
  }
})
</script>


<template>
  <header
    class="
      sticky top-0 z-30
      border-b border-slate-200/80
      bg-white/95
      backdrop-blur-xl
    "
  >
    <div
      class="
        flex min-h-[88px]
        items-center
        justify-between
        gap-6
        px-6 lg:px-8
      "
    >

      <!-- LEFT -->

      <div class="min-w-0">

        <div
          class="
            flex items-center
            gap-2.5
          "
        >

          <div
            class="
              h-8 w-1
              rounded-full
              bg-blue-600
            "
          ></div>


          <div>

            <h1
              class="
                text-xl
                font-bold
                tracking-tight
                text-slate-900
              "
            >
              Dashboard Analitik
            </h1>


            <p
              class="
                mt-1
                text-xs
                text-slate-400
              "
            >
              Ringkasan dan visualisasi data
              Badan Pusat Statistik
            </p>

          </div>

        </div>

      </div>


      <!-- RIGHT -->

      <div
        class="
          flex shrink-0
          items-center
          gap-3
        "
      >

        <!-- GOOGLE SHEETS -->

        <div
          class="
            hidden
            items-center
            gap-2.5
            rounded-xl
            border
            px-3 py-2
            sm:flex
          "
          :class="
            cacheError
              ? 'border-red-100 bg-red-50/70'
              : 'border-emerald-100 bg-emerald-50/70'
          "
        >

          <!-- ICON -->

          <div
            class="
              flex h-9 w-9
              items-center
              justify-center
              rounded-lg
              bg-white
              shadow-sm
            "
            :class="
              cacheError
                ? 'text-red-500'
                : 'text-emerald-600'
            "
          >
            <Database
              :size="17"
              :stroke-width="1.8"
            />
          </div>


          <div>

            <!-- STATUS -->

            <div
              class="
                flex items-center
                gap-1.5
              "
            >

              <span
                class="
                  h-1.5 w-1.5
                  rounded-full
                "
                :class="
                  cacheError
                    ? 'bg-red-500'
                    : cacheLoading
                      ? 'bg-amber-500'
                      : 'bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]'
                "
              ></span>


              <p
                class="
                  text-[11px]
                  font-semibold
                "
                :class="
                  cacheError
                    ? 'text-red-700'
                    : 'text-emerald-700'
                "
              >
                {{ connectionLabel }}
              </p>

            </div>


            <!-- SOURCE -->

            <p
              class="
                mt-0.5
                text-[10px]
              "
              :class="
                cacheError
                  ? 'text-red-500/70'
                  : 'text-emerald-600/70'
              "
            >
              Google Sheets
            </p>


            <!-- LAST SYNC -->

            <p
              class="
                mt-0.5
                whitespace-nowrap
                text-[9px]
                font-medium
              "
              :class="
                cacheError
                  ? 'text-red-400'
                  : 'text-emerald-700/60'
              "
            >
              {{ syncLabel }}
            </p>

          </div>

        </div>


        <!-- DIVIDER -->

        <div
          class="
            hidden
            h-8 w-px
            bg-slate-200
            sm:block
          "
        ></div>


        <!-- DATE -->

        <div
          class="
            flex
            items-center
            gap-2.5
            rounded-xl
            border
            border-slate-200
            bg-white
            px-3.5
            py-2.5
            shadow-sm
          "
        >

          <div
            class="
              flex h-7 w-7
              items-center
              justify-center
              rounded-lg
              bg-blue-50
            "
          >
            <CalendarDays
              :size="15"
              class="text-blue-600"
            />
          </div>


          <div
            class="
              hidden
              sm:block
            "
          >

            <p
              class="
                text-[9px]
                font-medium
                uppercase
                tracking-wider
                text-slate-400
              "
            >
              Tanggal
            </p>


            <p
              class="
                mt-0.5
                whitespace-nowrap
                text-xs
                font-semibold
                text-slate-600
              "
            >
              {{ currentDate }}
            </p>

          </div>

        </div>

      </div>

    </div>
  </header>
</template>