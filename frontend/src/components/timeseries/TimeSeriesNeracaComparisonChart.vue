<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  watch
} from 'vue'

import * as echarts from 'echarts'

import {
  formatTimeSeriesAxis,
  formatTimeSeriesNumber
} from '../../utils/chartFormatters.js'

import {
  buildSectorClassificationComparisons
} from '../../utils/timeSeriesStatistics.js'

const props =
  defineProps({
    annualData: {
      type: Array,
      default: () => []
    },
    quarterlyData: {
      type: Array,
      default: () => []
    },
    chartMode: {
      type: String,
      default: 'both'
    },
    selectedKlasifikasi: {
      type: Array,
      default: () => []
    },
    selectedSectors: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  })

const frequency = computed(() =>
  props.chartMode === 'quarterly'
    ? 'quarterly'
    : 'annual'
)

const sectors = computed(() => {
  const source =
    props.selectedSectors.length > 0
      ? props.selectedSectors
      : [
          ...props.annualData,
          ...props.quarterlyData
        ].map(item => item.sektor)
  const uniqueSectors = new Map()

  source.forEach(value => {
    const sektor = String(value ?? '').trim()
    const key = sektor.toLowerCase()

    if (sektor && !uniqueSectors.has(key)) {
      uniqueSectors.set(key, sektor)
    }
  })

  return [...uniqueSectors.entries()].map(([key, sektor]) => ({
    key,
    sektor
  }))
})

const panels = computed(() =>
  sectors.value.map(({ key, sektor }) => {
    const selectedFrequency = frequency.value
    const sourceData =
      selectedFrequency === 'quarterly'
        ? props.quarterlyData
        : props.annualData
    const panel = buildSectorClassificationComparisons(
      sourceData,
      selectedFrequency,
      [sektor],
      props.selectedKlasifikasi
    )[0]

    return {
      ...panel,
      frequency: selectedFrequency
    }
  })
)

const chartRefs = new Map()
const chartInstances = new Map()

const colors = [
  '#0f766e',
  '#2563eb',
  '#d97706',
  '#e11d48',
  '#7c3aed',
  '#65a30d',
  '#0891b2',
  '#c2410c',
  '#db2777'
]

function setChartRef(key, element) {
  if (element) {
    chartRefs.set(key, element)
  } else {
    chartRefs.delete(key)
  }
}

