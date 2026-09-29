<script setup>
import {
  computed,
  ref,
  watch
} from 'vue'

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  TableProperties,
  Wallet,
  Database
} from 'lucide-vue-next'


/*
|--------------------------------------------------------------------------
| PROPS
|--------------------------------------------------------------------------
*/

const props = defineProps({
  rows: {
    type: Array,
    default: () => []
  },

  loading: {
    type: Boolean,
    default: false
  },

  pagination: {
    type: Object,

    default: () => ({
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
      from: 0,
      to: 0
    })
  }
})


const emit = defineEmits([
  'page-change',
  'limit-change'
])


/*
|--------------------------------------------------------------------------
| HELPER ANGKA
|--------------------------------------------------------------------------
*/

function toNumber(value) {
  const number =
    Number(value)

  return Number.isFinite(number)
    ? number
    : 0
}


function formatNilai(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—'
  }

  const number =
    Number(value)

  if (!Number.isFinite(number)) {
    return String(value)
  }

  return new Intl.NumberFormat(
    'id-ID',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(number)
}


function formatTotal(value) {
  return new Intl.NumberFormat(
    'id-ID'
  ).format(
    Number(value) || 0
  )
}


/*
|--------------------------------------------------------------------------
| TOTAL NILAI HALAMAN
|--------------------------------------------------------------------------
*/

const totalNilaiHalaman =
  computed(() => {
    return props.rows.reduce(
      (sum, item) =>
        sum +
        toNumber(item.nilai),

      0
    )
  })


/*
|--------------------------------------------------------------------------
| PERIODE
|--------------------------------------------------------------------------
*/

function getPeriode(item) {
  if (item.periode) {
    return item.periode
  }

  return (
    item.tahun ??
    '—'
  )
}


/*
|--------------------------------------------------------------------------
| THEME SISI
|--------------------------------------------------------------------------
|
| Data kita:
|
| PENGGUNAAN
| SUMBER
|
*/

function getSisiTheme(value) {
  const sisi =
    String(
      value ?? ''
    )
      .trim()
      .toUpperCase()

  if (
    sisi ===
    'PENGGUNAAN'
  ) {
    return {
      badge:
        'border-blue-100 bg-blue-50 text-blue-700',

      accent:
        'before:bg-blue-500'
    }
  }


  if (
    sisi ===
    'SUMBER'
  ) {
    return {
      badge:
        'border-emerald-100 bg-emerald-50 text-emerald-700',

      accent:
        'before:bg-emerald-500'
    }
  }


  return {
    badge:
      'border-slate-200 bg-slate-50 text-slate-600',

    accent:
      'before:bg-slate-300'
  }
}


/*
|--------------------------------------------------------------------------
| AVATAR INSTITUSI
|--------------------------------------------------------------------------
*/

const avatarPalette = [
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
  'bg-cyan-100 text-cyan-700'
]


function getAvatarColor(label) {
  const text =
    String(label || '')

  let sum = 0

  for (
    let i = 0;
    i < text.length;
    i++
  ) {
    sum +=
      text.charCodeAt(i)
  }

  return avatarPalette[
    sum %
    avatarPalette.length
  ]
}


function getInitial(label) {
  const text =
    String(label || '')
      .trim()

  if (!text) {
    return '—'
  }

  /*
   * Kalau ada beberapa kata:
   *
   * Korporasi Finansial
   * -> KF
   */

  const words =
    text
      .split(/\s+/)
      .filter(Boolean)

  if (
    words.length >= 2
  ) {
    return (
      words[0][0] +
      words[1][0]
    ).toUpperCase()
  }

  return text
    .substring(0, 2)
    .toUpperCase()
}


/*
|--------------------------------------------------------------------------
| NOMOR BARIS
|--------------------------------------------------------------------------
*/

function rowNumber(index) {
  return (
    (
      props.pagination.page -
      1
    ) *
      props.pagination.limit +

    index +

    1
  )
}


/*
|--------------------------------------------------------------------------
| SKELETON
|--------------------------------------------------------------------------
*/

const skeletonRows =
  computed(() => {
    return Array.from(
      {
        length:
          Math.min(
            props.pagination.limit ||
              8,

            8
          )
      },

      (_, i) => i
    )
  })


/*
|--------------------------------------------------------------------------
| LIMIT
|--------------------------------------------------------------------------
*/

const limitOptions = [
  25,
  50,
  100
]

