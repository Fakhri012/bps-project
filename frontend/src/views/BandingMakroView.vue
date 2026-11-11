<script setup>
import {
  computed,
  onMounted,
  ref,
  toRef
} from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import {
  Activity,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  RotateCcw
} from 'lucide-vue-next'

import { getBandingMakroData } from '../services/bandingMakroApi'
import { getTriwulananAsset } from '../services/dashboardApi'
import MultiSelectFilter from '../components/dashboard/MultiSelectFilter.vue'
import { usePersistentFilterState } from '../composables/filterState.js'
import { formatDisplayNumber } from '../utils/displayFormatters.js'
import { buildBandingMakroFilterOptions } from '../utils/bandingMakroFilters.js'
import {
  bandingMakroSectorOptions,
  bandingMakroSectorRows
} from '../data/bandingMakroSectorData.js'
import {
  BANDING_MAKRO_MAIN_SERIES,
  buildBandingMakroChartData
} from '../utils/bandingMakroChart.js'

const sectorSeriesColors = ['#2563eb', '#d97706', '#e11d48', '#7c3aed', '#65a30d', '#0891b2']

use([
  LineChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer
])

const rows = ref([])
const metadata = ref(null)
const selectedYear = ref('')
const selectedSectors = ref([])
const selectedDetailYear = ref('')
const quarterlyDetails = ref([])
const loading = ref(false)
const error = ref('')
const pivotRows = ref([])
const pivotFilterLoading = ref(false)
const pivotFilterError = ref('')

const { state: savedFilters } = usePersistentFilterState('bandingMakro', {
  institutions: [],
  periods: [],
  macroTypes: []
})

const selectedInstitutions = toRef(savedFilters, 'institutions')
const selectedPeriods = toRef(savedFilters, 'periods')
const selectedMacroTypes = toRef(savedFilters, 'macroTypes')
const filterResetVersion = ref(0)

const bandingMakroFilters = computed(() =>
  buildBandingMakroFilterOptions({
    pivotRows: pivotRows.value,
    bopRows: quarterlyDetails.value,
    filters: {
      institutions: selectedInstitutions.value,
      periods: selectedPeriods.value,
      macroTypes: selectedMacroTypes.value
    }
  })
)

const filterSourcesLoading = computed(() => loading.value || pivotFilterLoading.value)
const hasSelectedFilter = computed(() =>
  selectedInstitutions.value.length > 0 ||
  selectedPeriods.value.length > 0 ||
  selectedMacroTypes.value.length > 0
)
const showFilterEmptyState = computed(() =>
  hasSelectedFilter.value && !bandingMakroFilters.value.hasMatchingData
)

function resetBandingMakroFilters() {
  filterResetVersion.value += 1
  selectedInstitutions.value = []
  selectedPeriods.value = []
  selectedMacroTypes.value = []
}

async function loadPivotFilterRows() {
  pivotFilterLoading.value = true
  pivotFilterError.value = ''

  try {
    const query = {
      institusi: ['GG', 'HH', 'NPISHS', 'TOTAL EKN'],
      page: 1,
      limit: 100
    }
    const firstPage = await getTriwulananAsset(query)
    const rows = Array.isArray(firstPage?.data) ? [...firstPage.data] : []
    const totalPages = Number(firstPage?.pagination?.totalPages) || 1

    for (let page = 2; page <= totalPages; page += 1) {
      const response = await getTriwulananAsset({ ...query, page })
      if (Array.isArray(response?.data)) {
        rows.push(...response.data)
      }
    }

    pivotRows.value = rows
  } catch (requestError) {
    console.error('Gagal memuat data Pivot untuk filter Banding Makro:', requestError)
    pivotRows.value = []
    pivotFilterError.value = 'Data Pivot untuk filter belum dapat dimuat.'
  } finally {
    pivotFilterLoading.value = false
  }
}

