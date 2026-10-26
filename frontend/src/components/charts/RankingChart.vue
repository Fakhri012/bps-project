<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'

import {
  getChartColor
} from '../../utils/chartColors'

import {
  formatDisplayNumber as formatNumber
} from '../../utils/displayFormatters.js'


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


const sortedData = computed(() => {
  return props.labels
    .map((label, index) => ({
      name: label,

      value: Number(
        props.values[index] || 0
      )
    }))
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
    left: 18,
    right: 36,
    top: 16,
    bottom: 28,
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
      color: '#64748b',
      fontSize: 11,

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
        color: '#e8edf3',
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
    inverse: true,

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
      width: 180,
      overflow: 'break',
      margin: 16,
      formatter: value => {
        const separator = value.indexOf(' — ')

        if (separator < 0) {
          return value
        }

        const sector = value.slice(0, separator)
        const classification = value.slice(separator + 3)

        return `{sector|${sector}}\n{classification|${classification}}`
      },
      rich: {
        sector: {
          color: '#0f766e',
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 18,
          backgroundColor: '#e6f7f4',
          borderRadius: 4,
          padding: [2, 5]
        },
        classification: {
          color: '#334155',
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 18,
          padding: [2, 0]
        }
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
      name: 'Nilai',

      type: 'bar',

      barWidth: 22,


data:
  sortedData.value.map(
    (item, index) => {

      const visualIndex = index

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
              ? [0, 8, 8, 0]
              : [8, 0, 0, 8],

          opacity: 0.92
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
            11,

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