function buildOption(panel) {
  const isQuarterly =
    panel.frequency === 'quarterly'

  const visiblePeriods =
    Math.min(16, panel.periods.length)

  const initialStart =
    panel.periods.length > 0
      ? Math.max(
          0,
          100 - (visiblePeriods / panel.periods.length) * 100
        )
      : 0

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

  const series = panel.series.map((item, index) => {
    const color = colors[index % colors.length]

    return {
      name: item.name,
      type: 'line',
      data: item.data,
      smooth: 0.25,
      showSymbol: true,
      symbol: 'circle',
      symbolSize: 7,
      connectNulls: false,
      lineStyle: {
        width: 3,
        color
      },
      itemStyle: {
        color: '#ffffff',
        borderColor: color,
        borderWidth: 2
      },
      emphasis: {
        focus: 'series',
        lineStyle: {
          width: 4
        }
      }
    }
  })

  return {
    animationDuration: 500,
    grid: {
      top: 54,
      right: 24,
      bottom: isQuarterly ? 58 : 38,
      left: 18,
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.96)',
      borderWidth: 0,
      padding: [10, 12],
      textStyle: {
        color: '#ffffff',
        fontSize: 11
      },
      axisPointer: {
        type: 'line'
      },
      formatter(params) {
        const items = (Array.isArray(params) ? params : [params])
          .filter(item => item && item.value !== null && item.value !== undefined)

        if (items.length === 0) {
          return ''
        }

        return `
          <div style="min-width: 150px;">
            <div style="font-size: 12px; font-weight: 700; margin-bottom: 6px;">
              Periode: ${escapeHtml(items[0].axisValue)}
            </div>
            ${items.map(item => `
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 5px;">
                <span style="color: #cbd5e1;">${item.marker}${escapeHtml(item.seriesName)}</span>
                <strong>${formatTimeSeriesNumber(item.value)}</strong>
              </div>
            `).join('')}
          </div>
        `
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: panel.periods,
      axisLine: {
        lineStyle: {
          color: '#dbe4ec'
        }
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: '#64748b',
        fontSize: 11,
        hideOverlap: true
      },
      splitLine: {
        show: false
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
      axisLabel: {
        color: '#475569',
        fontSize: 11,
        formatter: formatTimeSeriesAxis
      },
      splitLine: {
        lineStyle: {
          color: '#e8edf3'
        }
      }
    },
    legend: {
      top: 8,
      left: 16,
      right: 16,
      type: 'scroll',
      data: panel.series.map(item => item.name),
      textStyle: {
        color: '#64748b',
        fontSize: 11
      }
    },
    dataZoom: isQuarterly
      ? [
          {
            type: 'inside',
            start: initialStart,
            end: 100,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: false
          },
          {
            type: 'slider',
            start: initialStart,
            end: 100,
            height: 14,
            bottom: 6,
            showDetail: false,
            brushSelect: false,
            borderColor: '#dbe4ec',
            backgroundColor: '#f1f5f9',
            fillerColor: 'rgba(15, 118, 110, 0.10)',
            handleStyle: {
              color: '#0f766e'
            },
            dataBackground: {
              lineStyle: {
                color: '#94a3b8'
              },
              areaStyle: {
                color: '#e2e8f0'
              }
            }
          }
        ]
      : [],
    series
  }
}

async function renderCharts() {
  await nextTick()

  const activeKeys =
    new Set(panels.value.map(panel => panel.key))

  chartInstances.forEach((instance, key) => {
    if (!activeKeys.has(key)) {
      instance.dispose()
      chartInstances.delete(key)
    }
  })

  panels.value.forEach(panel => {
    const element =
      chartRefs.get(panel.key)

    if (!element || !panel.hasData) {
      const previousInstance =
        chartInstances.get(panel.key)

      if (previousInstance) {
        previousInstance.dispose()
        chartInstances.delete(panel.key)
      }

      return
    }

    let instance =
      chartInstances.get(panel.key)

    if (!instance || instance.isDisposed()) {
      instance = echarts.init(element)
      chartInstances.set(panel.key, instance)
    }

    instance.setOption(
      buildOption(panel),
      true
    )
  })
}

function handleResize() {
  chartInstances.forEach(instance => {
    instance.resize()
  })
}

watch(
  () => [panels.value, props.loading],
  renderCharts,
  { deep: true, flush: 'post' }
)

onMounted(() => {
  renderCharts()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chartInstances.forEach(instance => instance.dispose())
  chartInstances.clear()
})
</script>

<template>
  <section class="space-y-3">
    <header class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          Time Series
        </p>
        <h2 class="mt-1 text-[15px] font-bold text-slate-800">
          Perbandingan Klasifikasi per Sektor
        </h2>
      </div>

    </header>

    <div
      v-if="panels.length > 0"
      class="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2"
    >
      <section
        v-for="panel in panels"
        :key="panel.key"
        class="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 border-t-2 border-t-teal-500 bg-white shadow-[0_6px_20px_rgba(15,23,42,0.045)] transition-shadow duration-200 hover:shadow-md"
      >
        <header class="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5">
          <h3 class="min-w-0 truncate border-l-2 border-l-teal-500 pl-2 text-sm font-bold text-slate-800">
            {{ panel.sektor }}
          </h3>
        </header>

        <div class="h-[320px] min-w-0 w-full px-2 py-2 sm:h-[340px]">
          <div
            v-if="loading"
            class="flex h-full items-center justify-center text-xs text-slate-400"
          >
            Memuat data perbandingan...
          </div>
          <div
            v-else-if="!panel.hasData"
            class="flex h-full items-center justify-center px-6 text-center text-xs text-slate-400"
          >
            Data Time Series {{ panel.frequency === 'quarterly' ? 'Triwulanan' : 'Tahunan' }} untuk sektor {{ panel.sektor }} tidak tersedia.
          </div>
          <div
            v-else
            :ref="element => setChartRef(panel.key, element)"
            class="h-full w-full"
            :data-pdf-chart="panel.hasData ? 'sector-comparison' : null"
            :data-pdf-title="panel.hasData
              ? `Perbandingan Klasifikasi - ${panel.sektor} (${panel.frequency === 'quarterly' ? 'Triwulanan' : 'Tahunan'})`
              : null"
          ></div>
        </div>
      </section>
    </div>

    <div
      v-else-if="loading"
      class="flex min-h-32 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs text-slate-400"
    >
      Memuat data perbandingan...
    </div>

    <div
      v-else
      class="flex min-h-32 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-center text-xs text-slate-400"
    >
      Pilih sektor pada filter Time Series untuk menampilkan perbandingan neraca.
    </div>
  </section>
</template>
