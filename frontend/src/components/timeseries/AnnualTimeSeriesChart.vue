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
| FORMAT NUMBER
|--------------------------------------------------------------------------
*/

function formatNumber(
  value
) {
  const number =
    Number(value)

  if (
    !Number.isFinite(number)
  ) {
    return '0'
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
| FORMAT AXIS
|--------------------------------------------------------------------------
|
| Dibuat compact agar angka besar tidak
| memenuhi sumbu Y.
|
*/

function formatAxis(
  value
) {
  const number =
    Number(value)

  if (
    !Number.isFinite(number)
  ) {
    return '0,00 T'
  }

  const trillion =
    number / 1000000

  return (
    trillion.toLocaleString(
      'id-ID',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ) + ' T'
  )
}


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


  const labels =
    rows.map(
      item =>
        String(
          item.tahun ?? ''
        )
    )


  const values =
    rows.map(
      item => {
        const nilai =
          Number(
            item.nilai
          )

        return Number.isFinite(
          nilai
        )
          ? nilai
          : 0
      }
    )


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
      top: 30,
      right: 24,
      bottom: 34,
      left: 65,
      containLabel: false
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
        const item =
          params?.[0]

        if (!item) {
          return ''
        }

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
              ${item.axisValue}
            </div>

            <div
              style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 18px;
              "
            >
              <span
                style="
                  color: #cbd5e1;
                "
              >
                Nilai
              </span>

              <strong>
                ${formatNumber(
                  item.value
                )}
              </strong>
            </div>
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

    series: [
      {
        name:
          'Nilai',

        type:
          'line',

        data:
          values,

        smooth:
          0.3,

        symbol:
          'circle',

        symbolSize:
          7,

        showSymbol:
          true,

        lineStyle: {
          width: 3,
          color:
            '#2563eb'
        },

        itemStyle: {
          color:
            '#ffffff',

          borderColor:
            '#2563eb',

          borderWidth: 2
        },

        emphasis: {
          focus:
            'series',

          itemStyle: {
            color:
              '#2563eb',

            borderColor:
              '#ffffff',

            borderWidth: 2,

            shadowBlur: 8,

            shadowColor:
              'rgba(37, 99, 235, 0.25)'
          }
        },

        areaStyle: {
          opacity: 1,

          color:
            new echarts.graphic.LinearGradient(
              0,
              0,
              0,
              1,
              [
                {
                  offset: 0,
                  color:
                    'rgba(37, 99, 235, 0.18)'
                },

                {
                  offset: 1,
                  color:
                    'rgba(37, 99, 235, 0.01)'
                }
              ]
            )
        }
      }
    ]
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
          Data Time Series Tahunan tidak tersedia.
        </p>
      </div>
    </div>
  </div>
</template>