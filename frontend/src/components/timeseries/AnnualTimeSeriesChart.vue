<script setup>
import {
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick
} from 'vue'

import * as echarts
  from 'echarts'

import {
  formatTimeSeriesAxis as formatAxis,
  formatTimeSeriesNumber as formatNumber
} from '../../utils/chartFormatters.js'


/*
|--------------------------------------------------------------------------
| PROPS
|--------------------------------------------------------------------------
|
| Format data:
|
| [
|   {
|     tahun: 2020,
|     nilai: 123
|   },
|   {
|     tahun: 2021,
|     nilai: 456
|   }
| ]
|
*/

const props =
  defineProps({
    data: {
      type: Array,
      default: () => []
    },
    emptyMessage: {
      type: String,
      default: 'Data Time Series Tahunan tidak tersedia.'
    }
  })


/*
|--------------------------------------------------------------------------
| CHART
|--------------------------------------------------------------------------
*/

const chartRef =
  ref(null)

let chartInstance =
  null


/*
|--------------------------------------------------------------------------
| BUILD OPTION
|--------------------------------------------------------------------------
*/

function buildOption() {
  const rows =
    Array.isArray(
      props.data
    )
      ? props.data
      : []


  const labels = [
    ...new Set(
      rows.map(
        item => String(item.tahun ?? '')
      )
    )
  ].sort(
    (a, b) => Number(a) - Number(b)
  )

  const seriesNames = [
    ...new Set(
      rows.map(
        item => String(item.seriesName || 'Nilai')
      )
    )
  ]

  const valuesBySeries = new Map()

  rows.forEach(item => {
    const name =
      String(item.seriesName || 'Nilai')

    if (!valuesBySeries.has(name)) {
      valuesBySeries.set(name, new Map())
    }

    const value =
      Number(item.nilai)

    valuesBySeries.get(name).set(
      String(item.tahun ?? ''),
      Number.isFinite(value) ? value : null
    )
  })

  const colors = [
    '#0f766e',
    '#2563eb',
    '#d97706',
    '#e11d48',
    '#7c3aed',
    '#65a30d',
    '#0891b2',
    '#c2410c'
  ]

  const series =
    seriesNames.map((name, index) => {
      const color =
        colors[index] ||
        `hsl(${Math.round(((index - colors.length) * 137.508) % 360)}, 68%, ${index % 2 === 0 ? 42 : 48}%)`

      const values =
        valuesBySeries.get(name)

      return {
        name,
        type: 'line',
        data: labels.map(
          label => values.has(label)
            ? values.get(label)
            : null
        ),
        smooth: 0.3,
        symbol: 'circle',
        symbolSize: 7,
        showSymbol: true,
        connectNulls: false,
        lineStyle: {
          width: 3.5,
          color
        },
        itemStyle: {
          color: '#ffffff',
          borderColor: color,
          borderWidth: 2
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            color,
            borderColor: '#ffffff',
            borderWidth: 2,
            shadowBlur: 8
          }
        },
        areaStyle: {
          opacity: seriesNames.length > 1 ? 0.025 : 0.09,
          color
        }
      }
    })


  return {
    animationDuration:
      700,

    animationEasing:
      'cubicOut',


    /*
    |--------------------------------------------------------------------------
    | GRID
    |--------------------------------------------------------------------------
    */

    grid: {
      top: seriesNames.length > 1 ? 52 : 32,
      right: 28,
      bottom: 40,
      left: 70,
      containLabel: false
    },

    legend: {
      show: seriesNames.length > 1,
      type: 'scroll',
      top: 4,
      left: 65,
      right: 16,
      itemWidth: 14,
      itemHeight: 9,
      textStyle: {
        color: '#64748b',
        fontSize: 11
      }
    },

    /*
    |--------------------------------------------------------------------------
    | TOOLTIP
    |--------------------------------------------------------------------------
    */

    tooltip: {
      trigger: 'axis',

      backgroundColor:
        'rgba(15, 23, 42, 0.96)',

      borderWidth: 0,

      padding: [
        10,
        12
      ],

      textStyle: {
        color: '#ffffff',
        fontSize: 11
      },

      axisPointer: {
        type: 'line',

        lineStyle: {
          color:
            '#94a3b8',

          type:
            'dashed'
        }
      },

      formatter(
        params
      ) {
        const items =
          (Array.isArray(params) ? params : [params])
            .filter(
              item =>
                item &&
                item.value !== null &&
                item.value !== undefined
            )

        if (items.length === 0) {
          return ''
        }

        const escapeHtml = value =>
          String(value).replace(
            /[&<>"']/g,
            character => ({
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#39;'
            })[character]
          )

        return `
          <div
            style="
              min-width: 120px;
            "
          >
            <div
              style="
                margin-bottom: 4px;
                font-size: 10px;
                color: #94a3b8;
              "
            >
              Tahun
            </div>

            <div
              style="
                margin-bottom: 8px;
                font-size: 12px;
                font-weight: 700;
              "
            >
              ${escapeHtml(items[0].axisValue)}
            </div>
            ${items.map(item => `
              <div style="display: flex; justify-content: space-between; gap: 18px; margin-top: 4px;">
                <span style="color: #cbd5e1;">
                  ${item.marker}${escapeHtml(item.seriesName)}
                </span>
                <strong>${formatNumber(item.value)}</strong>
              </div>
            `).join('')}
          </div>
        `
      }
    },


    /*
    |--------------------------------------------------------------------------
    | X AXIS
    |--------------------------------------------------------------------------
    */

    xAxis: {
      type: 'category',

      boundaryGap: false,

      data:
        labels,

      axisLine: {
        lineStyle: {
          color:
            '#e2e8f0'
        }
      },

      axisTick: {
        show: false
      },

      axisLabel: {
        color:
          '#64748b',

        fontSize: 10,

        margin: 12
      }
    },


    /*
    |--------------------------------------------------------------------------
    | Y AXIS
    |--------------------------------------------------------------------------
    */

    yAxis: {
      type: 'value',

      scale: true,

      axisLine: {
        show: false
      },

      axisTick: {
        show: false
      },

      axisLabel: {
        color:
          '#94a3b8',

        fontSize: 10,

        formatter:
          formatAxis
      },

      splitLine: {
        lineStyle: {
          color:
            '#f1f5f9',

          type:
            'solid'
        }
      }
    },


    /*
    |--------------------------------------------------------------------------
    | SERIES
    |--------------------------------------------------------------------------
    */

    series
  }
}


