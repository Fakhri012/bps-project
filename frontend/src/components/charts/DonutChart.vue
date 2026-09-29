<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'

import {
  getChartColor
} from '../../utils/chartColors'


const props = defineProps({
  labels: {
    type: Array,
    default: () => []
  },

  values: {
    type: Array,
    default: () => []
  }
})


/*
|--------------------------------------------------------------------------
| FORMAT ANGKA
|--------------------------------------------------------------------------
*/

function formatNumber(value) {
  return new Intl.NumberFormat(
    'id-ID',
    {
      useGrouping: true,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(
    Number(value) || 0
  )
}


/*
|--------------------------------------------------------------------------
| DATA DONUT
|--------------------------------------------------------------------------
|
| Tidak ada mapping nama -> warna.
|
| Warna hanya berdasarkan urutan:
|
| index 0 -> warna 1
| index 1 -> warna 2
| index 2 -> warna 3
| dst.
|
*/

const chartData =
  computed(() => {
    return props.labels.map(
      (
        label,
        index
      ) => ({
        name:
          label,

        value:
          Number(
            props.values[index] || 0
          ),

        itemStyle: {
          color:
            getChartColor(
              index
            )
        }
      })
    )
  })


/*
|--------------------------------------------------------------------------
| TOTAL POSITIF
|--------------------------------------------------------------------------
|
| Donut menerima nilai positif saja
| dari DashboardView.
|
*/

const totalValue =
  computed(() => {
    return props.values.reduce(
      (
        total,
        value
      ) =>
        total +
        Number(value || 0),

      0
    )
  })


/*
|--------------------------------------------------------------------------
| OPTION
|--------------------------------------------------------------------------
*/

const option =
  computed(() => ({
    animationDuration: 700,

    animationEasing:
      'cubicOut',


    /*
    |--------------------------------------------------------------------------
    | TOOLTIP
    |--------------------------------------------------------------------------
    */

    tooltip: {
      trigger: 'item',

      backgroundColor:
        '#ffffff',

      borderColor:
        '#e2e8f0',

      borderWidth: 1,

      padding: [
        10,
        12
      ],

      textStyle: {
        color:
          '#334155',

        fontSize:
          12
      },

      formatter:
        params => {
          return `
            <div style="min-width:190px">

              <div style="
                display:flex;
                align-items:center;
                gap:7px;
                margin-bottom:7px;
              ">

                <span style="
                  width:8px;
                  height:8px;
                  border-radius:50%;
                  background:${params.color};
                  display:inline-block;
                "></span>

                <strong style="
                  color:#0f172a;
                ">
                  ${params.name}
                </strong>

              </div>


              <div style="
                display:flex;
                justify-content:space-between;
                gap:20px;
                color:#64748b;
              ">

                <span>
                  Nilai
                </span>

                <strong style="
                  color:#0f172a;
                ">
                  ${formatNumber(
                    params.value
                  )}
                </strong>

              </div>


              <div style="
                display:flex;
                justify-content:space-between;
                gap:20px;
                margin-top:4px;
                color:#64748b;
              ">

                <span>
                  Kontribusi
                </span>

                <strong style="
                  color:#0f172a;
                ">
                  ${params.percent}%
                </strong>

              </div>

            </div>
          `
        }
    },


    /*
    |--------------------------------------------------------------------------
    | LEGEND
    |--------------------------------------------------------------------------
    */

    legend: {
      show: true,

      orient:
        'vertical',

      right:
        '2%',

      top:
        'center',

      icon:
        'circle',

      itemWidth:
        9,

      itemHeight:
        9,

      itemGap:
        14,

      textStyle: {
        color:
          '#475569',

        fontSize:
          11
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
          'Institusi',

        type:
          'pie',

        percentPrecision: 2,

        radius: [
          '49%',
          '70%'
        ],

        center: [
          '34%',
          '50%'
        ],

        avoidLabelOverlap:
          true,

        minAngle:
          2,

        itemStyle: {
          borderColor:
            '#ffffff',

          borderWidth:
            3
        },


        /*
        |--------------------------------------------------------------------------
        | PERSENTASE
        |--------------------------------------------------------------------------
        */

label: {
  show: true,

  position: 'outside',

  color: '#334155',

  fontSize: 11,

  fontWeight: 600,

  formatter: params => {
    const percent =
      Number(
        params.percent
      )

    /*
     * Tidak perlu tampilkan 0%.
     */
    if (
      !Number.isFinite(percent) ||
      percent <= 0
    ) {
      return ''
    }

    /*
     * Format Indonesia:
     *
     * 0.95  -> 0,95%
     * 5.5   -> 5,5%
     * 23.49 -> 23,49%
     */
    const formatted =
      new Intl.NumberFormat(
        'id-ID',
        {
          minimumFractionDigits:
            percent < 1
              ? 2
              : 0,

          maximumFractionDigits:
            2
        }
      ).format(percent)

    return `${formatted}%`
  }
},


        /*
        |--------------------------------------------------------------------------
        | GARIS LABEL
        |--------------------------------------------------------------------------
        */

        labelLine: {
          show:
            true,

          length:
            10,

          length2:
            7,

          lineStyle: {
            color:
              '#cbd5e1',

            width:
              1
          }
        },


        /*
        |--------------------------------------------------------------------------
        | HOVER
        |--------------------------------------------------------------------------
        */

        emphasis: {
          scale:
            true,

          scaleSize:
            6,

          itemStyle: {
            shadowBlur:
              12,

            shadowColor:
              'rgba(15, 23, 42, 0.12)'
          }
        },


        /*
        |--------------------------------------------------------------------------
        | DATA
        |--------------------------------------------------------------------------
        */

        data:
          chartData.value
      }
    ],


    /*
    |--------------------------------------------------------------------------
    | TOTAL DI TENGAH
    |--------------------------------------------------------------------------
    */

    graphic: [
      {
        type:
          'group',

        left:
          '34%',

        top:
          'center',

        bounding:
          'raw',

        children: [
          {
            type:
              'text',

            style: {
              text:
                'TOTAL POSITIF',

              textAlign:
                'center',

              textVerticalAlign:
                'middle',

              fill:
                '#94a3b8',

              fontSize:
                8,

              fontWeight:
                600
            },

            top:
              -10
          },


 
{
  type:
    'text',

  style: {
    text:
      formatNumber(
        totalValue.value
      ),

    textAlign:
      'center',

    textVerticalAlign:
      'middle',

    fill:
      '#0f172a',

    fontSize:
      15,

    fontWeight:
      700
  },

  top:
    7
}
        ]
      }
    ]
  }))
</script>


<template>
  <VChart
    :option="option"
    autoresize
    class="h-full w-full"
  />
</template>