<script setup>
import {
  computed,
  onMounted,
  ref
} from 'vue'

import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  LayoutDashboard
} from 'lucide-vue-next'

import logoBps from '../assets/logo.png'

import {
  getLandingOverview
} from '../services/dashboardApi'

const OVERVIEW_CACHE_KEY = 'bps-dashboard-landing-overview'

function readCachedOverview() {
  try {
    const cached = JSON.parse(
      localStorage.getItem(OVERVIEW_CACHE_KEY) || 'null'
    )

    return cached &&
      typeof cached === 'object' &&
      cached.latestPeriod &&
      Array.isArray(cached.nationalIndicators?.values)
      ? cached
      : null
  } catch {
    return null
  }
}

const cachedOverview = readCachedOverview()

const emit = defineEmits([
  'select-menu'
])

const loading = ref(!cachedOverview)
const error = ref('')
const refreshWarning = ref('')
const overviewResponse = ref(cachedOverview)
const dashboardOpening = ref(false)

const macroDefinitions = [
  {
    key: 'value-added',
    label: 'Nilai tambah bruto',
    classification: 'Nilai tambah bruto',
  },
  {
    key: 'national-income',
    label: 'Pendapatan nasional bruto',
    classification: 'Pendapatan nasional bruto (PNB)',
  },
  {
    key: 'disposable-income',
    label: 'Pendapatan disposabel bruto',
    classification: 'Pendapatan disposabel bruto',
  },
  {
    key: 'gross-saving',
    label: 'Tabungan bruto',
    classification: 'Tabungan bruto',
  }
]

const financialDefinitions = [
  {
    key: 'loans',
    label: 'Pinjaman',
    classification: 'Pinjaman',
  },
  {
    key: 'debt-securities',
    label: 'Surat berharga',
    classification: 'Surat berharga',
  },
  {
    key: 'equity',
    label: 'Penyertaan modal',
    classification: 'Penyertaan modal',
  }
]

function isValidNumber(value) {
  return value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value))
}

function formatIndicatorValue(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return '—'
  }

  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number)
}

const latestPeriodLabel = computed(() =>
  overviewResponse.value?.latestPeriod?.label || ''
)

const latestPeriodCaption = computed(() => {
  const period = overviewResponse.value?.latestPeriod

  if (!period) {
    return ''
  }

  return period.frequency === 'triwulanan'
    ? `Triwulan ${period.quarter} tahun ${period.year}`
    : `Tahun ${period.year}`
})

const unitLabel = computed(() =>
  overviewResponse.value?.unit?.label || ''
)

const latestClassificationRows = computed(() =>
  Array.isArray(overviewResponse.value?.nationalIndicators?.values)
    ? overviewResponse.value.nationalIndicators.values
    : []
)

function mapLatestIndicators(definitions) {
  return definitions.map(definition => {
    const row = latestClassificationRows.value.find(item =>
      String(item.klasifikasi ?? '').trim().toLocaleLowerCase('id-ID') ===
      definition.classification.toLocaleLowerCase('id-ID')
    )

    const available = Boolean(row && isValidNumber(row.nilai))

    return {
      ...definition,
      available,
      value: available ? Number(row.nilai) : null
    }
  })
}

const macroCards = computed(() =>
  mapLatestIndicators(macroDefinitions)
)

const financialCards = computed(() =>
  mapLatestIndicators(financialDefinitions)
)

const hasOverviewData = computed(() =>
  Boolean(latestPeriodLabel.value) ||
  latestClassificationRows.value.length > 0
)

async function loadOverview() {
  loading.value = !overviewResponse.value
  error.value = ''
  refreshWarning.value = ''

  try {
    const response = await getLandingOverview()
    overviewResponse.value = response

    try {
      localStorage.setItem(
        OVERVIEW_CACHE_KEY,
        JSON.stringify(response)
      )
    } catch {}
  } catch (requestError) {
    console.error('Gagal memuat landing statistik:', requestError)

    if (overviewResponse.value) {
      refreshWarning.value =
        'Pembaruan gagal. Data terakhir yang tersimpan tetap ditampilkan.'
    } else {
      error.value = requestError?.response?.data?.message ||
        'Ringkasan statistik belum dapat dimuat. Silakan coba lagi.'
    }
  } finally {
    loading.value = false
  }
}

function selectMenu(menu) {
  emit('select-menu', menu)
}

function openDashboard() {
  if (dashboardOpening.value) {
    return
  }

  dashboardOpening.value = true
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : 180

  window.setTimeout(() => {
    selectMenu('Dashboard')
  }, duration)
}

onMounted(loadOverview)
</script>

