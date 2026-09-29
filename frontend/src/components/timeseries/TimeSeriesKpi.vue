<script setup>
import {
  computed
} from 'vue'

import {
  CalendarRange,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-vue-next'


/*
|--------------------------------------------------------------------------
| PROPS
|--------------------------------------------------------------------------
*/

const props =
  defineProps({
    annualData: {
      type: Array,
      default: () => []
    },

    quarterlyData: {
      type: Array,
      default: () => []
    }
  })


/*
|--------------------------------------------------------------------------
| FORMAT VALUE
|--------------------------------------------------------------------------
*/

function formatValue(
  value
) {
  const number =
    Number(value)

  if (
    !Number.isFinite(number)
  ) {
    return '—'
  }

  return new Intl.NumberFormat(
    'id-ID',
    {
      maximumFractionDigits: 2
    }
  ).format(number)
}


/*
|--------------------------------------------------------------------------
| FORMAT PERCENT
|--------------------------------------------------------------------------
*/

function formatPercent(
  value
) {
  const number =
    Number(value)

  if (
    !Number.isFinite(number)
  ) {
    return '—'
  }

  const sign =
    number > 0
      ? '+'
      : ''

  return `${sign}${new Intl.NumberFormat(
    'id-ID',
    {
      maximumFractionDigits: 2
    }
  ).format(number)}%`
}


/*
|--------------------------------------------------------------------------
| SORT TAHUNAN
|--------------------------------------------------------------------------
*/

const sortedAnnual =
  computed(() => {
    return [
      ...props.annualData
    ].sort(
      (a, b) =>
        Number(a.tahun) -
        Number(b.tahun)
    )
  })


/*
|--------------------------------------------------------------------------
| SORT TRIWULANAN
|--------------------------------------------------------------------------
*/

const sortedQuarterly =
  computed(() => {
    return [
      ...props.quarterlyData
    ].sort(
      (a, b) => {
        const tahunDiff =
          Number(a.tahun) -
          Number(b.tahun)

        if (
          tahunDiff !== 0
        ) {
          return tahunDiff
        }

        return (
          Number(a.triwulan) -
          Number(b.triwulan)
        )
      }
    )
  })


/*
|--------------------------------------------------------------------------
| TAHUNAN TERBARU
|--------------------------------------------------------------------------
*/

const latestAnnual =
  computed(() => {
    const rows =
      sortedAnnual.value

    return (
      rows[
        rows.length - 1
      ] || null
    )
  })


const previousAnnual =
  computed(() => {
    const rows =
      sortedAnnual.value

    return (
      rows[
        rows.length - 2
      ] || null
    )
  })


/*
|--------------------------------------------------------------------------
| TRIWULANAN TERBARU
|--------------------------------------------------------------------------
*/

const latestQuarterly =
  computed(() => {
    const rows =
      sortedQuarterly.value

    return (
      rows[
        rows.length - 1
      ] || null
    )
  })


const previousQuarterly =
  computed(() => {
    const rows =
      sortedQuarterly.value

    return (
      rows[
        rows.length - 2
      ] || null
    )
  })


/*
|--------------------------------------------------------------------------
| GROWTH
|--------------------------------------------------------------------------
*/

function calculateGrowth(
  latest,
  previous
) {
  const current =
    Number(
      latest?.nilai
    )

  const before =
    Number(
      previous?.nilai
    )


  if (
    !Number.isFinite(current) ||
    !Number.isFinite(before) ||
    before === 0
  ) {
    return null
  }


  return (
    (
      current -
      before
    ) /
    Math.abs(before)
  ) * 100
}


const annualGrowth =
  computed(() =>
    calculateGrowth(
      latestAnnual.value,
      previousAnnual.value
    )
  )


const quarterlyGrowth =
  computed(() =>
    calculateGrowth(
      latestQuarterly.value,
      previousQuarterly.value
    )
  )


/*
|--------------------------------------------------------------------------
| GROWTH STYLE
|--------------------------------------------------------------------------
*/

function growthClass(
  value
) {
  if (
    value === null ||
    !Number.isFinite(
      Number(value)
    )
  ) {
    return `
      bg-slate-50
      text-slate-500
      border-slate-200
    `
  }

  if (
    Number(value) > 0
  ) {
    return `
      bg-emerald-50
      text-emerald-700
      border-emerald-100
    `
  }

  if (
    Number(value) < 0
  ) {
    return `
      bg-red-50
      text-red-700
      border-red-100
    `
  }

  return `
    bg-slate-50
    text-slate-600
    border-slate-200
  `
}
</script>


<template>
  <div
    class="
      grid
      grid-cols-1
      gap-3
      sm:grid-cols-2
      xl:grid-cols-4
    "
  >
    <!-- =====================================================
         NILAI TAHUNAN TERBARU
    ====================================================== -->

    <article
      class="
        rounded-xl
        border
        border-slate-200/80
        bg-white
        px-4
        py-3.5
        shadow-[0_1px_3px_rgba(15,23,42,0.03)]
      "
    >
      <div
        class="
          flex
          items-start
          justify-between
          gap-3
        "
      >
        <div>
          <p
            class="
              text-[9px]
              font-bold
              uppercase
              tracking-[0.12em]
              text-slate-400
            "
          >
            Nilai Tahunan Terbaru
          </p>

          <p
            class="
              mt-1.5
              text-xl
              font-extrabold
              tracking-tight
              text-slate-900
            "
          >
            {{
              formatValue(
                latestAnnual?.nilai
              )
            }}
          </p>

          <p
            class="
              mt-1
              text-[10px]
              font-medium
              text-slate-400
            "
          >
            {{
              latestAnnual
                ? `Tahun ${latestAnnual.tahun}`
                : 'Data belum tersedia'
            }}
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
            bg-blue-50
            text-blue-600
          "
        >
          <CalendarRange
            :size="17"
            :stroke-width="1.8"
          />
        </div>
      </div>
    </article>


    <!-- =====================================================
         PERTUMBUHAN TAHUNAN
    ====================================================== -->

    <article
      class="
        rounded-xl
        border
        border-slate-200/80
        bg-white
        px-4
        py-3.5
        shadow-[0_1px_3px_rgba(15,23,42,0.03)]
      "
    >
      <div
        class="
          flex
          items-start
          justify-between
          gap-3
        "
      >
        <div>
          <p
            class="
              text-[9px]
              font-bold
              uppercase
              tracking-[0.12em]
              text-slate-400
            "
          >
            Perubahan Tahunan
          </p>

          <p
            class="
              mt-1.5
              text-xl
              font-extrabold
              tracking-tight
            "
            :class="
              annualGrowth > 0
                ? 'text-emerald-600'
                : annualGrowth < 0
                  ? 'text-red-600'
                  : 'text-slate-700'
            "
          >
            {{
              formatPercent(
                annualGrowth
              )
            }}
          </p>

          <p
            class="
              mt-1
              text-[10px]
              text-slate-400
            "
          >
            Dibanding periode tahunan sebelumnya
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
            border
          "
          :class="
            growthClass(
              annualGrowth
            )
          "
        >
          <TrendingUp
            v-if="
              annualGrowth > 0
            "
            :size="17"
          />

          <TrendingDown
            v-else-if="
              annualGrowth < 0
            "
            :size="17"
          />

          <Minus
            v-else
            :size="17"
          />
        </div>
      </div>
    </article>


    <!-- =====================================================
         NILAI TRIWULAN TERBARU
    ====================================================== -->

    <article
      class="
        rounded-xl
        border
        border-slate-200/80
        bg-white
        px-4
        py-3.5
        shadow-[0_1px_3px_rgba(15,23,42,0.03)]
      "
    >
      <div
        class="
          flex
          items-start
          justify-between
          gap-3
        "
      >
        <div>
          <p
            class="
              text-[9px]
              font-bold
              uppercase
              tracking-[0.12em]
              text-slate-400
            "
          >
            Nilai Triwulan Terbaru
          </p>

          <p
            class="
              mt-1.5
              text-xl
              font-extrabold
              tracking-tight
              text-slate-900
            "
          >
            {{
              formatValue(
                latestQuarterly?.nilai
              )
            }}
          </p>

          <p
            class="
              mt-1
              text-[10px]
              font-medium
              text-slate-400
            "
          >
            {{
              latestQuarterly
                ? latestQuarterly.periode
                : 'Data belum tersedia'
            }}
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
            bg-violet-50
            text-violet-600
          "
        >
          <Activity
            :size="17"
            :stroke-width="1.8"
          />
        </div>
      </div>
    </article>


    <!-- =====================================================
         PERTUMBUHAN TRIWULAN
    ====================================================== -->

    <article
      class="
        rounded-xl
        border
        border-slate-200/80
        bg-white
        px-4
        py-3.5
        shadow-[0_1px_3px_rgba(15,23,42,0.03)]
      "
    >
      <div
        class="
          flex
          items-start
          justify-between
          gap-3
        "
      >
        <div>
          <p
            class="
              text-[9px]
              font-bold
              uppercase
              tracking-[0.12em]
              text-slate-400
            "
          >
            Perubahan Triwulan
          </p>

          <p
            class="
              mt-1.5
              text-xl
              font-extrabold
              tracking-tight
            "
            :class="
              quarterlyGrowth > 0
                ? 'text-emerald-600'
                : quarterlyGrowth < 0
                  ? 'text-red-600'
                  : 'text-slate-700'
            "
          >
            {{
              formatPercent(
                quarterlyGrowth
              )
            }}
          </p>

          <p
            class="
              mt-1
              text-[10px]
              text-slate-400
            "
          >
            Dibanding triwulan sebelumnya
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
            border
          "
          :class="
            growthClass(
              quarterlyGrowth
            )
          "
        >
          <TrendingUp
            v-if="
              quarterlyGrowth > 0
            "
            :size="17"
          />

          <TrendingDown
            v-else-if="
              quarterlyGrowth < 0
            "
            :size="17"
          />

          <Minus
            v-else
            :size="17"
          />
        </div>
      </div>
    </article>
  </div>
</template>