/*
|--------------------------------------------------------------------------
| INPUT LOMPAT HALAMAN
|--------------------------------------------------------------------------
*/

const pageInput =
  ref(
    String(
      props.pagination.page || 1
    )
  )


/*
 * Kalau halaman berubah melalui
 * tombol pagination, input ikut berubah.
 */

watch(
  () =>
    props.pagination.page,

  (newPage) => {
    pageInput.value =
      String(
        newPage || 1
      )
  }
)


function jumpToPage() {
  const totalPages =
    Number(
      props.pagination
        .totalPages
    ) || 0

  let page =
    Number(
      pageInput.value
    )


  /*
   * Input tidak valid.
   */

  if (
    !Number.isFinite(page) ||
    totalPages <= 0
  ) {
    pageInput.value =
      String(
        props.pagination.page ||
        1
      )

    return
  }


  /*
   * Hanya bilangan bulat.
   */

  page =
    Math.floor(page)


  /*
   * Jangan boleh < 1.
   */

  if (page < 1) {
    page = 1
  }


  /*
   * Jangan boleh melebihi
   * halaman terakhir.
   */

  if (
    page > totalPages
  ) {
    page =
      totalPages
  }


  pageInput.value =
    String(page)


  goToPage(page)
}

/*
|--------------------------------------------------------------------------
| PAGINATION
|--------------------------------------------------------------------------
*/

function goToPage(page) {
  if (
    page < 1 ||
    page >
      props.pagination
        .totalPages ||
    page ===
      props.pagination.page
  ) {
    return
  }

  emit(
    'page-change',
    page
  )
}


function previousPage() {
  goToPage(
    props.pagination.page -
      1
  )
}


function nextPage() {
  goToPage(
    props.pagination.page +
      1
  )
}


/*
|--------------------------------------------------------------------------
| NOMOR HALAMAN
|--------------------------------------------------------------------------
*/

const pageNumbers =
  computed(() => {
    const total =
      props.pagination
        .totalPages || 0

    const current =
      props.pagination.page ||
      1


    if (total <= 0) {
      return []
    }


    const delta = 1

    const range = []


    const start =
      Math.max(
        2,
        current - delta
      )


    const end =
      Math.min(
        total - 1,
        current + delta
      )


    range.push(1)


    if (start > 2) {
      range.push('...')
    }


    for (
      let page = start;
      page <= end;
      page++
    ) {
      range.push(page)
    }


    if (
      end <
      total - 1
    ) {
      range.push('...')
    }


    if (
      total > 1
    ) {
      range.push(total)
    }


    return range
  })


/*
|--------------------------------------------------------------------------
| NILAI STYLE
|--------------------------------------------------------------------------
*/

function getNilaiClass(value) {
  const nilai =
    Number(value)

  if (
    !Number.isFinite(nilai)
  ) {
    return 'text-slate-400'
  }

  if (nilai < 0) {
    return 'text-rose-600'
  }

  return 'text-slate-800'
}
</script>