const yearOptions = computed(() => rows.value.map(row => row.tahun))
const detailYearOptions = computed(() => [
  ...new Set(quarterlyDetails.value.map(row => row.tahun))
].sort((left, right) => left - right))
const selectedQuarterRows = computed(() =>
  quarterlyDetails.value
    .filter(row => String(row.tahun) === selectedDetailYear.value)
    .sort((left, right) => left.triwulan - right.triwulan)
)
const annualDetailRow = computed(() =>
  rows.value.find(row => String(row.tahun) === selectedDetailYear.value) || null
)
const annualRateDetail = computed(() =>
  metadata.value?.kurs?.rekapTahunan?.find(row => String(row.tahun) === selectedDetailYear.value) || null
)
const quarterPeriods = [
  'Januari–Maret',
  'April–Juni',
  'Juli–September',
  'Oktober–Desember'
]

const filteredRows = computed(() =>
  selectedYear.value === 'last-5'
    ? rows.value.slice(-5)
    : selectedYear.value === 'last-10'
      ? rows.value.slice(-10)
      : rows.value
)

const filteredSectorRows = computed(() => {
  if (!selectedSectors.value.length) return []

  const transactionYears = new Set(
    filteredRows.value.map(row => String(row.tahun))
  )
  return bandingMakroSectorRows.filter(row =>
    selectedSectors.value.includes(row.sektor) &&
    (
      selectedYear.value === '' ||
      transactionYears.has(String(row.tahun))
    )
  )
})

const chartData = computed(() =>
  buildBandingMakroChartData(
    filteredRows.value,
    filteredSectorRows.value,
    selectedSectors.value
  )
)

const featuredRow = computed(() => {
  return filteredRows.value.at(-1) || null
})

const chartOption = computed(() => ({
  animation: false,
  legend: {
    top: 0,
    data: chartData.value.series.map(series => series.name),
    selectedMode: false
  },
  tooltip: {
    trigger: 'axis',
    formatter(params) {
      const year = String(params?.[0]?.axisValue ?? '')
      if (!year) return ''

      const mainValue = chartData.value.series[0]?.values[
        chartData.value.years.indexOf(year)
      ]
      const sectorLines = selectedSectors.value.map((sector, index) => {
        const value = chartData.value.series.find(series => series.name === sector)
          ?.values[chartData.value.years.indexOf(year)]
        const color = sectorSeriesColors[index % sectorSeriesColors.length]

        return `<span style="color:${color}">●</span> ${sector}: ${
          value === null || value === undefined
            ? 'Data tidak tersedia'
            : `Rp ${formatDisplayNumber(value)} triliun`
        }`
      })

      return [
        `<strong>${year}</strong>`,
        `<span style="color:#0f766e">●</span> ${BANDING_MAKRO_MAIN_SERIES}: ${
          mainValue === null || mainValue === undefined
            ? 'Kurs tidak tersedia'
            : `Rp ${formatDisplayNumber(mainValue)} triliun`
        }`,
        ...sectorLines
      ].join('<br/>')
    }
  },
  grid: {
    left: 86,
    right: 28,
    top: 52,
    bottom: 52
  },
  xAxis: {
    type: 'category',
    data: chartData.value.years,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: '#cbd5e1' } },
    axisLabel: { color: '#64748b', hideOverlap: true }
  },
  yAxis: {
    type: 'value',
    name: 'Rp triliun',
    nameTextStyle: { color: '#64748b', padding: [0, 0, 8, 0] },
    axisLabel: {
      color: '#64748b',
      formatter: value => formatDisplayNumber(value)
    },
    splitLine: { lineStyle: { color: '#e2e8f0' } }
  },
  series: chartData.value.series.map((series, index) => {
    const isMainSeries = index === 0
    const color = isMainSeries
      ? '#0f766e'
      : sectorSeriesColors[(index - 1) % sectorSeriesColors.length]

    return {
      name: series.name,
      type: 'line',
      data: series.values,
      connectNulls: false,
      smooth: false,
      symbol: 'circle',
      symbolSize: isMainSeries ? 8 : 7,
      lineStyle: { width: isMainSeries ? 4 : 2.5, color },
      itemStyle: isMainSeries
        ? { color }
        : { color: '#ffffff', borderColor: color, borderWidth: 2 },
      ...(isMainSeries
        ? {
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: '#94a3b8', type: 'dashed' },
              label: { formatter: '0', color: '#64748b' },
              data: [{ yAxis: 0 }]
            }
          }
        : {})
    }
  })
}))

