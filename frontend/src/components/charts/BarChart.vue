<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'

const props = defineProps({
  categories: {
    type: Array,
    default: () => []
  },

  target: {
    type: Array,
    default: () => []
  },

  realization: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['select'])

const option = computed(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'shadow'
    }
  },

  legend: {
    top: 0,
    right: 0,
    data: ['Target', 'Realisasi']
  },

  grid: {
    top: 55,
    left: 15,
    right: 15,
    bottom: 15,
    containLabel: true
  },

  xAxis: {
    type: 'category',
    data: props.categories,
    axisTick: {
      show: false
    },
    axisLine: {
      lineStyle: {
        color: '#e2e8f0'
      }
    },
    axisLabel: {
      color: '#64748b'
    }
  },

  yAxis: {
    type: 'value',
    axisLine: {
      show: false
    },
    axisTick: {
      show: false
    },
    splitLine: {
      lineStyle: {
        color: '#f1f5f9'
      }
    },
    axisLabel: {
      color: '#64748b'
    }
  },

  series: [
    {
      name: 'Target',
      type: 'bar',
      data: props.target,
      barMaxWidth: 22,
      itemStyle: {
        borderRadius: [5, 5, 0, 0]
      }
    },
    {
      name: 'Realisasi',
      type: 'bar',
      data: props.realization,
      barMaxWidth: 22,
      itemStyle: {
        borderRadius: [5, 5, 0, 0]
      }
    }
  ]
}))

function handleClick(params) {
  emit('select', {
    category: params.name,
    series: params.seriesName,
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