<script setup>
import {
  computed
} from 'vue'

const props =
  defineProps({
    filters: {
      type: Object,

      default: () => ({
        tahun: [],
        triwulan: [],
        sisi: [],
        neraca: [],
        klasifikasi: [],
        institusi: [],

        allFilters: {
          tahun: true,
          triwulan: true,
          sisi: true,
          neraca: true,
          klasifikasi: true,
          institusi: true
        }
      })
    }
  })

const emit =
  defineEmits([
    'reset'
  ])

/* =========================
   HELPER
========================= */

function toArray(value) {
  if (
    Array.isArray(value)
  ) {
    return value
  }

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return []
  }

  return [
    value
  ]
}

function getOptionValue(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return ''
  }

  if (
    typeof value === 'object'
  ) {
    if (
      value.value !== undefined &&
      value.value !== null
    ) {
      return String(
        value.value
      ).trim()
    }

    if (
      value.label !== undefined &&
      value.label !== null
    ) {
      return String(
        value.label
      ).trim()
    }

    if (
      value.name !== undefined &&
      value.name !== null
    ) {
      return String(
        value.name
      ).trim()
    }
  }

  return String(
    value
  ).trim()
}

function formatList(
  items
) {
  const values =
    toArray(items)
      .map(
        getOptionValue
      )
      .filter(Boolean)

  if (
    values.length === 0
  ) {
    return ''
  }

  if (
    values.length === 1
  ) {
    return values[0]
  }

  if (
    values.length === 2
  ) {
    return `${values[0]} dan ${values[1]}`
  }

  return (
    values
      .slice(
        0,
        -1
      )
      .join(', ')
    +
    ', dan '
    +
    values[
      values.length - 1
    ]
  )
}

/* =========================
   NAMA INSTITUSI
========================= */

const institusiNames = {
  FC:
    'Korporasi Finansial',

  NFC:
    'Korporasi Nonfinansial',

  HH:
    'Rumah Tangga',

  GG:
    'Pemerintah Umum',

  NPISHS:
    'LNPRT',

  ROW:
    'Luar Negeri'
}

const formattedInstitusi =
  computed(() => {

    const values =
      toArray(
        props.filters.institusi
      )

    if (
      values.length === 0
    ) {
      return []
    }

    return values.map(
      value => {

        const code =
          getOptionValue(
            value
          )

        return (
          institusiNames[
            code
          ]
          ||
          code
        )
      }
    )
  })

/* =========================
   FORMAT TRIWULAN
========================= */

function formatTriwulan(
  value
) {
  const raw =
    getOptionValue(
      value
    )

  return raw
    .toUpperCase()
    .startsWith('Q')
    ? raw.toUpperCase()
    : `Q${raw}`
}

/* =========================
   DESKRIPSI
========================= */

const description =
  computed(() => {

    const filters =
      props.filters

    const tahun =
      toArray(
        filters.tahun
      )

    const triwulan =
      toArray(
        filters.triwulan
      )

    const sisi =
      toArray(
        filters.sisi
      )

    const neraca =
      toArray(
        filters.neraca
      )

    const klasifikasi =
      toArray(
        filters.klasifikasi
      )

    /*
     * Status "semua" dikirim
     * langsung dari TimeSeriesFilter.
     */
    const allFilters =
      filters.allFilters ||
      {}

    const semuaTahun =
      allFilters.tahun === true

    const semuaTriwulan =
      allFilters.triwulan === true

    const semuaJenis =
      allFilters.sisi === true

    const semuaNeraca =
      allFilters.neraca === true

    const semuaKlasifikasi =
      allFilters.klasifikasi === true

    const semuaInstitusi =
      allFilters.institusi === true

    /* =========================
       TAHUN
    ========================= */

    let tahunText = ''

    if (
      semuaTahun
    ) {

      tahunText =
        'semua tahun'

    } else {

      tahunText =
        `tahun ${formatList(
          tahun
        )}`
    }

    /* =========================
       TRIWULAN
    ========================= */

    let triwulanText = ''

    if (
      semuaTriwulan
    ) {

      triwulanText =
        'semua triwulan'

    } else {

      triwulanText =
        `triwulan ${formatList(
          triwulan.map(
            formatTriwulan
          )
        )}`
    }

    /* =========================
       PERIODE
    ========================= */

    let periode = ''

    if (
      semuaTahun &&
      semuaTriwulan
    ) {

      periode =
        'semua tahun dan semua triwulan'

    } else if (
      semuaTahun
    ) {

      periode =
        `semua tahun pada ${triwulanText}`

    } else if (
      semuaTriwulan
    ) {

      periode =
        `${tahunText} pada semua triwulan`

    } else {

      periode =
        `${tahunText} pada ${triwulanText}`
    }

    /* =========================
       JENIS
    ========================= */

    let jenisText = ''

    if (
      semuaJenis
    ) {

      jenisText =
        'semua jenis'

    } else {

      jenisText =
        `jenis ${formatList(
          sisi
        )}`
    }

    /* =========================
       NERACA
    ========================= */

    let neracaText = ''

    if (
      semuaNeraca
    ) {

      neracaText =
        'semua neraca'

    } else {

      neracaText =
        `neraca ${formatList(
          neraca
        )}`
    }

    /* =========================
       KLASIFIKASI
    ========================= */

    let klasifikasiText = ''

    if (
      semuaKlasifikasi
    ) {

      klasifikasiText =
        'semua klasifikasi'

    } else {

      klasifikasiText =
        `klasifikasi ${formatList(
          klasifikasi
        )}`
    }

    /* =========================
       INSTITUSI
    ========================= */

    let institusiText = ''

    if (
      semuaInstitusi
    ) {

      institusiText =
        'semua sektor'

    } else {

      institusiText =
        `sektor ${formatList(
          formattedInstitusi.value
        )}`
    }

    /* =========================
       HASIL AKHIR
    ========================= */

    return (
      `Menampilkan data neraca sektoral untuk ${periode}, dengan ${jenisText}, pada ${neracaText}, dengan ${klasifikasiText}, dan mencakup ${institusiText}.`
    )
  })

/* =========================
   RESET
========================= */

function resetFilters() {
  emit(
    'reset'
  )
}
</script>

<template>
  <section
    class="
      rounded-2xl
      border
      border-slate-200
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
      <div>
        <h2
          class="
            text-base
            font-bold
            text-slate-900
          "
        >
          Time Series Neraca Sektoral
        </h2>

        <p
          class="
            mt-1.5
            text-xs
            leading-5
            text-slate-500
          "
        >
          {{ description }}
        </p>
      </div>

      <button
        type="button"
        class="
          shrink-0
          rounded-lg
          px-2.5
          py-1.5
          text-[10px]
          font-semibold
          text-slate-400
          transition
          hover:bg-red-50
          hover:text-red-600
        "
        @click="resetFilters"
      >
        Hapus semua filter
      </button>
    </div>
  </section>
</template>