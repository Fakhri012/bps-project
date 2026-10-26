<script setup>
import {
  computed
} from 'vue'

import {
  Banknote,
  Trophy,
  BookOpen
} from 'lucide-vue-next'

import {
  formatDisplayNumber
} from '../../utils/displayFormatters.js'


/*
|--------------------------------------------------------------------------
| PROPS
|--------------------------------------------------------------------------
*/

const props = defineProps({
  totalNilai: {
    type: [
      String,
      Number
    ],
    default: null
  },

  kontributor: {
    type: String,
    default: '-'
  },

  metadata: {
    type: Object,
    default: null
  },

  metadataLoading: {
    type: Boolean,
    default: false
  }
})


/*
|--------------------------------------------------------------------------
| PARSE ANGKA
|--------------------------------------------------------------------------
|
| Mendukung:
|
| 847626
| 847626.25
| "847.626,00"
| "1.250.000,50"
|
*/

function parseNumber(value) {
  /*
   * Kalau memang sudah Number,
   * langsung gunakan.
   */
  if (
    typeof value === 'number'
  ) {
    return Number.isFinite(value)
      ? value
      : null
  }


  if (
    value === null ||
    value === undefined ||
    value === '' ||
    value === 'Tidak ada data'
  ) {
    return null
  }


  let text =
    String(value)
      .trim()


  /*
   * Format Indonesia:
   *
   * 847.626,00
   *
   * titik = pemisah ribuan
   * koma  = desimal
   */

  if (
    text.includes(',') &&
    text.includes('.')
  ) {
    text =
      text
        .replace(/\./g, '')
        .replace(',', '.')

  } else if (
    text.includes(',')
  ) {
    /*
     * Contoh:
     * 847626,50
     */

    text =
      text.replace(',', '.')
  }


  const number =
    Number(text)


  return Number.isFinite(number)
    ? number
    : null
}


/*
|--------------------------------------------------------------------------
| FORMAT NILAI + UNIT
|--------------------------------------------------------------------------
*/

function formatCurrencyScale(value) {
  const number =
    parseNumber(value)

  if (
    number === null
  ) {
    return {
      value: 'Tidak ada data',
      unit: 'Belum tersedia'
    }
  }

  const formattedValue =
    formatDisplayNumber(number)

  return {
    value: formattedValue,
    unit: 'Triliun Rupiah'
  }
}


 



/*
|--------------------------------------------------------------------------
| TOTAL NILAI DISPLAY
|--------------------------------------------------------------------------
*/

const totalNilaiDisplay =
  computed(() => {
    return formatCurrencyScale(
      props.totalNilai
    )
  })


/*
|--------------------------------------------------------------------------
| KONTRIBUTOR DISPLAY
|--------------------------------------------------------------------------
*/

const kontributorDisplay =
  computed(() => {
    const value =
      String(
        props.kontributor ?? ''
      ).trim()

    return value || '-'
  })


const metadataValues = computed(() => {
  const metadata = props.metadata || {}
  const concepts = Array.isArray(metadata.konsep)
    ? metadata.konsep.filter(
        concept => concept !== null && String(concept).trim()
      )
    : []
  const reportedConceptCount = Number(metadata.jumlahKonsep)

  return {
    konsep: concepts[0] || '',
    jumlahKonsep: Number.isFinite(reportedConceptCount)
      ? reportedConceptCount
      : concepts.length
  }
})


</script>