function toggleSector(sector) {
  selectedSectors.value = selectedSectors.value.includes(sector)
    ? selectedSectors.value.filter(item => item !== sector)
    : [...selectedSectors.value, sector]
}

function formatAmount(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return 'Tidak tersedia'
  }

  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value))
}

async function loadData() {
  loading.value = true
  error.value = ''

  try {
    const response = await getBandingMakroData()
    rows.value = Array.isArray(response?.data) ? response.data : []
    metadata.value = response?.metadata || null
    quarterlyDetails.value = Array.isArray(response?.detailTriwulanan)
      ? response.detailTriwulanan
      : []
    if (!detailYearOptions.value.includes(Number(selectedDetailYear.value))) {
      selectedDetailYear.value = String(detailYearOptions.value.at(-1) || '')
    }
  } catch (requestError) {
    console.error('Gagal memuat data Banding Makro:', requestError)
    rows.value = []
    metadata.value = null
    quarterlyDetails.value = []
    selectedDetailYear.value = ''
    error.value = requestError?.response?.data?.message ||
      requestError?.message ||
      'Gagal mengambil data Banding Makro.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
  loadPivotFilterRows()
})
</script>

<template>
  <div class="mx-auto max-w-[1600px] space-y-4">
    <section class="overflow-hidden rounded-2xl border border-slate-200/80 border-t-4 border-t-teal-600 bg-gradient-to-br from-white via-white to-teal-50/60 px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] lg:px-6">
      <div class="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div class="min-w-0">
          <div class="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5">
            <Activity :size="13" class="text-teal-700" />
            <span class="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-800">
              Analisis Makro
            </span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 lg:text-[28px]">
            Banding Makro
          </h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Perkembangan transaksi berjalan Indonesia dalam rupiah, dikonversi menggunakan rata-rata kurs JISDOR.
          </p>
        </div>
        <div class="flex flex-wrap items-stretch gap-2 xl:justify-end">
          <div class="flex min-w-[165px] items-center gap-3 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 shadow-[0_3px_12px_rgba(15,23,42,0.04)]">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <CalendarDays :size="16" :stroke-width="1.8" />
            </div>
            <div class="min-w-0">
              <p class="text-[9px] font-bold uppercase tracking-wider text-slate-400">Tahun terbaru</p>
              <p class="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                {{ yearOptions.length ? yearOptions.at(-1) : 'Belum tersedia' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5" aria-label="Filter Banding Makro">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-sm font-semibold text-slate-900">Filter Banding Makro</h2>
        <button
          type="button"
          class="relative z-[60] inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-800"
          @click="resetBandingMakroFilters"
        >
          <RotateCcw :size="14" />
          Reset filter
        </button>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <MultiSelectFilter
          :key="`institutions-${filterResetVersion}`"
          v-model="selectedInstitutions"
          label="Institusi"
          placeholder="Semua institusi tersedia"
          :options="bandingMakroFilters.institutions"
          :disabled="filterSourcesLoading"
        />
        <MultiSelectFilter
          :key="`periods-${filterResetVersion}`"
          v-model="selectedPeriods"
          label="Periode"
          placeholder="Semua periode tersedia"
          :options="bandingMakroFilters.periods"
          :disabled="filterSourcesLoading"
        />
        <MultiSelectFilter
          :key="`macroTypes-${filterResetVersion}`"
          v-model="selectedMacroTypes"
          label="Jenis Makro"
          placeholder="Semua jenis makro tersedia"
          :options="bandingMakroFilters.macroTypes"
          :disabled="filterSourcesLoading"
        />
      </div>

      <p v-if="filterSourcesLoading" role="status" class="mt-3 text-xs text-slate-500">
        Memuat pilihan filter dari sumber data...
      </p>
      <p v-else-if="pivotFilterError" role="alert" class="mt-3 text-xs text-amber-800">
        {{ pivotFilterError }} Pilihan BOP tetap mengikuti data JISDOR yang tersedia.
      </p>
      <p v-if="selectedMacroTypes.includes('PDB')" class="mt-3 text-xs font-semibold text-amber-800">
        PDB: Data Belum Tersedia.
      </p>
      <p v-if="showFilterEmptyState" role="status" class="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
        Tidak ada data untuk kombinasi filter yang dipilih.
      </p>
    </section>

    <section class="grid gap-3 md:grid-cols-3" aria-label="Ringkasan indikator">
        <article class="rounded-xl border border-slate-200/80 border-t-2 border-t-teal-500 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Transaksi berjalan</p>
            <CircleDollarSign :size="19" class="shrink-0 text-[#147d70]" />
          </div>
          <p class="mt-4 text-2xl font-bold tabular-nums text-slate-900 sm:text-[1.7rem]">
            <template v-if="featuredRow?.nilaiTriliunRupiah !== null && featuredRow?.nilaiTriliunRupiah !== undefined">
              {{ formatAmount(featuredRow.nilaiTriliunRupiah) }}
            </template>
            <template v-else>—</template>
            <span class="ml-1 text-xs font-medium text-slate-500">triliun rupiah</span>
          </p>
          <p class="mt-2 text-xs text-slate-500">
            {{ featuredRow ? `Posisi tahun ${featuredRow.tahun}` : 'Belum tersedia' }}
          </p>
        </article>

        <article class="rounded-xl border border-slate-200/80 border-t-2 border-t-teal-500 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Rata-rata JISDOR</p>
            <Activity :size="19" class="shrink-0 text-[#3974a8]" />
          </div>
          <p class="mt-4 text-2xl font-bold tabular-nums text-slate-900 sm:text-[1.7rem]">
            {{ featuredRow ? formatAmount(featuredRow.rataRataJisdor) : '—' }}
            <span class="ml-1 text-xs font-medium text-slate-500">IDR/USD</span>
          </p>
          <p class="mt-2 text-xs text-slate-500">
            Rata-rata sederhana dari triwulan tersedia
          </p>
        </article>

        <article class="rounded-xl border border-slate-200/80 border-t-2 border-t-teal-500 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Cakupan kurs</p>
            <CalendarDays :size="19" class="shrink-0 text-[#a8731f]" />
          </div>
          <p class="mt-4 text-2xl font-bold tabular-nums text-slate-900 sm:text-[1.7rem]">
            {{ featuredRow ? `${featuredRow.jumlahTriwulanKurs}/4` : '—' }}
            <span class="ml-1 text-xs font-medium text-slate-500">triwulan</span>
          </p>
          <p class="mt-2 text-xs text-slate-500">
            {{ featuredRow ? `${featuredRow.jumlahObservasiKurs} observasi · ${featuredRow.cakupanKurs?.tanggalAwal || '—'}–${featuredRow.cakupanKurs?.tanggalAkhir || '—'}` : 'Belum tersedia' }}
            <span v-if="featuredRow?.cakupanKurs?.parsial"> · parsial</span>
          </p>
        </article>
      </section>

      <section class="rounded-2xl border border-slate-200/80 border-t-2 border-t-teal-500 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#147d70]">Tren tahunan</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">
              Perkembangan Transaksi Berjalan
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Nilai negatif dan positif ditampilkan terhadap garis nol.
            </p>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label class="block text-xs font-semibold text-slate-600 sm:min-w-44">
              Filter tahun
              <select
                v-model="selectedYear"
                class="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="">Semua tahun</option>
                <option value="last-5">5 tahun terakhir</option>
                <option value="last-10">10 tahun terakhir</option>
              </select>
            </label>
            <div class="relative block text-xs font-semibold text-slate-600 sm:min-w-52">
              <span class="block">Bandingkan sektor</span>
              <details class="group relative mt-1.5">
                <summary class="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition hover:border-teal-400 focus:border-teal-500">
                  <span>{{ selectedSectors.length ? `${selectedSectors.length} sektor dipilih` : 'Pilih sektor' }}</span>
                  <ChevronDown :size="15" class="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                <div class="absolute right-0 z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  <p class="px-2 py-1 text-[11px] font-normal leading-4 text-slate-500">
                    Nilai sektoral belum terhubung. Seri akan ditampilkan sebagai tidak tersedia sampai sumber dan satuan terverifikasi.
                  </p>
                  <label
                    v-for="sector in bandingMakroSectorOptions"
                    :key="sector.kode"
                    class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedSectors.includes(sector.kode)"
                      class="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      @change="toggleSector(sector.kode)"
                    >
                    {{ sector.nama }}
                  </label>
                </div>
              </details>
            </div>
          </div>
        </div>

        <div v-if="error" role="alert" class="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {{ error }}
        </div>
        <div v-else-if="loading" role="status" class="mt-5 flex h-80 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
          <span class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#147d70]" />
          Memuat data transaksi berjalan...
        </div>
        <div v-else-if="filteredRows.length" class="mt-5 h-80 sm:h-[26rem]">
          <VChart :option="chartOption" autoresize class="h-full w-full" />
        </div>
        <div v-else class="mt-5 flex h-80 items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-sm text-slate-500">
          Data untuk filter yang dipilih belum tersedia.
        </div>
      </section>

      <section class="rounded-2xl border border-slate-200/80 border-t-2 border-t-teal-500 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-6">
        <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#147d70]">Rincian</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">Data tahunan</h2>
          </div>
          <p class="mt-1 text-sm text-slate-500">
            Tanda — menunjukkan data yang belum tersedia. Nilai untuk tahun parsial dihitung berdasarkan triwulan yang tersedia.
          </p>
        </div>

        <div class="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead class="bg-slate-50">
              <tr class="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                <th scope="col" class="sticky left-0 z-10 min-w-28 bg-slate-50 px-4 py-3.5 font-semibold">Tahun</th>
                <th scope="col" class="min-w-40 px-4 py-3.5 text-right font-semibold">Transaksi <span class="mt-0.5 block normal-case font-medium text-slate-400">Juta USD</span></th>
                <th scope="col" class="min-w-48 px-4 py-3.5 text-right font-semibold">Rata-rata JISDOR <span class="mt-0.5 block normal-case font-medium text-slate-400">IDR/USD</span></th>
                <th scope="col" class="min-w-48 px-4 py-3.5 text-right font-semibold">Nilai konversi <span class="mt-0.5 block normal-case font-medium text-slate-400">Triliun rupiah</span></th>
                <th scope="col" class="min-w-64 px-4 py-3.5 font-semibold">Cakupan kurs</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredRows" :key="row.tahun" class="group border-b border-slate-100 transition-colors even:bg-slate-50/50 last:border-0 hover:bg-teal-50/60">
                <th scope="row" class="sticky left-0 z-[1] whitespace-nowrap bg-inherit px-4 py-4 font-semibold text-slate-800 shadow-[4px_0_8px_-6px_rgba(15,23,42,0.25)]">
                  <span class="inline-flex items-center gap-2">
                    {{ row.tahun }}
                    <span v-if="row.cakupanKurs?.parsial" class="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      Parsial
                    </span>
                  </span>
                </th>
                <td class="whitespace-nowrap px-4 py-4 text-right tabular-nums text-slate-700">
                  {{ formatAmount(row.transaksiJutaUSD, 0) }}
                </td>
                <td class="whitespace-nowrap px-4 py-4 text-right tabular-nums text-slate-700">
                  <span v-if="row.rataRataJisdor !== null && row.rataRataJisdor !== undefined">
                    {{ formatAmount(row.rataRataJisdor) }}
                  </span>
                  <span v-else aria-label="Belum tersedia" title="Belum tersedia" class="text-slate-400">—</span>
                </td>
                <td class="whitespace-nowrap px-4 py-4 text-right tabular-nums font-semibold">
                  <span
                    v-if="row.nilaiTriliunRupiah !== null && row.nilaiTriliunRupiah !== undefined"
                    :class="row.nilaiTriliunRupiah < 0 ? 'text-rose-700' : 'text-teal-700'"
                  >
                    {{ formatAmount(row.nilaiTriliunRupiah) }}
                  </span>
                  <span v-else aria-label="Belum tersedia" title="Belum tersedia" class="text-slate-400">—</span>
                </td>
                <td class="px-4 py-3.5">
                  <div v-if="row.triwulanKursTersedia.length" class="flex flex-wrap gap-1">
                    <span v-for="quarter in row.triwulanKursTersedia" :key="quarter" class="rounded-md border border-teal-100 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                      {{ quarter }}
                    </span>
                  </div>
                  <span v-else aria-label="Belum tersedia" title="Belum tersedia" class="text-slate-400">—</span>
                  <p v-if="row.jumlahObservasiKurs || row.cakupanKurs" class="mt-1.5 text-xs leading-5 text-slate-500">
                    <span>{{ row.jumlahObservasiKurs }} observasi</span>
                    <span v-if="row.cakupanKurs" class="block tabular-nums">
                      {{ row.cakupanKurs.tanggalAwal }} s.d. {{ row.cakupanKurs.tanggalAkhir }}
                    </span>
                  </p>
                </td>
              </tr>
              <tr v-if="!filteredRows.length">
                <td colspan="5" class="px-4 py-10 text-center text-sm text-slate-500">
                  Tidak ada data transaksi tahunan.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <details class="group overflow-hidden rounded-2xl border border-slate-200/80 border-t-2 border-t-teal-500 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-700">Transparansi kurs</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">Detail Kurs JISDOR per Kuartal</h2>
            <p class="mt-1 text-sm text-slate-500">
              Rata-rata kurs harian, cakupan observasi, dan transaksi kuartalan jika tersedia.
            </p>
          </div>
          <ChevronDown :size="19" class="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
        </summary>

        <div class="border-t border-slate-100 p-4 sm:p-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <p class="max-w-2xl text-sm leading-6 text-slate-500">
              Rata-rata tahunan tetap dihitung dari rata-rata kuartal yang tersedia dengan bobot sama. Nilai transaksi kuartalan hanya ditampilkan jika tercantum pada sumber.
            </p>
            <label class="block text-xs font-semibold text-slate-600 sm:min-w-44">
              Tahun yang diperiksa
              <select
                v-model="selectedDetailYear"
                class="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option v-for="year in detailYearOptions" :key="year" :value="String(year)">
                  {{ year }}
                </option>
              </select>
            </label>
          </div>

          <div class="mt-4 grid gap-2 sm:grid-cols-3">
            <article class="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Transaksi tahunan</p>
              <p class="mt-1.5 text-lg font-bold tabular-nums text-slate-900">
                {{ annualDetailRow ? formatAmount(annualDetailRow.transaksiJutaUSD, 0) : 'Tidak tersedia' }}
              </p>
              <p class="text-xs text-slate-500">Juta USD</p>
            </article>
            <article class="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rata-rata JISDOR tahunan</p>
              <p class="mt-1.5 text-lg font-bold tabular-nums text-slate-900">
                {{ formatAmount(annualRateDetail?.rataRataJisdor) }}
              </p>
              <p class="text-xs text-slate-500">
                IDR/USD<span v-if="annualRateDetail?.parsial"> · Parsial</span>
              </p>
            </article>
            <article class="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Konversi tahunan</p>
              <p class="mt-1.5 text-lg font-bold tabular-nums text-slate-900">
                {{ annualDetailRow ? formatAmount(annualDetailRow.nilaiTriliunRupiah) : 'Tidak tersedia' }}
              </p>
              <p class="text-xs text-slate-500">Triliun rupiah</p>
            </article>
          </div>

          <div class="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead class="bg-slate-50">
                <tr class="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <th scope="col" class="min-w-36 px-4 py-3.5 font-semibold">Kuartal</th>
                  <th scope="col" class="min-w-40 px-4 py-3.5 text-right font-semibold">Rata-rata JISDOR <span class="mt-0.5 block normal-case font-medium text-slate-400">IDR/USD</span></th>
                  <th scope="col" class="min-w-32 px-4 py-3.5 text-right font-semibold">Observasi harian</th>
                  <th scope="col" class="min-w-52 px-4 py-3.5 font-semibold">Rentang tanggal</th>
                  <th scope="col" class="min-w-36 px-4 py-3.5 font-semibold">Status kurs</th>
                  <th scope="col" class="min-w-40 px-4 py-3.5 text-right font-semibold">Transaksi <span class="mt-0.5 block normal-case font-medium text-slate-400">Juta USD</span></th>
                  <th scope="col" class="min-w-44 px-4 py-3.5 text-right font-semibold">Hasil konversi <span class="mt-0.5 block normal-case font-medium text-slate-400">Triliun rupiah</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in selectedQuarterRows" :key="row.periode" class="border-b border-slate-100 transition-colors even:bg-slate-50/50 last:border-0 hover:bg-teal-50/60">
                  <th scope="row" class="whitespace-nowrap px-4 py-3.5 font-semibold text-slate-800">
                    Q{{ row.triwulan }}
                    <span class="ml-1 text-xs font-normal text-slate-500">{{ quarterPeriods[row.triwulan - 1] }}</span>
                  </th>
                  <td class="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-slate-700">
                    {{ formatAmount(row.rataRataJisdor) }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-slate-700">
                    {{ row.jumlahObservasi ?? 'Tidak tersedia' }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3.5 text-xs tabular-nums text-slate-600">
                    {{ row.tanggalAwal && row.tanggalAkhir ? `${row.tanggalAwal} – ${row.tanggalAkhir}` : 'Tidak tersedia' }}
                  </td>
                  <td class="px-4 py-3.5">
                    <span
                      class="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                      :class="{
                        'border-emerald-200 bg-emerald-50 text-emerald-800': row.statusKurs === 'lengkap',
                        'border-amber-200 bg-amber-50 text-amber-800': row.statusKurs === 'parsial',
                        'border-slate-200 bg-slate-100 text-slate-600': row.statusKurs === 'tidak_tersedia'
                      }"
                    >
                      {{ row.statusKurs === 'lengkap' ? 'Lengkap' : row.statusKurs === 'parsial' ? 'Parsial' : 'Tidak tersedia' }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-slate-700">
                    {{ formatAmount(row.transaksiJutaUSD, 0) }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-3.5 text-right tabular-nums font-semibold text-slate-800">
                    {{ formatAmount(row.nilaiTriliunRupiah) }}
                  </td>
                </tr>
                <tr v-if="!selectedQuarterRows.length">
                  <td colspan="7" class="px-4 py-8 text-center text-sm text-slate-500">
                    Detail kurs kuartalan tidak tersedia.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <aside class="rounded-2xl border border-slate-200/80 border-t-2 border-t-teal-500 bg-white p-4 text-sm leading-6 text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
        <h2 class="font-semibold text-slate-900">Sumber dan metode</h2>
    
        <p class="mt-1">
          Sumber data kurs: {{ metadata?.kurs?.file || 'tabel_kurs.xlsx' }}, pada lembar
          Informasi Kurs JISDOR. Rata-rata triwulanan dihitung berdasarkan seluruh
          observasi harian yang valid, sedangkan rata-rata tahunan merupakan rata-rata
          sederhana dari rata-rata triwulanan yang tersedia.
        </p>
        <p class="mt-1">
          Nilai transaksi dalam rupiah dihitung dengan rumus: (nilai transaksi dalam
          juta USD × rata-rata JISDOR tahunan) ÷ 1.000.000. JISDOR digunakan sebagai
          kurs referensi.
        </p>
      </aside>
  </div>
</template>