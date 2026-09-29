<script setup>
import {
  computed
} from 'vue'

import {
  Banknote,
  Trophy
} from 'lucide-vue-next'


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
    new Intl.NumberFormat(
      'id-ID',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ).format(number)

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
</script>


<template>
  <div class="grid gap-4">

    <!--
    |--------------------------------------------------------------------------
    | TOTAL NILAI
    |--------------------------------------------------------------------------
    -->

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
              text-xs
              font-medium
              uppercase
              tracking-wider
              text-slate-400
            "
          >
            Total Nilai
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
            bg-blue-50
            text-blue-600
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
        rounded-2xl
        border border-slate-200
        bg-white
        p-5
        shadow-sm
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
              text-xs
              font-medium
              uppercase
              tracking-wider
              text-slate-400
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
            bg-amber-50
            text-amber-600
          "
        >
          <Trophy
            :size="20"
            :stroke-width="1.8"
          />
        </div>

      </div>
    </div>

  </div>
</template>