<template>
  <div class="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">

    <!--
    |--------------------------------------------------------------------------
    | TOTAL NILAI
    |--------------------------------------------------------------------------
    -->

    <div
      class="
        group relative overflow-hidden rounded-2xl
        border border-slate-200/80 border-t-2 border-t-cyan-500
        bg-gradient-to-br from-white to-cyan-50/40
        p-4 shadow-[0_5px_18px_rgba(15,23,42,0.045)]
        transition duration-200 hover:-translate-y-0.5 hover:shadow-md
      "
    >
      <div
        class="
          flex
          items-start
          justify-between
          gap-4
        "
      >

        <!-- CONTENT -->
        <div class="min-w-0">

          <p
            class="
              text-[10px]
              font-bold
              uppercase
              tracking-[0.12em]
              text-slate-500
            "
          >
            Total EKN
          </p>


          <h3
            class="
              mt-2
              text-xl
              font-bold
              tracking-tight
              text-slate-900
            "
          >
            {{ totalNilaiDisplay.value }}
          </h3>


          <p
            class="
              mt-1
              text-xs
              text-slate-400
            "
          >
            {{ totalNilaiDisplay.unit }}
          </p>

        </div>


        <!-- ICON -->
        <div
          class="
            flex
            h-11
            w-11
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-cyan-100/70
            text-cyan-700
          "
        >
          <Banknote
            :size="20"
            :stroke-width="1.8"
          />
        </div>

      </div>
    </div>


    <!--
    |--------------------------------------------------------------------------
    | KONTRIBUTOR TERBESAR
    |--------------------------------------------------------------------------
    -->

    <div
      class="
        group relative overflow-hidden rounded-2xl
        border border-slate-200/80 border-t-2 border-t-amber-500
        bg-gradient-to-br from-white to-amber-50/40
        p-4 shadow-[0_5px_18px_rgba(15,23,42,0.045)]
        transition duration-200 hover:-translate-y-0.5 hover:shadow-md
      "
    >
      <div
        class="
          flex
          items-start
          justify-between
          gap-4
        "
      >

        <!-- CONTENT -->
        <div class="min-w-0">

          <p
            class="
              text-[10px]
              font-bold
              uppercase
              tracking-[0.12em]
              text-slate-500
            "
          >
            Kontributor Terbesar
          </p>


          <h3
            class="
              mt-2
              break-words
              text-lg
              font-bold
              leading-snug
              text-slate-900
            "
          >
            {{ kontributorDisplay }}
          </h3>


          <p
            class="
              mt-1
              text-xs
              text-slate-400
            "
          >
            Berdasarkan total nilai
          </p>

        </div>


        <!-- ICON -->
        <div
          class="
            flex
            h-11
            w-11
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-amber-100/70
            text-amber-700
          "
        >
          <Trophy
            :size="20"
            :stroke-width="1.8"
          />
        </div>

      </div>
    </div>


    <div
      class="
        group relative min-w-0
        overflow-hidden
        rounded-2xl
        border border-slate-200/80 border-t-2 border-t-emerald-500
        bg-gradient-to-br from-white to-emerald-50/40
        p-4 shadow-[0_5px_18px_rgba(15,23,42,0.045)]
        transition duration-200 hover:-translate-y-0.5 hover:shadow-md
      "
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p
            class="
              text-xs
              font-medium
              uppercase
              tracking-wider
              text-slate-400
            "
          >
            Metadata
          </p>
          <p class="mt-1 text-[10px] text-slate-500">
            Konsep dari data yang sedang ditampilkan
          </p>
        </div>

        <div
          class="
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-lg
            bg-emerald-100/70
            text-emerald-700
          "
        >
          <BookOpen :size="17" :stroke-width="1.8" />
        </div>
      </div>

      <p
        v-if="metadataLoading"
        class="mt-4 flex items-center gap-2 text-xs text-slate-500"
        role="status"
      >
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></span>
        Memuat metadata sesuai filter...
      </p>

      <div v-else class="mt-4">
        <p
          v-if="metadataValues.jumlahKonsep > 1"
          class="
            rounded-lg
            border border-amber-100
            bg-amber-50/70
            px-3
            py-2.5
            text-xs
            leading-5
            text-slate-500
          "
        >
          Ada {{ formatDisplayNumber(metadataValues.jumlahKonsep) }} konsep berbeda pada filter ini. Persempit filter untuk menampilkan satu konsep.
        </p>

        <p
          v-else-if="!metadataValues.konsep"
          class="
            rounded-lg
            border border-slate-200/70
            bg-slate-50/80
            px-3
            py-2.5
            text-xs
            leading-5
            text-slate-500
          "
        >
          Metadata konsep belum tersedia.
        </p>

        <div v-else>
          <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Konsep
          </p>
          <p
            class="
              mt-1.5
              max-h-32
              overflow-y-auto
              break-words
              rounded-lg
              border border-emerald-100/80
              bg-white/80
              px-3
              py-2.5
              text-xs
              leading-5
              text-slate-700
            "
          >
            {{ metadataValues.konsep }}
          </p>
        </div>
      </div>
    </div>

  </div>
</template>