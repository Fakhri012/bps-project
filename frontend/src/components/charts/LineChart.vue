<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'

const props = defineProps({
  years: {
    type: Array,
    default: () => []
  },

  values: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['select'])

const option = computed(() => {
  const numericValues = props.values.map(
    value => Number(value) || 0
  )

  const maxValue =
    numericValues.length > 0
      ? Math.max(...numericValues)
      : 100

  /*
    Sumbu Y menyesuaikan data.
    Kalau capaian > 100%, grafik tetap terlihat.
  */
  const yMax =
    Math.ceil(
      Math.max(100, maxValue * 1.15) / 20
    ) * 20

  return {
    tooltip: {
      trigger: 'axis',
      formatter(params) {
        const item = params?.[0]

        if (!item) return ''

        return `
          <strong>${item.axisValue}</strong><br/>
          Capaian: ${Number(
            item.value
          ).toLocaleString('id-ID', {
            maximumFractionDigits: 1
          })}%
        `
      }
    },

    grid: {
      left: 65,
      right: 30,
      top: 30,
      bottom: 50
    },

    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: props.years,

      axisLine: {
        lineStyle: {
          color: '#e2e8f0'
        }
      },

      axisTick: {
        show: false
      },

      axisLabel: {
        color: '#64748b'
      }
    },

    yAxis: {
      type: 'value',
      min: 0,
      max: yMax,

      axisLabel: {
        color: '#64748b',
        formatter: '{value}%'
      },

      splitLine: {
        lineStyle: {
          color: '#e2e8f0'
        }
      }
    },

    series: [
      {
        name: 'Capaian',
        type: 'line',

        data: numericValues,

        smooth: true,

        symbol: 'circle',
        symbolSize: 8,

        lineStyle: {
          width: 3
        },

        areaStyle: {
          opacity: 0.08
        },

        emphasis: {
          focus: 'series'
        }
      }
    ]
  }
})

function handleClick(params) {
  emit('select', {
    year: params.name,
    value: params.value
  })
}
</script>

<template>
  <VChart
    :option="option"
    autoresize
    class="h-full w-full"
    @click="handleClick"
  />
</template>