<template>
  <div
    class="
      overflow-hidden
      rounded-[20px]
      border
      border-slate-200/80
      bg-white
      shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.03)]
    "
  >

    <!-- =====================================================
         HEADER
    ====================================================== -->
    <div
      class="
        flex
        flex-col
        gap-4
        border-b
        border-slate-100
        bg-gradient-to-r
        from-white
        via-white
        to-slate-50/70
        px-6
        py-5
        lg:flex-row
        lg:items-center
        lg:justify-between
      "
    >
      <!-- TITLE -->
      <div
        class="
          flex
          items-center
          gap-3.5
        "
      >
        <div
          class="
            flex
            h-11
            w-11
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-blue-600
            text-white
            shadow-md
            shadow-blue-200/60
          "
        >
          <TableProperties
            :size="19"
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
            <h3
              class="
                text-[15px]
                font-bold
                tracking-tight
                text-slate-900
              "
            >
              Data Asset
            </h3>

            <span
              class="
                rounded-full
                border
                border-blue-100
                bg-blue-50
                px-2
                py-0.5
                text-[9px]
                font-bold
                uppercase
                tracking-wider
                text-blue-600
              "
            >
              Detail
            </span>
          </div>


          <p
            class="
              mt-1
              text-xs
              leading-5
              text-slate-400
            "
          >
            Menampilkan

            <span
              class="
                font-semibold
                text-slate-600
              "
            >
              {{ pagination.from }}
            </span>

            –

            <span
              class="
                font-semibold
                text-slate-600
              "
            >
              {{ pagination.to }}
            </span>

            dari

            <span
              class="
                font-semibold
                text-slate-600
              "
            >
              {{
                formatTotal(
                  pagination.total
                )
              }}
            </span>

            data
          </p>
        </div>
      </div>


      <!-- LIMIT -->
      <div
        class="
          flex
          items-center
          gap-3
        "
      >
        <span
          class="
            hidden
            text-xs
            font-medium
            text-slate-400
            sm:block
          "
        >
          Baris per halaman
        </span>


        <div
          class="
            inline-flex
            rounded-xl
            border
            border-slate-200
            bg-slate-100/70
            p-1
          "
        >
          <button
            v-for="
              opt in limitOptions
            "
            :key="opt"
            type="button"
            class="
              min-w-[46px]
              rounded-lg
              px-3
              py-2
              text-xs
              font-bold
              transition-all
              duration-200
            "
            :class="
              pagination.limit ===
              opt

                ? `
                    bg-white
                    text-blue-600
                    shadow-sm
                    ring-1
                    ring-slate-200/60
                  `

                : `
                    text-slate-400
                    hover:text-slate-700
                  `
            "
            @click="
              emit(
                'limit-change',
                opt
              )
            "
          >
            {{ opt }}
          </button>
        </div>
      </div>
    </div>


    <!-- =====================================================
         LOADING SKELETON
    ====================================================== -->
    <div
      v-if="loading"
      class="
        overflow-x-auto
      "
    >
      <table
        class="
          min-w-[1050px]
          w-full
          border-collapse
        "
      >
        <thead>
          <tr
            class="
              border-b
              border-slate-200
              bg-slate-50/90
            "
          >
            <th
              v-for="
                col in [
                  'No',
                  'Periode',
                  'Institusi',
                  'Klasifikasi',
                  'Detail',
                  'Nilai'
                ]
              "
              :key="col"
              class="
                px-5
                py-3.5
                text-left
                text-[10px]
                font-bold
                uppercase
                tracking-[0.08em]
                text-slate-400
              "
            >
              {{ col }}
            </th>
          </tr>
        </thead>


        <tbody>
          <tr
            v-for="
              n in skeletonRows
            "
            :key="n"
            class="
              border-b
              border-slate-100
            "
          >
            <td
              v-for="
                c in 6
              "
              :key="c"
              class="
                px-5
                py-5
              "
            >
              <div
                class="
                  h-3.5
                  animate-pulse
                  rounded-full
                  bg-slate-100
                "
                :style="{
                  width:
                    c === 1
                      ? '18px'
                      : c === 5
                        ? '88%'
                        : '65%'
                }"
              ></div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>


    <!-- =====================================================
         TABLE
    ====================================================== -->
    <div
      v-else-if="
        rows.length > 0
      "
      class="
        max-h-[680px]
        overflow-auto
      "
    >
      <table
        class="
          min-w-[1080px]
          w-full
          border-separate
          border-spacing-0
        "
      >

        <!-- TABLE HEAD -->
        <thead
          class="
            sticky
            top-0
            z-20
          "
        >
          <tr>

            <th
              class="
                w-[64px]
                border-b
                border-slate-200
                bg-slate-50/95
                py-3.5
                pl-6
                pr-4
                text-left
                text-[10px]
                font-extrabold
                uppercase
                tracking-[0.09em]
                text-slate-400
                backdrop-blur
              "
            >
              No
            </th>


            <th
              class="
                min-w-[115px]
                border-b
                border-slate-200
                bg-slate-50/95
                px-4
                py-3.5
                text-left
                text-[10px]
                font-extrabold
                uppercase
                tracking-[0.09em]
                text-slate-400
                backdrop-blur
              "
            >
              Periode
            </th>


            <th
              class="
                min-w-[210px]
                border-b
                border-slate-200
                bg-slate-50/95
                px-4
                py-3.5
                text-left
                text-[10px]
                font-extrabold
                uppercase
                tracking-[0.09em]
                text-slate-400
                backdrop-blur
              "
            >
              Institusi
            </th>


            <th
              class="
                min-w-[270px]
                border-b
                border-slate-200
                bg-slate-50/95
                px-4
                py-3.5
                text-left
                text-[10px]
                font-extrabold
                uppercase
                tracking-[0.09em]
                text-slate-400
                backdrop-blur
              "
            >
              Klasifikasi
            </th>


            <th
              class="
                min-w-[330px]
                border-b
                border-slate-200
                bg-slate-50/95
                px-4
                py-3.5
                text-left
                text-[10px]
                font-extrabold
                uppercase
                tracking-[0.09em]
                text-slate-400
                backdrop-blur
              "
            >
              Detail
            </th>


            <th
              class="
                min-w-[160px]
                border-b
                border-slate-200
                bg-slate-50/95
                py-3.5
                pl-4
                pr-6
                text-right
                text-[10px]
                font-extrabold
                uppercase
                tracking-[0.09em]
                text-slate-400
                backdrop-blur
              "
            >
              Nilai
            </th>

          </tr>
        </thead>


        <!-- TABLE BODY -->
        <tbody>
          <tr
            v-for="
              (item, index)
              in rows
            "
            :key="
              `${item.sektor}-${item.periode || item.tahun}-${item.kode}-${index}`
            "
            class="
              group
              relative
              bg-white
              transition-all
              duration-150
              even:bg-slate-50/30
              hover:bg-blue-50/40
            "
          >

            <!-- NOMOR -->
            <td
              class="
                relative
                py-4
                pl-6
                pr-4
                align-top
                text-xs
                font-medium
                text-slate-400

                before:absolute
                before:inset-y-2
                before:left-0
                before:w-[3px]
                before:rounded-r-full
                before:content-['']
              "
              :class="
                getSisiTheme(
                  item.sisi
                ).accent
              "
            >
              {{
                rowNumber(
                  index
                )
              }}
            </td>


            <!-- PERIODE -->
            <td
              class="
                px-4
                py-4
                align-top
              "
            >
              <span
                class="
                  inline-flex
                  whitespace-nowrap
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  px-2.5
                  py-1.5
                  text-[11px]
                  font-bold
                  text-slate-700
                  shadow-sm
                "
              >
                {{
                  getPeriode(
                    item
                  )
                }}
              </span>
            </td>


            <!-- INSTITUSI -->
            <td
              class="
                px-4
                py-4
                align-top
              "
            >
              <div
                class="
                  flex
                  items-start
                  gap-3
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
                    rounded-xl
                    text-[10px]
                    font-extrabold
                    shadow-sm
                  "
                  :class="
                    getAvatarColor(
                      item.institusi ||
                      item.sektor
                    )
                  "
                >
                  {{
                    getInitial(
                      item.institusi ||
                      item.sektor
                    )
                  }}
                </div>


                <div
                  class="
                    min-w-0
                  "
                >
                  <p
                    class="
                      whitespace-normal
                      break-words
                      text-xs
                      font-bold
                      leading-5
                      text-slate-700
                    "
                  >
                    {{
                      item.institusi ||
                      item.sektor ||
                      '—'
                    }}
                  </p>


                  <span
                    v-if="
                      item.sektor
                    "
                    class="
                      mt-1
                      inline-flex
                      rounded-md
                      bg-slate-100
                      px-1.5
                      py-0.5
                      text-[9px]
                      font-bold
                      uppercase
                      tracking-wide
                      text-slate-400
                    "
                  >
                    {{ item.sektor }}
                  </span>
                </div>
              </div>
            </td>


            <!-- KLASIFIKASI -->
            <td
              class="
                px-4
                py-4
                align-top
              "
            >
              <span
                class="
                  inline-flex
                  rounded-full
                  border
                  px-2.5
                  py-1
                  text-[9px]
                  font-extrabold
                  uppercase
                  tracking-[0.05em]
                "
                :class="
                  getSisiTheme(
                    item.sisi
                  ).badge
                "
              >
                {{
                  item.sisi ||
                  '—'
                }}
              </span>


              <p
                class="
                  mt-2
                  whitespace-normal
                  break-words
                  text-xs
                  font-medium
                  leading-5
                  text-slate-600
                "
              >
                {{
                  item.jenisNeraca ||
                  '—'
                }}
              </p>
            </td>


            <!-- DETAIL -->
            <td
              class="
                px-4
                py-4
                align-top
              "
            >
              <div
                class="
                  flex
                  items-start
                  gap-2.5
                "
              >
                <span
                  class="
                    mt-0.5
                    shrink-0
                    rounded-md
                    border
                    border-slate-200
                    bg-slate-50
                    px-2
                    py-1
                    font-mono
                    text-[10px]
                    font-bold
                    text-slate-500
                  "
                >
                  {{
                    item.kode ||
                    '—'
                  }}
                </span>


                <p
                  class="
                    whitespace-normal
                    break-words
                    text-xs
                    leading-5
                    text-slate-600
                  "
                >
                  {{
                    item.rincian ||
                    '—'
                  }}
                </p>
              </div>
            </td>


            <!-- NILAI -->
            <td
              class="
                py-4
                pl-4
                pr-6
                text-right
                align-top
              "
            >
              <div
                class="
                  inline-flex
                  min-w-[120px]
                  justify-end
                  rounded-lg
                  bg-slate-50
                  px-3
                  py-2
                "
              >
                <span
                  class="
                    whitespace-nowrap
                    font-mono
                    text-xs
                    font-extrabold
                    tabular-nums
                  "
                  :class="
                    getNilaiClass(
                      item.nilai
                    )
                  "
                >
                  {{
                    formatNilai(
                      item.nilai
                    )
                  }}
                </span>
              </div>
            </td>

          </tr>
        </tbody>


        <!-- TOTAL -->
        <tfoot>
          <tr
            class="
              bg-slate-50/90
            "
          >
            <td
              colspan="5"
              class="
                border-t
                border-slate-200
                py-3.5
                pl-6
                pr-4
              "
            >
              <div
                class="
                  flex
                  items-center
                  gap-2
                "
              >
                <div
                  class="
                    flex
                    h-7
                    w-7
                    items-center
                    justify-center
                    rounded-lg
                    bg-white
                    text-slate-400
                    shadow-sm
                    ring-1
                    ring-slate-200
                  "
                >
                  <Wallet
                    :size="13"
                  />
                </div>

                <div>
                  <p
                    class="
                      text-xs
                      font-bold
                      text-slate-600
                    "
                  >
                    Total nilai halaman ini
                  </p>

                  <p
                    class="
                      text-[9px]
                      text-slate-400
                    "
                  >
                    Berdasarkan data pada halaman aktif
                  </p>
                </div>
              </div>
            </td>


            <td
              class="
                border-t
                border-slate-200
                py-3.5
                pl-4
                pr-6
                text-right
              "
            >
              <span
                class="
                  whitespace-nowrap
                  font-mono
                  text-xs
                  font-extrabold
                  tabular-nums
                  text-slate-900
                "
              >
                {{
                  formatNilai(
                    totalNilaiHalaman
                  )
                }}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>


    <!-- =====================================================
         EMPTY STATE
    ====================================================== -->
    <div
      v-else
      class="
        flex
        min-h-[380px]
        items-center
        justify-center
        px-6
      "
    >
      <div
        class="
          max-w-sm
          text-center
        "
      >
        <div
          class="
            relative
            mx-auto
            flex
            h-16
            w-16
            items-center
            justify-center
            rounded-2xl
            bg-slate-50
            text-slate-300
            ring-1
            ring-slate-100
          "
        >
          <Database
            :size="25"
          />

          <div
            class="
              absolute
              -bottom-1
              -right-1
              flex
              h-6
              w-6
              items-center
              justify-center
              rounded-lg
              bg-white
              shadow-sm
              ring-1
              ring-slate-100
            "
          >
            <Inbox
              :size="12"
            />
          </div>
        </div>


        <h4
          class="
            mt-5
            text-sm
            font-bold
            text-slate-700
          "
        >
          Data tidak ditemukan
        </h4>


        <p
          class="
            mx-auto
            mt-1.5
            max-w-[280px]
            text-xs
            leading-5
            text-slate-400
          "
        >
          Tidak ada data yang sesuai dengan kombinasi filter atau kata pencarian saat ini.
        </p>
      </div>
    </div>


    <!-- =====================================================
         PAGINATION
    ====================================================== -->
    <div
      v-if="
        !loading &&
        rows.length > 0
      "
      class="
        flex
        flex-col
        gap-4
        border-t
        border-slate-100
        bg-white
        px-6
        py-4
        md:flex-row
        md:items-center
        md:justify-between
      "
    >
