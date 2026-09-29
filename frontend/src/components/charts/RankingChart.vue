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
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0)
}


/*
|--------------------------------------------------------------------------
| SORT DATA
|--------------------------------------------------------------------------
|
| Data dibuat ascending karena horizontal bar ECharts
| menampilkan item terakhir di posisi paling atas.
|
*/

const sortedData = computed(() => {
  return props.labels
    .map((label, index) => ({
      name: label,

      value: Number(
        props.values[index] || 0
      )
    }))
    .sort(
      (a, b) =>
        a.value - b.value
    )
})

/*
|--------------------------------------------------------------------------
| NILAI MAKSIMUM ABSOLUT
|--------------------------------------------------------------------------
|
| Digunakan untuk menentukan apakah bar cukup
| panjang untuk menaruh angka di dalam bar.
|
*/

const maxAbsValue = computed(() => {
  if (sortedData.value.length === 0) {
    return 0
  }

  return Math.max(
    ...sortedData.value.map(
      item =>
        Math.abs(item.value)
    )
  )
})
/*
|--------------------------------------------------------------------------
| CHART OPTION
|--------------------------------------------------------------------------
*/

const option = computed(() => ({
  animationDuration: 700,
  animationEasing: 'cubicOut',


  /*
  |--------------------------------------------------------------------------
  | TOOLTIP
  |--------------------------------------------------------------------------
  */

  tooltip: {
    trigger: 'axis',

    axisPointer: {
      type: 'shadow'
    },

    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,

    textStyle: {
      color: '#334155',
      fontSize: 12
    },

    padding: [10, 12],

    formatter: params => {
      const item = params?.[0]

      if (!item) {
        return ''
      }

      return `
        <div style="min-width:170px">

          <div style="
            font-weight:600;
            margin-bottom:5px;
            color:#0f172a;
          ">
            ${item.name}
          </div>

          <div style="color:#64748b">
            Nilai:

<strong style="color:#0f172a">
  ${formatNumber(item.value)} triliun
</strong>
          </div>

        </div>
      `
    }
  },


  /*
  |--------------------------------------------------------------------------
  | GRID
  |--------------------------------------------------------------------------
  */

  grid: {
    left: 20,
    right: 35,
    top: 10,
    bottom: 25,
    containLabel: true
  },


  /*
  |--------------------------------------------------------------------------
  | X AXIS
  |--------------------------------------------------------------------------
  */

  xAxis: {
    type: 'value',

    axisLine: {
      show: false
    },

    axisTick: {
      show: false
    },

    axisLabel: {
      color: '#94a3b8',
      fontSize: 10,

formatter: value => {
  return new Intl.NumberFormat(
    'id-ID',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(
    Number(value) || 0
  )
}
    },

    splitLine: {
      show: true,

      lineStyle: {
        type: 'dashed',
        color: '#e2e8f0',
        width: 1
      }
    }
  },


  /*
  |--------------------------------------------------------------------------
  | Y AXIS
  |--------------------------------------------------------------------------
  */

  yAxis: {
    type: 'category',

    data:
      sortedData.value.map(
        item => item.name
      ),

    axisTick: {
      show: false
    },

    axisLine: {
      show: false
    },

    axisLabel: {
      color: '#475569',
      fontSize: 11,
      fontWeight: 500,

      width: 145,
      overflow: 'break',

      margin: 14,

      lineHeight: 15
    }
  },


  /*
  |--------------------------------------------------------------------------
  | SERIES
  |--------------------------------------------------------------------------
  */

  series: [
    {
      name: 'Nilai',

      type: 'bar',

      barWidth: 38,


      /*
       * sortedData tersusun:
       *
       * kecil
       * ↓
       * besar
       *
       * Tetapi ECharts menampilkannya:
       *
       * besar  ← posisi visual pertama
       * ↓
       * kecil
       *
       * Karena itu visualIndex dibalik.
       */

data:
  sortedData.value.map(
    (item, index) => {

      const visualIndex =
        sortedData.value.length -
        1 -
        index

      const absoluteValue =
        Math.abs(item.value)

      const ratio =
        maxAbsValue.value > 0
          ? absoluteValue /
            maxAbsValue.value
          : 0

      /*
       * Kalau panjang bar kurang dari
       * 15% bar terbesar, label dipindah
       * ke luar.
       */
      const isSmallBar =
        ratio < 0.15


      let labelPosition
      let labelColor


      if (isSmallBar) {
        /*
         * Bar kecil.
         *
         * Positif -> kanan
         * Negatif -> kiri
         */
        labelPosition =
          item.value >= 0
            ? 'right'
            : 'left'

        labelColor =
          '#475569'
      } else {
        /*
         * Bar cukup panjang.
         */
        labelPosition =
          item.value >= 0
            ? 'insideRight'
            : 'insideLeft'

        labelColor =
          '#ffffff'
      }


      return {
        name:
          item.name,

        value:
          item.value,

        itemStyle: {
          color:
            getChartColor(
              visualIndex
            ),

          borderRadius:
            item.value >= 0
              ? [0, 5, 5, 0]
              : [5, 0, 0, 5]
        },

        /*
         * Label masing-masing bar.
         */
        label: {
          show: true,

          position:
            labelPosition,

          distance:
            isSmallBar
              ? 6
              : 8,

          color:
            labelColor,

          fontSize:
            10,

          fontWeight:
            600,

          formatter: params => {
            return formatNumber(
              params.value
            )
          }
        }
      }
    }
  ),


      /*
      |--------------------------------------------------------------------------
      | LABEL NILAI
      |--------------------------------------------------------------------------
      */

      


      /*
      |--------------------------------------------------------------------------
      | HOVER
      |--------------------------------------------------------------------------
      */

      emphasis: {
        focus: 'series',

        itemStyle: {
          shadowBlur: 8,

          shadowColor:
            'rgba(15, 23, 42, 0.15)'
        }
      },


      /*
      |--------------------------------------------------------------------------
      | ANIMASI
      |--------------------------------------------------------------------------
      */

      animationDuration: 700,

      animationDelay: params => {
        return (
          params.dataIndex *
          60
        )
      }
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