/*
|--------------------------------------------------------------------------
| RENDER CHART
|--------------------------------------------------------------------------
*/

async function renderChart() {
  await nextTick()

  if (
    !chartRef.value
  ) {
    return
  }


  if (
    !chartInstance
  ) {
    chartInstance =
      echarts.init(
        chartRef.value
      )
  }


  chartInstance.setOption(
    buildOption(),
    true
  )
}


/*
|--------------------------------------------------------------------------
| RESIZE
|--------------------------------------------------------------------------
*/

function handleResize() {
  if (
    chartInstance
  ) {
    chartInstance.resize()
  }
}


/*
|--------------------------------------------------------------------------
| WATCH DATA
|--------------------------------------------------------------------------
*/

watch(
  () => props.data,
  () => {
    renderChart()
  },
  {
    deep: true
  }
)


/*
|--------------------------------------------------------------------------
| MOUNT
|--------------------------------------------------------------------------
*/

onMounted(() => {
  renderChart()

  window.addEventListener(
    'resize',
    handleResize
  )
})


/*
|--------------------------------------------------------------------------
| DESTROY
|--------------------------------------------------------------------------
*/

onBeforeUnmount(() => {
  window.removeEventListener(
    'resize',
    handleResize
  )

  if (
    chartInstance
  ) {
    chartInstance.dispose()

    chartInstance =
      null
  }
})
</script>


<template>
  <div
    class="
      relative
      h-full
      w-full
    "
  >
    <!-- ADA DATA -->
    <div
      v-if="
        data.length > 0
      "
      ref="chartRef"
      class="
        h-full
        min-h-[280px]
        w-full
      "
    ></div>


    <!-- EMPTY -->
    <div
      v-else
      class="
        flex
        h-full
        min-h-[280px]
        items-center
        justify-center
      "
    >
      <div
        class="
          text-center
        "
      >
        <div
          class="
            mx-auto
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            bg-slate-100
            text-slate-400
          "
        >
          —
        </div>

        <p
          class="
            mt-3
            text-sm
            font-semibold
            text-slate-600
          "
        >
          Tidak ada data
        </p>

        <p
          class="
            mt-1
            text-xs
            text-slate-400
          "
        >
          {{ emptyMessage }}
        </p>
      </div>
    </div>
  </div>
</template>