<div
  class="
    flex
    flex-wrap
    items-center
    gap-x-5
    gap-y-3
  "
>
  <!-- INFO HALAMAN -->
  <p
    class="
      whitespace-nowrap
      text-xs
      text-slate-400
    "
  >
    Halaman

    <span
      class="
        font-bold
        text-slate-700
      "
    >
      {{ pagination.page }}
    </span>

    dari

    <span
      class="
        font-bold
        text-slate-700
      "
    >
      {{
        pagination.totalPages ||
        0
      }}
    </span>
  </p>


  <!-- LOMPAT HALAMAN -->
  <div
    class="
      flex
      items-center
      gap-2
    "
  >
    <span
      class="
        whitespace-nowrap
        text-xs
        font-medium
        text-slate-400
      "
    >
      Ke halaman
    </span>


    <div
      class="
        flex
        items-center
        overflow-hidden
        rounded-lg
        border
        border-slate-200
        bg-white
        transition
        focus-within:border-blue-400
        focus-within:ring-2
        focus-within:ring-blue-100
      "
    >
      <input
        v-model="pageInput"
        type="number"
        min="1"
        :max="
          pagination.totalPages
        "
        inputmode="numeric"
        class="
          h-9
          w-16
          border-0
          bg-transparent
          px-2
          text-center
          text-xs
          font-bold
          text-slate-700
          outline-none
        "
        @keyup.enter.prevent="
          jumpToPage
        "
      />


      <button
        type="button"
        class="
          h-9
          border-l
          border-slate-200
          bg-slate-50
          px-3
          text-[10px]
          font-bold
          text-blue-600
          transition
          hover:bg-blue-50
        "
        @click="
          jumpToPage
        "
      >
        Buka
      </button>
    </div>
  </div>
