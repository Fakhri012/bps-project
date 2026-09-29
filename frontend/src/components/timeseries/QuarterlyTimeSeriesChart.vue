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
|     tahun: 2022,
|     triwulan: 1,
|     periode: '2022 Q1',
|     nilai: 123
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
      item => {
        if (
          item.periode
        ) {
          return String(
            item.periode
          )
        }

        return `${item.tahun ?? ''} Q${item.triwulan ?? ''}`
      }
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
      bottom: 50,
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
              min-width: 130px;
            "
          >
            <div
              style="
                margin-bottom: 4px;
                font-size: 10px;
                color: #94a3b8;
              "
            >
              Periode
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

  fontSize:
    9,

  margin:
    12,

  rotate:
    labels.length > 12
      ? 40
      : 0,

  /*
   * Selalu tampilkan semua:
   *
   * Q1
   * Q2
   * Q3
   * Q4
   */
  interval:
    0,

  hideOverlap:
    false
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
            '#f1f5f9'
        }
      }
    },


    /*
    |--------------------------------------------------------------------------
    | DATA ZOOM
    |--------------------------------------------------------------------------
    |
    | Berguna kalau titik triwulan banyak.
    |
    */

    dataZoom:
      labels.length > 16
        ? [
            {
              type:
                'inside',

              start:
                Math.max(
                  0,
                  100 -
                  (
                    16 /
                    labels.length
                  ) *
                  100
                ),

              end:
                100
            },

            {
              type:
                'slider',

              height:
                16,

              bottom:
                4,

              borderColor:
                '#e2e8f0',

              backgroundColor:
                '#f8fafc',

              fillerColor:
                'rgba(124, 58, 237, 0.08)',

              handleStyle: {
                color:
                  '#7c3aed'
              },

              textStyle: {
                color:
                  '#94a3b8',

                fontSize:
                  9
              }
            }
          ]

        : [],


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
          0.25,

        symbol:
          'circle',

        symbolSize:
          6,

        showSymbol:
          labels.length <= 24,

        lineStyle: {
          width:
            2.5,

          color:
            '#7c3aed'
        },

        itemStyle: {
          color:
            '#ffffff',

          borderColor:
            '#7c3aed',

          borderWidth:
            2
        },

        emphasis: {
          focus:
            'series',

          itemStyle: {
            color:
              '#7c3aed',

            borderColor:
              '#ffffff',

            borderWidth:
              2,

            shadowBlur:
              8,

            shadowColor:
              'rgba(124, 58, 237, 0.25)'
          }
        },

        areaStyle: {
          opacity:
            1,

          color:
            new echarts.graphic.LinearGradient(
              0,
              0,
              0,
              1,
              [
                {
                  offset:
                    0,

                  color:
                    'rgba(124, 58, 237, 0.16)'
                },

                {
                  offset:
                    1,

                  color:
                    'rgba(124, 58, 237, 0.01)'
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
| RENDER
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
| WATCH
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
      <div class="text-center">
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
          Data Time Series Triwulanan tidak tersedia.
        </p>
      </div>
    </div>
  </div>
</template>