<template>
  <div :class="['landing-page min-h-screen overflow-hidden border-[3px] border-[#a9d4ff] bg-[linear-gradient(135deg,#091541_0%,#10215d_54%,#0a1745_100%)] text-white', { 'landing-page-exit': dashboardOpening }]">
    <main class="mx-auto flex min-h-[calc(100vh-6px)] max-w-[1440px] flex-col">
      <header class="flex flex-col gap-4 border-b border-white/15 bg-[#07133f]/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-9">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg shadow-black/20">
            <img :src="logoBps" alt="Logo Badan Pusat Statistik" class="h-full w-full object-contain" />
          </div>
          <div>
            <p class="text-xs font-extrabold tracking-wide text-white sm:text-sm">BADAN PUSAT STATISTIK</p>
            <p class="mt-0.5 text-[10px] text-blue-200 sm:text-xs">Sistem Neraca Sektoral Indonesia</p>
          </div>
        </div>

        <nav aria-label="Navigasi utama">
          <button type="button" :disabled="dashboardOpening" class="inline-flex items-center gap-2 rounded-lg bg-[#0f9388] px-4 py-2.5 text-[11px] font-bold text-white shadow-lg shadow-black/15 transition hover:bg-[#0d8078] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a4d3ff] disabled:cursor-wait sm:text-xs" @click="openDashboard">
            <LayoutDashboard :size="14" />
            {{ dashboardOpening ? 'Membuka…' : 'Buka Dashboard' }}
            <ArrowRight :size="14" />
          </button>
        </nav>
      </header>

      <section class="flex flex-col items-center px-4 pb-6 pt-8 text-center sm:px-8 sm:pb-8 sm:pt-10" aria-labelledby="landing-title">
        <p class="mb-2 inline-flex items-center gap-2 rounded-full border border-[#8fcaff]/30 bg-[#8fcaff]/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#b9dcff] sm:text-[10px]">
          <span class="h-1.5 w-1.5 rounded-full bg-[#7dd3fc]"></span>
          Statistik nasional · Pembaruan terkini
        </p>
        <h1 id="landing-title" class="max-w-4xl text-[27px] font-extrabold leading-tight text-white sm:text-[38px]">
          Neraca Sektoral Indonesia
          <span class="block text-[#9fd2ff]">dan Neraca Triwulanan</span>
        </h1>
        <p class="mt-2 max-w-xl text-xs leading-5 text-blue-100 sm:text-sm">
          Ringkasan indikator utama untuk memahami kondisi ekonomi nasional.
        </p>

        <div class="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#07133f]/45 px-3.5 py-2 text-[10px] text-blue-100 sm:text-xs">
          <CalendarDays :size="14" class="text-[#f3cf7a]" />
          <span v-if="loading">Memuat periode data…</span>
          <span v-else-if="latestPeriodCaption">Periode terbaru: <strong class="font-bold text-white">{{ latestPeriodCaption }}</strong></span>
          <span v-else>Periode terbaru belum tersedia</span>
        </div>

        <div class="mt-6 w-full max-w-[980px]">
          <div class="mb-3 flex flex-wrap items-end justify-between gap-2 text-left">
            <div>
              <p class="text-[9px] font-bold uppercase tracking-[0.14em] text-[#f3cf7a]">Total Ekonomi Nasional</p>
              <h2 class="mt-1 text-sm font-bold text-white sm:text-base">Indikator makroekonomi</h2>
            </div>
            <div class="text-right">
              <span v-if="unitLabel" class="text-[10px] text-blue-200 sm:text-xs">Satuan: {{ unitLabel }}</span>
              <p v-if="refreshWarning" class="mt-1 text-[9px] text-amber-200 sm:text-[10px]" role="status">{{ refreshWarning }}</p>
            </div>
          </div>

          <div v-if="loading" class="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div v-for="item in 4" :key="`macro-loading-${item}`" class="h-[104px] animate-pulse rounded-xl border border-white/20 bg-white/10 sm:h-[118px]"></div>
          </div>
          <div v-else-if="error" class="rounded-xl border border-rose-300/50 bg-rose-950/35 px-5 py-4 text-left text-sm text-rose-100" role="alert">
            <p class="font-bold">Ringkasan statistik belum tersedia</p>
            <p class="mt-1">{{ error }}</p>
            <button type="button" class="mt-2 font-semibold underline underline-offset-2" @click="loadOverview">Coba lagi</button>
          </div>
          <div v-else-if="!hasOverviewData" class="rounded-xl border border-white/15 bg-white/5 px-5 py-8 text-sm text-blue-100">
            Indikator nasional belum tersedia untuk periode terbaru.
          </div>
          <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <article v-for="(card, index) in macroCards" :key="card.key" class="group flex min-h-[104px] flex-col justify-between rounded-xl border border-white/50 bg-[#eaf4ff] p-3 text-left text-[#101a35] shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-1 hover:bg-white sm:min-h-[118px] sm:p-4">
              <div class="flex items-start justify-between gap-2">
                <span class="text-[9px] font-bold uppercase tracking-[0.1em] text-[#526985]">Indikator 0{{ index + 1 }}</span>
                <span class="h-2 w-2 rounded-full bg-[#168ac4] ring-4 ring-[#168ac4]/10"></span>
              </div>
              <div>
                <p class="whitespace-nowrap text-[21px] font-extrabold leading-none tabular-nums sm:text-[28px]">{{ card.available ? formatIndicatorValue(card.value) : 'Belum tersedia' }}</p>
                <p class="mt-2 text-[10px] font-bold leading-tight text-[#334866] sm:text-xs">{{ card.label }}</p>
              </div>
            </article>
          </div>
        </div>

        <div v-if="loading" class="mt-5 grid w-full max-w-[650px] grid-cols-3 gap-3 sm:gap-4">
          <div v-for="item in 3" :key="`financial-loading-${item}`" class="h-[86px] animate-pulse rounded-xl border border-white/10 bg-[#1c4381]/70"></div>
        </div>
        <div v-else-if="!error && hasOverviewData" class="mt-5 w-full max-w-[650px]">
          <div class="mb-2 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[0.13em] text-blue-200 sm:text-[10px]">
            <span class="h-px w-8 bg-white/20"></span>Instrumen keuangan<span class="h-px w-8 bg-white/20"></span>
          </div>
          <div class="grid grid-cols-3 gap-3 sm:gap-4">
            <article v-for="card in financialCards" :key="card.key" class="flex min-h-[86px] flex-col justify-center rounded-xl border border-white/15 bg-[#153b76]/85 px-2 py-3 text-white shadow-[0_8px_18px_rgba(0,0,0,0.15)] transition duration-200 hover:-translate-y-1 hover:border-[#9fd2ff]/50 hover:bg-[#1b4b8d] sm:min-h-[96px] sm:px-3">
              <component :is="card.icon" :size="15" class="mx-auto mb-2 text-[#f3cf7a]" />
              <p class="whitespace-nowrap text-[18px] font-extrabold leading-none tabular-nums sm:text-[24px]">{{ card.available ? formatIndicatorValue(card.value) : 'Belum tersedia' }}</p>
              <p class="mt-2 text-[9px] font-semibold leading-tight text-blue-100 sm:text-[11px]">{{ card.label }}</p>
            </article>
          </div>
        </div>
      </section>

      <section class="border-y border-white/15 bg-[#07133f]/35 px-5 py-5 sm:px-10 sm:py-6" aria-labelledby="guide-title">
        <div class="mx-auto max-w-[1180px]">
          <div class="mb-4 flex items-center gap-2.5">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3cf7a]/15 text-[#f3cf7a]">
              <BookOpen :size="16" />
            </div>
            <div>
              <p class="text-[9px] font-bold uppercase tracking-[0.14em] text-blue-200">Mulai eksplorasi</p>
              <h2 id="guide-title" class="text-base font-extrabold text-white sm:text-lg">Panduan penggunaan</h2>
            </div>
          </div>
          <ol class="grid gap-4 md:grid-cols-3 md:gap-6">
            <li class="flex gap-3 border-l-2 border-[#75bfff] pl-3">
              <span class="text-lg font-extrabold leading-none text-[#9fd2ff]">01</span>
              <p class="text-[11px] leading-5 text-blue-50 sm:text-xs">Jelajahi Dashboard Sektoral, Deret Waktu, dan Analisis Rasio.</p>
            </li>
            <li class="flex gap-3 border-l-2 border-[#f3cf7a] pl-3">
              <span class="text-lg font-extrabold leading-none text-[#f3cf7a]">02</span>
              <p class="text-[11px] leading-5 text-blue-50 sm:text-xs">Atur filter periode dan kategori untuk menentukan data yang ditampilkan.</p>
            </li>
            <li class="flex gap-3 border-l-2 border-[#68d4c2] pl-3">
              <span class="text-lg font-extrabold leading-none text-[#68d4c2]">03</span>
              <p class="text-[11px] leading-5 text-blue-50 sm:text-xs">Sesuaikan pilihan filter dengan kebutuhan analisis Anda.</p>
            </li>
          </ol>
        </div>
      </section>

      <footer class="mt-auto flex flex-col gap-3 px-5 py-4 text-center sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:text-left">
        <p class="text-[10px] text-blue-200">Data neraca sektoral · {{ latestPeriodLabel || 'Periode terbaru' }}</p>
        <div class="flex items-center justify-center gap-2 text-[11px] font-bold text-[#b9dcff] sm:justify-end sm:text-xs">
          <img :src="logoBps" alt="" class="h-8 w-8 object-contain" />
          <span>SALAM, TIM SAB · BADAN PUSAT STATISTIK</span>
        </div>
      </footer>
    </main>
  </div>
</template>

<style>
.landing-page-exit {
  animation: landing-page-exit 180ms ease-in forwards;
  pointer-events: none;
}

@keyframes landing-page-exit {
  to {
    opacity: 0;
    transform: translateY(-10px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-page-exit {
    animation-duration: 1ms;
  }
}
</style>