</div>


      <!-- PAGE CONTROL -->
      <div
        class="
          flex
          flex-wrap
          items-center
          gap-1
        "
      >
        <!-- FIRST -->
        <button
          type="button"
          aria-label="Halaman pertama"
          :disabled="
            pagination.page <= 1
          "
          class="
            inline-flex
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            border
            border-slate-200
            bg-white
            text-slate-400
            transition
            hover:border-blue-200
            hover:bg-blue-50
            hover:text-blue-600
            disabled:cursor-not-allowed
            disabled:opacity-30
          "
          @click="
            goToPage(1)
          "
        >
          <ChevronsLeft
            :size="15"
          />
        </button>


        <!-- PREVIOUS -->
        <button
          type="button"
          aria-label="Halaman sebelumnya"
          :disabled="
            pagination.page <= 1
          "
          class="
            inline-flex
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            border
            border-slate-200
            bg-white
            text-slate-500
            transition
            hover:border-blue-200
            hover:bg-blue-50
            hover:text-blue-600
            disabled:cursor-not-allowed
            disabled:opacity-30
          "
          @click="
            previousPage
          "
        >
          <ChevronLeft
            :size="15"
          />
        </button>


        <!-- PAGE -->
        <template
          v-for="
            (p, i)
            in pageNumbers
          "
          :key="
            `${p}-${i}`
          "
        >
          <span
            v-if="
              p === '...'
            "
            class="
              px-2
              text-xs
              text-slate-300
            "
          >
            •••
          </span>


          <button
            v-else
            type="button"
            class="
              inline-flex
              h-9
              min-w-[36px]
              items-center
              justify-center
              rounded-lg
              px-2
              text-xs
              font-bold
              transition-all
            "
            :class="
              p ===
              pagination.page

                ? `
                    bg-blue-600
                    text-white
                    shadow-sm
                    shadow-blue-200
                  `

                : `
                    text-slate-500
                    hover:bg-slate-100
                    hover:text-slate-700
                  `
            "
            @click="
              goToPage(p)
            "
          >
            {{ p }}
          </button>
        </template>


        <!-- NEXT -->
        <button
          type="button"
          aria-label="Halaman berikutnya"
          :disabled="
            pagination.page >=
              pagination.totalPages ||
            pagination.totalPages ===
              0
          "
          class="
            inline-flex
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            border
            border-slate-200
            bg-white
            text-slate-500
            transition
            hover:border-blue-200
            hover:bg-blue-50
            hover:text-blue-600
            disabled:cursor-not-allowed
            disabled:opacity-30
          "
          @click="
            nextPage
          "
        >
          <ChevronRight
            :size="15"
          />
        </button>


        <!-- LAST -->
        <button
          type="button"
          aria-label="Halaman terakhir"
          :disabled="
            pagination.page >=
              pagination.totalPages ||
            pagination.totalPages ===
              0
          "
          class="
            inline-flex
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            border
            border-slate-200
            bg-white
            text-slate-400
            transition
            hover:border-blue-200
            hover:bg-blue-50
            hover:text-blue-600
            disabled:cursor-not-allowed
            disabled:opacity-30
          "
          @click="
            goToPage(
              pagination.totalPages
            )
          "
        >
          <ChevronsRight
            :size="15"
          />
        </button>
      </div>
    </div>
  </div>
</template>