<script setup>
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue'
import {
  Activity,
  ArchiveRestore,
  ArrowDownToLine,
  Check,
  ChevronDown,
  Clock3,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  History,
  LoaderCircle,
  RotateCw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X
} from 'lucide-vue-next'
import VersionComparisonPanel from '../components/data-management/VersionComparisonPanel.vue'
import SectorPreviewSummary from '../components/data-management/SectorPreviewSummary.vue'
import {
  cancelImportBatch,
  confirmImportBatch,
  detectWorkbookUpload,
  downloadDatasetTemplate,
  getAuditTrail,
  getImportBatch,
  getImportBatches,
  getManagementSummary,
  getVersionDetail,
  getVersions,
  previewDatasetUpload,
  restoreVersion,
  retryDashboardRefresh,
  softDeleteVersion
} from '../services/dataManagementApi'
import { formatDisplayNumber, formatNullableDecimal } from '../utils/displayFormatters.js'

const tabs = [
  { id: 'overview', label: 'Ringkasan', icon: Database },
  { id: 'upload', label: 'Upload Excel', icon: Upload },
  { id: 'previews', label: 'Kelola Preview', icon: ClipboardCheck },
  { id: 'versions', label: 'Riwayat Versi', icon: History },
  { id: 'audit', label: 'Aktivitas', icon: Activity }
]

const datasetLabels = {
  tahunan: 'Karakteristik Tahunan',
  triwulanan_1: 'Karakteristik Triwulanan',
  triwulanan_2: 'Karakteristik Triwulanan',
  analisis_rasio: 'Analisis Rasio',
  banding_makro: 'Banding Makro'
}
const datasetColumnCounts = {
  tahunan: 10,
  triwulanan_1: 10,
  triwulanan_2: 10,
  analisis_rasio: 6
}
const versionSampleColumns = {
  tahunan: [
    ['sektor', 'Sektor'], ['period', 'Periode'], ['sisi', 'Sisi'],
    ['jenis_neraca', 'Jenis neraca'], ['kode', 'Kode'], ['rincian', 'Rincian'],
    ['neraca_rincian', 'Neraca - rincian'], ['nilai', 'Nilai'],
    ['nilai_raw', 'Nilai sumber'], ['value_status', 'Status nilai'], ['konsep', 'Konsep']
  ],
  triwulanan_1: [
    ['sektor', 'Sektor'], ['period', 'Periode'], ['sisi', 'Sisi'],
    ['jenis_neraca', 'Jenis neraca'], ['kode', 'Kode'], ['rincian', 'Rincian'],
    ['neraca_rincian', 'Neraca - rincian'], ['nilai', 'Nilai'],
    ['nilai_raw', 'Nilai sumber'], ['value_status', 'Status nilai'], ['konsep', 'Konsep']
  ],
  triwulanan_2: [
    ['sektor', 'Sektor'], ['period', 'Periode'], ['sisi', 'Sisi'],
    ['jenis_neraca', 'Jenis neraca'], ['kode', 'Kode'], ['rincian', 'Rincian'],
    ['neraca_rincian', 'Neraca - rincian'], ['nilai', 'Nilai'],
    ['nilai_raw', 'Nilai sumber'], ['value_status', 'Status nilai'], ['konsep', 'Konsep']
  ],
  analisis_rasio: [
    ['sektor', 'Sektor'], ['period', 'Periode'], ['jenis_rasio', 'Jenis rasio'],
    ['kode', 'Kode'], ['rincian', 'Rincian'], ['nilai', 'Nilai'],
    ['nilai_raw', 'Nilai sumber'], ['value_status', 'Status nilai']
  ],
  banding_makro: [
    ['period', 'Periode'], ['transaksi', 'Transaksi'],
    ['transaksi_raw', 'Nilai sumber'], ['value_status', 'Status nilai']
  ]
}

const uploadableDatasetKeys = computed(() =>
  summary.value?.import_capabilities
    ?.filter(capability => capability.available)
    .map(capability => capability.dataset_key) || []
)
const importMode = 'replace_period'

const isQuarterlyDataset = computed(() =>
  ['triwulanan_1', 'triwulanan_2'].includes(selectedDataset.value) ||
  (selectedDataset.value === 'analisis_rasio' && selectedRatioFrequency.value === 'quarterly')
)
const previewDisplayHeaders = computed(() => selectedDataset.value === 'analisis_rasio'
  ? ['SEKTOR', 'TAHUN', 'JENIS RASIO', 'KODE', 'RINCIAN', 'NILAI']
  : ['SEKTOR', 'TAHUN', 'SISI', 'JENIS NERACA', 'KODE', 'RINCIAN', 'NERACA - RINCIAN', 'STATUS NILAI', 'NILAI', 'KONSEP'])
const managedPreviewDisplayHeaders = computed(() => {
  const datasetKey = pendingPreviewDetail.value?.batch.dataset_key
  if (datasetKey === 'analisis_rasio') return ['SEKTOR', 'TAHUN', 'JENIS RASIO', 'KODE', 'RINCIAN', 'NILAI']
  return ['SEKTOR', 'TAHUN', 'SISI', 'JENIS NERACA', 'KODE', 'RINCIAN', 'NERACA - RINCIAN', 'STATUS NILAI', 'NILAI', 'KONSEP']
})
const batchDetailDisplayHeaders = computed(() => {
  const datasetKey = batchDetail.value?.batch.dataset_key
  if (datasetKey === 'analisis_rasio') return ['SEKTOR', 'TAHUN', 'JENIS RASIO', 'KODE', 'RINCIAN', 'NILAI']
  return ['SEKTOR', 'TAHUN', 'SISI', 'JENIS NERACA', 'KODE', 'RINCIAN', 'NERACA - RINCIAN', 'STATUS NILAI', 'NILAI', 'KONSEP']
})

const previewTokenStorageKey = 'bps-data-management-preview-tokens'

function readPreviewTokens() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(previewTokenStorageKey) || '{}')
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
  } catch {
    return {}
  }
}

function writePreviewToken(batchId, token) {
  const updated = { ...previewTokens.value, [String(batchId)]: token }
  previewTokens.value = updated
  try {
    sessionStorage.setItem(previewTokenStorageKey, JSON.stringify(updated))
  } catch {
    pageError.value = 'Token preview tidak dapat disimpan di sesi browser ini.'
  }
}

function removePreviewToken(batchId) {
  const updated = { ...previewTokens.value }
  delete updated[String(batchId)]
  previewTokens.value = updated
  try {
    sessionStorage.setItem(previewTokenStorageKey, JSON.stringify(updated))
  } catch {
    // The current in-memory session remains usable if storage is unavailable.
  }
}

const StatusBadge = defineComponent({
  props: { status: { type: String, default: '' } },
  setup(props) {
    return () => {
      const labelMap = {
        active: 'Aktif',
        valid: 'Valid',
        confirmed: 'Diterima',
        approved: 'Disetujui',
        warning: 'Peringatan',
        previewed: 'Menunggu review',
        uploaded: 'Terkirim',
        invalid: 'Invalid',
        failed: 'Gagal',
        deleted: 'Dihapus',
        superseded: 'Digantikan',
        expired: 'Kedaluwarsa',
        updated: 'Nilai berubah',
        increased: 'Meningkat',
        decreased: 'Menurun',
        newly_filled: 'Baru terisi',
        newly_emptied: 'Dikosongkan',
        metadata_updated: 'Metadata berubah',
        added: 'Ditambahkan',
        removed: 'Dihapus',
        cancelled: 'Ditolak',
        processing: 'Diproses',
        rejected: 'Ditolak',
        imported: 'Diimport',
        pending_review: 'Menunggu review'
      }
      const tone = {
        active: 'bg-emerald-100 text-emerald-800',
        valid: 'bg-emerald-100 text-emerald-800',
        confirmed: 'bg-emerald-100 text-emerald-800',
        approved: 'bg-emerald-100 text-emerald-800',
        warning: 'bg-amber-100 text-amber-800',
        previewed: 'bg-amber-100 text-amber-800',
        pending_review: 'bg-amber-100 text-amber-800',
        uploaded: 'bg-sky-100 text-sky-800',
        invalid: 'bg-rose-100 text-rose-800',
        failed: 'bg-rose-100 text-rose-800',
        deleted: 'bg-rose-100 text-rose-800',
        superseded: 'bg-slate-100 text-slate-700',
        expired: 'bg-slate-100 text-slate-700',
        updated: 'bg-amber-100 text-amber-800',
        increased: 'bg-emerald-100 text-emerald-800',
        decreased: 'bg-rose-100 text-rose-800',
        newly_filled: 'bg-sky-100 text-sky-800',
        newly_emptied: 'bg-amber-100 text-amber-800',
        metadata_updated: 'bg-slate-100 text-slate-700',
        added: 'bg-emerald-100 text-emerald-800',
        removed: 'bg-rose-100 text-rose-800',
        cancelled: 'bg-rose-100 text-rose-800',
        rejected: 'bg-rose-100 text-rose-800',
        imported: 'bg-emerald-100 text-emerald-800',
        processing: 'bg-sky-100 text-sky-800'
      }[props.status] || 'bg-slate-100 text-slate-700'
      return h('span', {
        class: `inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${tone}`
      }, labelMap[props.status] || props.status || 'unknown')
    }
  }
})

const PaginationBar = defineComponent({
  props: {
    page: { type: Number, default: 1 },
    totalPages: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  emits: ['change'],
  setup(props, { emit }) {
    return () => h('div', {
      class: 'flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500'
    }, [
      h('span', `${props.total} baris · halaman ${props.page} dari ${props.totalPages || 1}`),
      h('div', { class: 'flex gap-2' }, [
        h('button', {
          type: 'button',
          class: 'rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40',
          disabled: props.page <= 1,
          onClick: () => emit('change', props.page - 1)
        }, 'Sebelumnya'),
        h('button', {
          type: 'button',
          class: 'rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40',
          disabled: props.page >= props.totalPages,
          onClick: () => emit('change', props.page + 1)
        }, 'Berikutnya')
      ])
    ])
  }
})

const HistoryFilters = defineComponent({
  props: {
    dataset: { type: String, default: '' },
    year: { type: String, default: '' },
    status: { type: String, default: '' },
    search: { type: String, default: '' },
    sort: { type: String, default: 'newest' },
    showStatus: { type: Boolean, default: false },
    showSort: { type: Boolean, default: false }
  },
  emits: ['update:dataset', 'update:year', 'update:status', 'update:search', 'update:sort'],
  setup(props, { emit }) {
    const datasets = [
      ['tahunan', 'Karakteristik Tahunan'],
      ['triwulanan_1', 'Karakteristik Triwulanan 1'],
      ['triwulanan_2', 'Karakteristik Triwulanan 2'],
      ['analisis_rasio', 'Analisis Rasio'],
      ['banding_makro', 'Banding Makro']
    ]
    const selectClass = 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm'

    return () => h('div', {
      class: 'flex flex-col gap-3 border-y border-slate-200 bg-white p-3 sm:flex-row sm:flex-wrap'
    }, [
      h('select', {
        class: selectClass,
        value: props.dataset,
        'aria-label': 'Filter dataset',
        onChange: event => emit('update:dataset', event.target.value)
      }, [
        h('option', { value: '' }, 'Semua dataset'),
        ...datasets.map(([value, label]) => h('option', { value }, label))
      ]),
      h('input', {
        class: `${selectClass} w-36`,
        type: 'number',
        min: 1900,
        max: 2200,
        placeholder: 'Semua tahun',
        value: props.year,
        'aria-label': 'Filter tahun',
        onInput: event => emit('update:year', event.target.value)
      }),
      h('input', {
        class: `${selectClass} min-w-48 flex-1`,
        type: 'search',
        placeholder: 'Cari periode, file, alasan...',
        value: props.search,
        'aria-label': 'Cari riwayat versi dan aktivitas',
        onInput: event => emit('update:search', event.target.value),
        onKeydown: event => {
          if (event.key === 'Enter') event.preventDefault()
        },
        onSearch: event => event.preventDefault()
      }),
      props.showSort
        ? h('select', {
            class: selectClass,
            value: props.sort,
            'aria-label': 'Urutkan riwayat versi',
            onChange: event => emit('update:sort', event.target.value)
          }, [
            h('option', { value: 'newest' }, 'Terbaru diperbarui'),
            h('option', { value: 'oldest' }, 'Terlama diperbarui'),
            h('option', { value: 'period' }, 'Periode terbaru')
          ])
        : null,
      props.showStatus
        ? h('select', {
            class: selectClass,
            value: props.status,
            'aria-label': 'Filter status versi',
            onChange: event => emit('update:status', event.target.value)
          }, [
            h('option', { value: '' }, 'Semua status'),
            ...['active', 'superseded', 'deleted'].map(status => h('option', { value: status }, status))
          ])
        : null
    ])
  }
})

const activeTab = ref('overview')
const summary = ref(null)
const batches = ref([])
const versions = ref([])
const auditEvents = ref([])
const loading = ref(false)
const pageError = ref('')
const successMessage = ref('')
const refreshPending = ref(false)

const datasetFilter = ref('')
const yearFilter = ref('')
const statusFilter = ref('')
const historySearch = ref('')
const versionSort = ref('newest')
const batchSearch = ref('')
const historyPage = ref(1)
const historyLimit = 25
const historyPagination = ref({ total: 0, total_pages: 0 })
let historyFilterTimer = null
let previewFilterTimer = null

const selectedDataset = ref('tahunan')
const selectedQuarter = ref('')
const selectedRatioFrequency = ref('annual')
const selectedYear = ref(String(new Date().getFullYear()))
const selectedFile = ref(null)
const fileInput = ref(null)
const uploadProgress = ref(0)
const uploading = ref(false)
const uploadError = ref('')
const preview = ref(null)
const previewRows = ref([])
const previewCounts = ref({ valid: 0, warning: 0, invalid: 0 })
const previewFilter = ref('')
const previewSearch = ref('')
const previewPage = ref(1)
const previewPagination = ref({ total: 0, total_pages: 0 })
const workbookDetection = ref(null)
const workbookDatasetChoices = ref({})
const workbookQuarterChoices = ref({})
const workbookPreviewResults = ref([])
const workbookGroupId = ref('')
const workbookDetectionBusy = ref(false)
const previewTokens = ref(readPreviewTokens())
const pendingPreviews = ref([])
const pendingPreviewPagination = ref({ total: 0, total_pages: 0 })
const pendingPreviewPage = ref(1)
const pendingPreviewLoading = ref(false)
const pendingPreviewDetail = ref(null)
const pendingPreviewRows = ref([])
const pendingPreviewCounts = ref({ valid: 0, warning: 0, invalid: 0 })
const pendingPreviewDetailPage = ref(1)
const pendingPreviewBusy = ref(false)
const batchDetail = ref(null)
const batchDetailPage = ref(1)
const batchDetailBusy = ref(false)

const showConfirmDialog = ref(false)
const confirmConsent = ref(false)
const confirmReason = ref('')
const confirming = ref(false)
const actionDialog = ref(null)
const actionReason = ref('')
const actionBusy = ref(false)
const cancelBatchDialog = ref(null)
const cancelBatchReason = ref('')
const cancelBatchError = ref('')
const cancelBatchBusy = ref(false)
const versionDetail = ref(null)
const versionDetailBusy = ref(false)
const versionSampleTable = ref(null)
const versionSampleTableScroll = ref(null)
const versionSampleRail = ref(null)
const versionSampleContentWidth = ref(0)
const versionSampleHasOverflow = ref(false)
const versionSampleDisplayColumns = computed(() => {
  const rows = versionDetail.value?.sample_rows || []
  const fields = new Set(rows.flatMap(row => Object.keys(row)))
  const configured = versionSampleColumns[versionDetail.value?.version.dataset_key] || []
  const columns = configured.filter(([key]) => fields.has(key))
  const extraColumns = [...fields]
    .filter(key => !configured.some(([configuredKey]) => configuredKey === key))
    .map(key => [key, key.replaceAll('_', ' ')])

  return [...columns, ...extraColumns]
})
const hasOpenDialog = computed(() => Boolean(
  versionDetail.value ||
  versionDetailBusy.value ||
  batchDetail.value ||
  (preview.value && showConfirmDialog.value) ||
  actionDialog.value ||
  cancelBatchDialog.value
))
let previousDocumentOverflow = ''
let previousBodyOverflow = ''
let bodyScrollLocked = false

const currentDataset = computed(() =>
  summary.value?.datasets?.find(item => item.dataset_key === selectedDataset.value) || null
)

const currentActiveVersion = computed(() =>
  versions.value.find(version =>
    version.dataset_key === selectedDataset.value &&
    Number(version.year) === Number(selectedYear.value) &&
    version.quarter === (isQuarterlyDataset.value ? Number(selectedQuarter.value) : null) &&
    version.status === 'active'
  ) || null
)

const currentPeriodHasActiveVersion = computed(() => Boolean(currentActiveVersion.value))

const canConfirmImport = computed(() =>
  preview.value &&
  preview.value.preview_token &&
  Boolean(pendingPreviewDetail.value?.comparison) &&
  Number(preview.value.valid_rows) > 0 &&
  Number(preview.value.invalid_rows) === 0 &&
  preview.value.status === 'previewed' &&
  new Date(preview.value.expires_at).getTime() > Date.now() &&
  confirmConsent.value
)

const canApproveManagedPreview = computed(() => {
  const batch = pendingPreviewDetail.value?.batch
  const token = batch && previewTokens.value[String(batch.id)]
  return Boolean(
    batch?.status === 'previewed' &&
    Boolean(pendingPreviewDetail.value?.comparison) &&
    uploadableDatasetKeys.value.includes(batch.dataset_key) &&
    batch.period_type === (batch.dataset_key.startsWith('triwulanan_') || (batch.dataset_key === 'analisis_rasio' && batch.quarter !== null) ? 'quarterly' : 'annual') &&
    token &&
    Number(batch.valid_rows) > 0 &&
    Number(batch.invalid_rows) === 0 &&
    new Date(batch.preview_expires_at).getTime() > Date.now()
  )
})

function workbookQuarterChoiceKey(sheetName, periodKey) {
  return `${sheetName}|${periodKey}`
}

const canPreviewDetectedWorkbook = computed(() => {
  const eligible = workbookDetection.value?.sheets?.filter(sheet =>
    ['detected', 'needs_dataset_choice'].includes(sheet.status)
  ) || []
  if (!eligible.length) return false

  return eligible.every(sheet => {
    const datasetKey = sheet.dataset_key || workbookDatasetChoices.value[sheet.sheet_name]
    if (!datasetKey || !sheet.periods?.length) return false
    return sheet.periods.every(period => {
      if (!period.requires_quarter) return true
      return /^[1-4]$/.test(String(
        workbookQuarterChoices.value[workbookQuarterChoiceKey(sheet.sheet_name, period.period_key)] || ''
      ))
    })
  })
})

const detailPageCount = computed(() => previewPagination.value.total_pages || 1)

function updateVersionSampleMetrics() {
  const table = versionSampleTable.value
  const tableScroll = versionSampleTableScroll.value
  const rail = versionSampleRail.value
  if (!table || !tableScroll) return

  versionSampleContentWidth.value = table.scrollWidth
  versionSampleHasOverflow.value = table.scrollWidth > tableScroll.clientWidth + 1
  if (!versionSampleHasOverflow.value) {
    tableScroll.scrollLeft = 0
    if (rail) rail.scrollLeft = 0
  }
}

function syncVersionSampleScroll(source) {
  const tableScroll = versionSampleTableScroll.value
  const rail = versionSampleRail.value
  if (!tableScroll || !rail) return

  const from = source === 'rail' ? rail : tableScroll
  const to = source === 'rail' ? tableScroll : rail
  if (Math.abs(from.scrollLeft - to.scrollLeft) > 1) {
    to.scrollLeft = from.scrollLeft
  }
}

async function refreshVersionSampleMetrics() {
  await nextTick()
  updateVersionSampleMetrics()
}

watch(versionDetail, async detail => {
  if (!detail) {
    versionSampleHasOverflow.value = false
    versionSampleContentWidth.value = 0
    return
  }
  await nextTick()
  updateVersionSampleMetrics()
})

function formatDate(value) {
  if (!value) return 'Belum tersedia'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Belum tersedia'
    : new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date)
}

function formatPeriod(item) {
  if (!item || item.year === null || item.year === undefined) return 'Belum tersedia'
  return item.period_type === 'quarterly'
    ? `${item.year}/Q${item.quarter}`
    : String(item.year)
}

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

async function loadSummary() {
  const response = await getManagementSummary()
  summary.value = response.data
}

async function loadBatches() {
  const response = await getImportBatches({
    page: historyPage.value,
    limit: historyLimit,
    dataset_key: datasetFilter.value || undefined,
    year: yearFilter.value || undefined,
    status: statusFilter.value || undefined,
    search: batchSearch.value || undefined
  })
  batches.value = response.data || []
  historyPagination.value = response.pagination || { total: 0, total_pages: 0 }
}

async function loadPendingPreviews(page = 1) {
  pendingPreviewLoading.value = true
  pageError.value = ''
  try {
    const response = await getImportBatches({ page, limit: 25, status: 'previewed' })
    pendingPreviews.value = response.data || []
    pendingPreviewPagination.value = response.pagination || { total: 0, total_pages: 0 }
    pendingPreviewPage.value = page
    if (pendingPreviewDetail.value && !pendingPreviews.value.some(batch => batch.id === pendingPreviewDetail.value.batch.id)) {
      pendingPreviewDetail.value = null
      pendingPreviewRows.value = []
    }
  } catch (error) {
    pageError.value = errorMessage(error, 'Daftar preview belum dapat dimuat.')
  } finally {
    pendingPreviewLoading.value = false
  }
}

async function loadVersions() {
  const response = await getVersions({
    page: historyPage.value,
    limit: historyLimit,
    dataset_key: datasetFilter.value || undefined,
    year: yearFilter.value || undefined,
    status: statusFilter.value || undefined,
    search: historySearch.value || undefined,
    sort: versionSort.value
  })
  versions.value = response.data || []
  historyPagination.value = response.pagination || { total: 0, total_pages: 0 }
}

async function loadAudit() {
  const response = await getAuditTrail({
    page: historyPage.value,
    limit: historyLimit,
    dataset_key: datasetFilter.value || undefined,
    year: yearFilter.value || undefined,
    search: historySearch.value || undefined
  })
  auditEvents.value = response.data || []
  historyPagination.value = response.pagination || { total: 0, total_pages: 0 }
}

async function loadActiveTab({ preserveContent = false } = {}) {
  if (!preserveContent) loading.value = true
  pageError.value = ''
  try {
    if (activeTab.value === 'overview') {
      await Promise.all([loadSummary(), loadBatches()])
    } else if (activeTab.value === 'versions') {
      await loadVersions()
    } else if (activeTab.value === 'previews') {
      await loadPendingPreviews()
    } else if (activeTab.value === 'audit') {
      await loadAudit()
    }
  } catch (error) {
    pageError.value = errorMessage(error, 'Data manajemen belum dapat dimuat.')
  } finally {
    if (!preserveContent) loading.value = false
  }
}

onMounted(() => {
  loadActiveTab()
  window.addEventListener('resize', updateVersionSampleMetrics)
})

watch(hasOpenDialog, isOpen => {
  if (typeof document === 'undefined') return
  if (isOpen) {
    previousDocumentOverflow = document.documentElement.style.overflow
    previousBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    bodyScrollLocked = true
  } else if (bodyScrollLocked) {
    document.documentElement.style.overflow = previousDocumentOverflow
    document.body.style.overflow = previousBodyOverflow
    bodyScrollLocked = false
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (historyFilterTimer) window.clearTimeout(historyFilterTimer)
  if (previewFilterTimer) window.clearTimeout(previewFilterTimer)
  window.removeEventListener('resize', updateVersionSampleMetrics)
  if (typeof document !== 'undefined' && bodyScrollLocked) {
    document.documentElement.style.overflow = previousDocumentOverflow
    document.body.style.overflow = previousBodyOverflow
    bodyScrollLocked = false
  }
})

watch(activeTab, () => {
  historyPage.value = 1
  loadActiveTab()
})

watch([datasetFilter, yearFilter, statusFilter, historySearch, batchSearch, versionSort], () => {
  if (historyFilterTimer) window.clearTimeout(historyFilterTimer)
  historyFilterTimer = window.setTimeout(() => {
    historyPage.value = 1
    if (['overview', 'versions', 'audit'].includes(activeTab.value)) {
      loadActiveTab({ preserveContent: true })
    }
  }, 220)
})

watch([selectedYear, selectedDataset, selectedQuarter, selectedRatioFrequency], async ([value, datasetKey]) => {
  if (!/^\d{4}$/.test(value)) return
  try {
    const response = await getVersions({
      dataset_key: datasetKey,
      year: value,
      limit: 100
    })
    versions.value = response.data || []
  } catch {
    versions.value = []
  }
}, { immediate: true })

function showSuccess(message) {
  successMessage.value = message
  pageError.value = ''
}

function getFile(event) {
  const file = event.target.files?.[0] || null
  setSelectedFile(file)
  event.target.value = ''
}

function setSelectedFile(file) {
  uploadError.value = ''
  preview.value = null
  previewRows.value = []
  previewCounts.value = { valid: 0, warning: 0, invalid: 0 }
  workbookDetection.value = null
  workbookDatasetChoices.value = {}
  workbookQuarterChoices.value = {}
  workbookPreviewResults.value = []
  workbookGroupId.value = ''
  uploadProgress.value = 0

  if (!file) {
    selectedFile.value = null
    return
  }

  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    selectedFile.value = null
    uploadError.value = 'Pilih file Excel dengan ekstensi .xlsx.'
    return
  }

  if (file.size > 15 * 1024 * 1024) {
    selectedFile.value = null
    uploadError.value = 'Ukuran file maksimal 15 MB.'
    return
  }

  selectedFile.value = file
}

function handleDrop(event) {
  const file = event.dataTransfer?.files?.[0]
  if (file) setSelectedFile(file)
}

async function handleDownloadTemplate() {
  uploadError.value = ''
  try {
    const blob = await downloadDatasetTemplate(
      selectedDataset.value,
      selectedYear.value,
      isQuarterlyDataset.value ? Number(selectedQuarter.value) : null
    )
    const url = URL.createObjectURL(blob)
    const fileName = 'TEMPLATE INPUT DATA.xlsx'
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    uploadError.value = errorMessage(error, 'Template belum dapat diunduh.')
  }
}

async function loadPreviewPage(page = 1) {
  if (!preview.value?.batch_id) return
  previewPage.value = page
  const response = await getImportBatch(preview.value.batch_id, {
    page,
    limit: 25,
    validation_status: previewFilter.value || undefined,
    search: previewSearch.value || undefined
  })
  const detail = response.data
  previewRows.value = detail.rows || []
  previewCounts.value = {
    valid: Number(detail.validation_counts?.valid || 0),
    warning: Number(detail.validation_counts?.warning || 0),
    invalid: Number(detail.validation_counts?.invalid || 0)
  }
  previewPagination.value = detail.pagination || { total: 0, total_pages: 0 }
}

async function openBatchDetail(batch, page = 1) {
  batchDetailBusy.value = true
  try {
    const response = await getImportBatch(batch.id, { page, limit: 25 })
    batchDetail.value = response.data
    batchDetailPage.value = page
  } catch (error) {
    pageError.value = errorMessage(error, 'Detail batch gagal dimuat.')
  } finally {
    batchDetailBusy.value = false
  }
}

async function openManagedPreview(batch, page = 1, comparisonPage = 1) {
  pendingPreviewBusy.value = true
  pageError.value = ''
  try {
    const response = await getImportBatch(batch.id, {
      page,
      limit: 25,
      comparison_page: comparisonPage,
      comparison_limit: 25
    })
    const detail = response.data
    pendingPreviewDetail.value = detail
    selectedDataset.value = detail.batch.dataset_key
    selectedYear.value = String(detail.batch.year)
    selectedQuarter.value = detail.batch.quarter === null || detail.batch.quarter === undefined
      ? ''
      : String(detail.batch.quarter)
    selectedRatioFrequency.value = detail.batch.period_type
    selectedFile.value = null
    pendingPreviewRows.value = detail.rows || []
    pendingPreviewCounts.value = {
      valid: Number(detail.validation_counts?.valid || 0),
      warning: Number(detail.validation_counts?.warning || 0),
      invalid: Number(detail.validation_counts?.invalid || 0)
    }
    pendingPreviewDetailPage.value = page
    const token = previewTokens.value[String(detail.batch.id)] || ''
    preview.value = {
      batch_id: detail.batch.id,
      preview_token: token,
      dataset_key: detail.batch.dataset_key,
      year: detail.batch.year,
      total_rows: Number(detail.batch.total_rows),
      original_filename: detail.batch.original_filename,
      valid_rows: pendingPreviewCounts.value.valid,
      warning_rows: pendingPreviewCounts.value.warning,
      invalid_rows: pendingPreviewCounts.value.invalid,
      expires_at: detail.batch.preview_expires_at,
      status: detail.batch.status,
      comparison: detail.comparison,
      sector_summary: detail.sector_summary,
      workbook_group_id: detail.batch.workbook_group_id
    }
  } catch (error) {
    pageError.value = errorMessage(error, 'Detail preview gagal dimuat.')
  } finally {
    pendingPreviewBusy.value = false
  }
}

async function openWorkbookChildPreview(result) {
  if (!result?.batch_id) return
  await openManagedPreview({ id: result.batch_id })
  activeTab.value = 'previews'
}

function openCancelBatch(batch) {
  cancelBatchReason.value = ''
  cancelBatchError.value = ''
  cancelBatchDialog.value = {
    ...batch,
    action: batch.status === 'previewed' ? 'reject' : 'cancel'
  }
}

async function rejectCurrentPreview() {
  if (!preview.value?.batch_id) return
  cancelBatchReason.value = ''
  cancelBatchError.value = ''
  cancelBatchDialog.value = {
    id: preview.value.batch_id,
    status: preview.value.status,
    original_filename: selectedFile.value?.name || preview.value.original_filename,
    year: preview.value.year,
    quarter: preview.value.quarter,
    period_type: preview.value.period_type,
    action: 'reject'
  }
}

async function performCancelBatch() {
  if (!cancelBatchDialog.value || cancelBatchBusy.value) return
  cancelBatchBusy.value = true
  cancelBatchError.value = ''
  try {
    const batch = cancelBatchDialog.value
    const currentBatch = batchDetail.value?.batch
    const managedBatchId = pendingPreviewDetail.value?.batch.id
    const reason = cancelBatchReason.value.trim()
    if (!reason) {
      cancelBatchError.value = 'Alasan penolakan atau pembatalan wajib diisi.'
      return
    }
    let response
    try {
      response = await cancelImportBatch(batch.id, reason)
    } catch (error) {
      cancelBatchError.value = errorMessage(error, 'Preview import gagal dihapus.')
      return
    }

    removePreviewToken(batch.id)
    cancelBatchDialog.value = null
    showSuccess(response.message)
    try {
      await Promise.all([loadSummary(), loadBatches()])
      if (currentBatch) await openBatchDetail(currentBatch)
      if (activeTab.value === 'previews') {
        await loadPendingPreviews(pendingPreviewPage.value)
      }
      if (managedBatchId === batch.id || preview.value?.batch_id === batch.id) {
        pendingPreviewDetail.value = null
        pendingPreviewRows.value = []
        preview.value = null
      }
    } catch (error) {
      pageError.value = `Preview sudah dibatalkan, tetapi daftar belum berhasil diperbarui: ${errorMessage(error, 'coba muat ulang halaman.')}`
    }
  } finally {
    cancelBatchBusy.value = false
  }
}

async function handlePreview() {
  uploadError.value = ''
  successMessage.value = ''
  if (!selectedFile.value || !workbookDetection.value) {
    uploadError.value = 'Pilih file dan deteksi worksheet terlebih dahulu.'
    return
  }

  const results = []
  const tasks = []
  for (const sheet of workbookDetection.value.sheets) {
    if (!['detected', 'needs_dataset_choice'].includes(sheet.status)) {
      results.push({
        sheet_name: sheet.sheet_name,
        status: sheet.status,
        target_table: sheet.target_table,
        message: sheet.message || sheet.errors?.map(error => error.message || error).join(' ') || 'Sheet dilewati.'
      })
      continue
    }

    const datasetKey = sheet.dataset_key || workbookDatasetChoices.value[sheet.sheet_name]
    if (!datasetKey || !sheet.candidate_datasets?.includes(datasetKey)) {
      results.push({ sheet_name: sheet.sheet_name, status: 'needs_configuration', message: 'Pilih dataset untuk sheet triwulanan yang ambigu.' })
      continue
    }

    for (const period of sheet.periods || []) {
      let quarter = period.quarter
      if (period.requires_quarter) {
        const selected = workbookQuarterChoices.value[workbookQuarterChoiceKey(sheet.sheet_name, period.period_key)]
        quarter = /^[1-4]$/.test(String(selected || '')) ? Number(selected) : null
      }

      if ((datasetKey === 'triwulanan_1' || datasetKey === 'triwulanan_2') && quarter === null) {
        results.push({ sheet_name: sheet.sheet_name, dataset_key: datasetKey, target_table: sheet.target_table, period_key: period.period_key, status: 'needs_configuration', message: `Pilih Q untuk periode ${period.period_key}.` })
        continue
      }

      const periodKey = quarter === null ? String(period.year) : `${period.year}/Q${quarter}`
      tasks.push({
        sheet_name: sheet.sheet_name,
        dataset_key: datasetKey,
        target_table: sheet.target_table,
        year: period.year,
        quarter,
        period_key: periodKey,
        rows_found: period.row_count
      })
    }
  }

  const taskGroups = new Map()
  for (const task of tasks) {
    const key = `${task.dataset_key}|${task.period_key}`
    const group = taskGroups.get(key) || []
    group.push(task)
    taskGroups.set(key, group)
  }
  const runnableTasks = []
  for (const group of taskGroups.values()) {
    if (group.length > 1) {
      for (const task of group) {
        results.push({ ...task, status: 'duplicate_conflict', message: 'Lebih dari satu sheet mengarah ke dataset/periode yang sama.' })
      }
    } else {
      runnableTasks.push(group[0])
    }
  }

  if (!runnableTasks.length) {
    workbookPreviewResults.value = results
    uploadError.value = 'Tidak ada pasangan sheet/periode yang siap dipreview.'
    return
  }

  const groupId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  workbookGroupId.value = groupId
  uploading.value = true
  workbookPreviewResults.value = results
  try {
    for (const task of runnableTasks) {
      try {
        const response = await previewDatasetUpload(
          selectedFile.value,
          task.dataset_key,
          task.year,
          task.quarter,
          undefined,
          importMode,
          { sheetName: task.sheet_name, periodKey: task.period_key, workbookGroupId: groupId }
        )
        const childPreview = response.preview || response.data?.preview
        if (!childPreview) throw new Error('Respons preview tidak memiliki ringkasan.')
        writePreviewToken(childPreview.batch_id, childPreview.preview_token)
        results.push({
          ...task,
          status: childPreview.invalid_rows > 0 ? 'previewed_with_errors' : 'previewed',
          batch_id: childPreview.batch_id,
          preview: childPreview,
          message: childPreview.invalid_rows > 0 ? 'Preview selesai; periksa baris invalid sebelum approval.' : 'Preview siap ditinjau.'
        })
      } catch (error) {
        results.push({ ...task, status: 'failed', message: errorMessage(error, 'Sheet/periode gagal dipreview.') })
      }
    }
    workbookPreviewResults.value = results
    const previewedCount = results.filter(result => result.batch_id).length
    const failedCount = results.filter(result => ['failed', 'needs_configuration', 'duplicate_conflict', 'invalid', 'unknown'].includes(result.status)).length
    await Promise.all([loadSummary(), loadBatches()])
    await loadPendingPreviews()
    if (previewedCount) activeTab.value = 'previews'
    showSuccess(`${previewedCount} preview dataset/periode dibuat${failedCount ? `; ${failedCount} sheet/periode perlu ditangani` : ''}. Setiap batch disetujui secara terpisah.`)
    if (failedCount) uploadError.value = 'Sebagian sheet/periode tidak dipreview. Periksa status per sheet; tidak ada yang otomatis disetujui.'
  } catch (error) {
    uploadError.value = errorMessage(error, 'Preview workbook gagal diproses.')
  } finally {
    uploading.value = false
  }
}

async function handleDetectWorkbook() {
  uploadError.value = ''
  successMessage.value = ''
  workbookDetection.value = null
  workbookPreviewResults.value = []
  if (!selectedFile.value) {
    uploadError.value = 'Pilih file Excel terlebih dahulu.'
    return
  }

  uploading.value = true
  workbookDetectionBusy.value = true
  try {
    const response = await detectWorkbookUpload(selectedFile.value)
    workbookDetection.value = response.detection
    workbookDatasetChoices.value = Object.fromEntries(
      response.detection.sheets
        .filter(sheet => sheet.status === 'needs_dataset_choice')
        .map(sheet => [sheet.sheet_name, ''])
    )
    const periodChoices = {}
    for (const sheet of response.detection.sheets) {
      for (const period of sheet.periods || []) {
        if (period.requires_quarter) {
          periodChoices[workbookQuarterChoiceKey(sheet.sheet_name, period.period_key)] = ''
        }
      }
    }
    workbookQuarterChoices.value = periodChoices
    showSuccess('Deteksi worksheet selesai. Periksa sheet yang ambigu atau memerlukan pilihan triwulan.')
  } catch (error) {
    uploadError.value = errorMessage(error, 'Workbook gagal dideteksi.')
  } finally {
    uploading.value = false
    workbookDetectionBusy.value = false
  }
}

function openConfirmDialog() {
  confirmConsent.value = false
  confirmReason.value = ''
  showConfirmDialog.value = true
}

async function handleConfirmImport() {
  if (!canConfirmImport.value) return
  confirming.value = true
  uploadError.value = ''
  try {
    const isWorkbookChild = Boolean(pendingPreviewDetail.value?.batch.workbook_group_id || preview.value?.workbook_group_id)
    const response = await confirmImportBatch(preview.value.batch_id, {
      preview_token: preview.value.preview_token,
      confirm: true,
      reason: confirmReason.value.trim() || 'Excel import confirmed by local-user'
    })
    const newSectors = response.data?.new_sectors || []
    const registrationMessage = newSectors.length
      ? ` Master sektor ${newSectors.map(sector => sector.code).join(', ')} dan data neracanya berhasil didaftarkan.`
      : ''
    removePreviewToken(preview.value.batch_id)
    refreshPending.value = response.data?.dashboard_refresh?.status === 'pending'
    showConfirmDialog.value = false
    preview.value = null
    previewRows.value = []
    selectedFile.value = null
    pendingPreviewDetail.value = null
    pendingPreviewRows.value = []
    await Promise.all([loadSummary(), loadBatches()])
    await loadPendingPreviews()
    showSuccess(`${response.message}${registrationMessage}`)
    activeTab.value = isWorkbookChild ? 'previews' : 'overview'
  } catch (error) {
    uploadError.value = errorMessage(error, 'Konfirmasi import gagal.')
  } finally {
    confirming.value = false
  }
}

async function retryCacheRefresh() {
  loading.value = true
  pageError.value = ''
  try {
    const response = await retryDashboardRefresh()
    refreshPending.value = response.data?.dashboard_refresh?.status === 'pending'
    if (!refreshPending.value) showSuccess(response.message)
  } catch (error) {
    pageError.value = errorMessage(error, 'Refresh cache belum berhasil.')
  } finally {
    loading.value = false
  }
}

function openVersionAction(action, version) {
  actionReason.value = ''
  actionDialog.value = { action, version }
}

async function openVersionDetail(version, comparisonPage = 1) {
  versionDetailBusy.value = true
  pageError.value = ''
  try {
    const response = await getVersionDetail(version.id, {
      comparison_page: comparisonPage,
      comparison_limit: 25
    })
    versionDetail.value = response.data
  } catch (error) {
    pageError.value = errorMessage(error, 'Detail versi gagal dimuat.')
  } finally {
    versionDetailBusy.value = false
  }
}

async function performVersionAction() {
  if (!actionDialog.value) return
  actionBusy.value = true
  pageError.value = ''
  try {
    const { action, version } = actionDialog.value
    const response = action === 'restore'
      ? await restoreVersion(version.id, actionReason.value.trim())
      : await softDeleteVersion(version.id, actionReason.value.trim())
    refreshPending.value = response.data?.dashboard_refresh?.status === 'pending'
    actionDialog.value = null
    const currentBatch = batchDetail.value?.batch
    await Promise.all([loadSummary(), loadVersions(), loadBatches()])
    if (currentBatch) await openBatchDetail(currentBatch)
    showSuccess(response.message)
  } catch (error) {
    pageError.value = errorMessage(error, 'Perubahan versi gagal dilakukan.')
  } finally {
    actionBusy.value = false
  }
}

function clearPreview() {
  preview.value = null
  previewRows.value = []
  previewCounts.value = { valid: 0, warning: 0, invalid: 0 }
  selectedFile.value = null
  uploadError.value = ''
  uploadProgress.value = 0
}

function changeHistoryPage(page) {
  if (page < 1 || page > historyPagination.value.total_pages) return
  historyPage.value = page
  loadActiveTab()
}

function changePendingPreviewPage(page) {
  if (page < 1 || page > pendingPreviewPagination.value.total_pages) return
  loadPendingPreviews(page)
}

function changePreviewPage(page) {
  if (page < 1 || page > previewPagination.value.total_pages) return
  loadPreviewPage(page).catch(error => {
    uploadError.value = errorMessage(error, 'Detail preview gagal dimuat.')
  })
}

watch([previewFilter, previewSearch], () => {
  if (previewFilterTimer) window.clearTimeout(previewFilterTimer)
  previewFilterTimer = window.setTimeout(() => {
    if (preview.value) changePreviewPage(1)
  }, 180)
})
</script>

<template>
  <div class="mx-auto max-w-[1500px] space-y-6">
    <header class="data-hero rounded-[28px] p-5 text-slate-900 sm:p-7">
      <div class="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div class="max-w-2xl">
          <div class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-teal-700">
            <span class="inline-flex h-2 w-2 rounded-full bg-teal-600"></span>
            Administrasi Data
          </div>
          <h1 class="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Manajemen Data</h1>
          <p class="mt-2 max-w-xl text-sm text-slate-600 sm:text-base">Upload, validasi, dan kelola versi dataset dashboard dengan pengalaman kerja yang lebih cepat dan lebih jelas.</p>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row">
          <button type="button" class="data-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50" :disabled="loading" @click="loadActiveTab">
            <RotateCw :size="15" /> Perbarui data
          </button>
          <button type="button" class="data-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold" @click="activeTab = 'upload'">
            <Upload :size="15" /> Import Data
          </button>
        </div>
      </div>
    </header>

    <div v-if="pageError" role="alert" class="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <span>{{ pageError }}</span>
      <button type="button" aria-label="Tutup pesan" @click="pageError = ''"><X :size="16" /></button>
    </div>
    <div v-if="successMessage" role="status" class="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      <span>{{ successMessage }}</span>
      <button type="button" aria-label="Tutup pesan" @click="successMessage = ''"><X :size="16" /></button>
    </div>
    <div v-if="refreshPending" role="status" class="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <span>Data tersimpan, tetapi cache dashboard belum berhasil diperbarui.</span>
      <button type="button" class="font-semibold underline" :disabled="loading" @click="retryCacheRefresh">Coba perbarui cache</button>
    </div>

    <nav class="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur-sm" aria-label="Tab Manajemen Data">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="data-tab inline-flex shrink-0 items-center gap-2 border border-transparent px-4 py-2.5 text-sm font-semibold transition"
        :class="activeTab === tab.id ? 'data-tab--active border-teal-200 bg-teal-50 text-teal-800 shadow-sm' : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800'"
        :aria-current="activeTab === tab.id ? 'page' : undefined"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" :size="16" />{{ tab.label }}
      </button>
    </nav>

    <div v-if="loading" role="status" class="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
      <LoaderCircle :size="18" class="animate-spin" /> Memuat data dari PostgreSQL...
    </div>

    <template v-else-if="activeTab === 'overview'">
      <section v-if="summary" class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
        <article v-for="item in [
          { label: 'Dataset', value: summary.totals.datasets, accent: 'bg-teal-50 text-teal-700', icon: Database },
          { label: 'Periode aktif', value: summary.totals.active_periods, accent: 'bg-sky-50 text-sky-700', icon: Activity },
          { label: 'Versi data', value: summary.totals.versions, accent: 'bg-emerald-50 text-emerald-700', icon: History },
          { label: 'Riwayat import', value: summary.totals.imports, accent: 'bg-cyan-50 text-cyan-700', icon: Upload },
          { label: 'Import berhasil', value: summary.totals.imported, accent: 'bg-emerald-50 text-emerald-700', icon: Check },
          { label: 'Import ditolak', value: summary.totals.rejected, accent: 'bg-rose-50 text-rose-700', icon: X },
          { label: 'Import gagal', value: summary.totals.failed, accent: 'bg-orange-50 text-orange-700', icon: ShieldAlert },
          { label: 'Menunggu review', value: summary.totals.pending_confirmation, accent: 'bg-amber-50 text-amber-700', icon: Clock3 },
          { label: 'Pembaruan terakhir', value: formatDate(summary.totals.updated_at), accent: 'bg-slate-100 text-slate-700', icon: Check }
        ]" :key="item.label" class="data-stat-card data-panel rounded-xl p-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{{ item.label }}</p>
              <p class="mt-2 font-black leading-tight text-slate-900" :class="typeof item.value === 'number' ? 'text-xl tabular-nums' : 'text-sm'">{{ typeof item.value === 'number' ? formatDisplayNumber(item.value) : item.value || 'Belum tersedia' }}</p>
            </div>
            <div :class="`${item.accent} flex h-9 w-9 shrink-0 items-center justify-center rounded-lg`">
              <component :is="item.icon" :size="17" />
            </div>
          </div>
        </article>
      </section>

      <section class="data-panel mt-5 rounded-[22px] overflow-hidden">
        <div class="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="data-section-label">Monitor status</p>
            <h2 class="mt-1 text-xl font-black text-slate-900">Dataset dan periode aktif</h2>
          </div>
          <button type="button" class="data-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold" @click="activeTab = 'upload'">
            <Upload :size="15" /> Upload Excel
          </button>
        </div>
        <div class="overflow-hidden">
          <table class="data-table w-full table-fixed text-left text-sm">
            <colgroup><col style="width: 24%"><col style="width: 16%"><col style="width: 14%"><col style="width: 9%"><col style="width: 19%"><col style="width: 18%"></colgroup>
            <thead>
              <tr><th class="whitespace-normal break-words px-2 py-3 sm:px-4">Dataset</th><th class="whitespace-normal break-words px-2 py-3 sm:px-4">Periode aktif</th><th class="whitespace-normal break-words px-2 py-3 sm:px-4">Jumlah periode</th><th class="whitespace-normal break-words px-2 py-3 sm:px-4">Versi</th><th class="whitespace-normal break-words px-2 py-3 sm:px-4">Diperbarui</th><th class="whitespace-normal break-words px-2 py-3 sm:px-4">Aksi</th></tr>
            </thead>
            <tbody>
              <tr v-for="dataset in summary?.datasets || []" :key="dataset.dataset_key" class="border-t border-slate-100">
                <td class="break-words px-2 py-3 font-bold text-slate-800 sm:px-4">{{ dataset.label }}</td>
                <td class="whitespace-normal break-words px-2 py-3 tabular-nums text-slate-700 sm:px-4">{{ dataset.latest_period || 'Belum tersedia' }}</td>
                <td class="whitespace-nowrap px-2 py-3 tabular-nums text-slate-700 sm:px-4">{{ formatDisplayNumber(Number(dataset.active_periods)) }}</td>
                <td class="whitespace-nowrap px-2 py-3 tabular-nums text-slate-700 sm:px-4">{{ dataset.latest_version_number ?? '—' }}</td>
                <td class="break-words px-2 py-3 text-slate-600 sm:px-4">{{ formatDate(dataset.updated_at) }}</td>
                <td class="break-words px-2 py-3 sm:px-4"><button type="button" class="text-left font-bold leading-tight text-teal-800 hover:text-teal-900" @click="datasetFilter = dataset.dataset_key; activeTab = 'versions'">Lihat versi</button></td>
              </tr>
              <tr v-if="!summary?.datasets?.length"><td colspan="6" class="px-4 py-10 text-center text-slate-500">Belum ada metadata dataset.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="data-panel mt-5 rounded-[22px] overflow-hidden">
        <div class="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="data-section-label">Operasional</p>
            <h2 class="mt-1 text-xl font-black text-slate-900">Import terbaru</h2>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input v-model="batchSearch" type="search" aria-label="Cari riwayat import" placeholder="Cari file atau tahun..." class="data-search w-full sm:w-52 px-3 py-2 text-xs" @keydown.enter.prevent @search.prevent>
            <button type="button" class="data-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold" @click="activeTab = 'upload'">Buka upload</button>
          </div>
        </div>
        <div v-if="batches.length" class="overflow-hidden">
          <table class="data-table w-full table-fixed text-left text-sm">
            <colgroup><col style="width: 8%"><col style="width: 18%"><col style="width: 25%"><col style="width: 8%"><col style="width: 13%"><col style="width: 16%"><col style="width: 12%"></colgroup>
            <thead><tr><th class="whitespace-normal break-words px-2 py-3 sm:px-4">Batch</th><th class="whitespace-normal break-words px-2 py-3 sm:px-4">Dataset / periode</th><th class="whitespace-normal break-words px-2 py-3 sm:px-4">File</th><th class="whitespace-normal break-words px-2 py-3 sm:px-4">Baris</th><th class="whitespace-normal break-words px-2 py-3 sm:px-4">Status</th><th class="whitespace-normal break-words px-2 py-3 sm:px-4">Dibuat</th><th class="whitespace-normal break-words px-2 py-3 sm:px-4">Aksi</th></tr></thead>
            <tbody><tr v-for="batch in batches" :key="batch.id" class="border-t border-slate-100"><td class="break-words px-2 py-3 font-mono text-xs sm:px-4">#{{ batch.id }}</td><td class="break-words px-2 py-3 sm:px-4">{{ datasetLabels[batch.dataset_key] || batch.dataset_key }} · {{ formatPeriod(batch) }}</td><td class="break-all px-2 py-3 sm:px-4">{{ batch.original_filename }}</td><td class="whitespace-nowrap px-2 py-3 tabular-nums sm:px-4">{{ batch.total_rows }}</td><td class="break-words px-2 py-3 sm:px-4"><StatusBadge :status="batch.status" /></td><td class="break-words px-2 py-3 sm:px-4">{{ formatDate(batch.created_at) }}</td><td class="break-words px-2 py-3 sm:px-4"><div class="flex flex-wrap items-center gap-x-3 gap-y-1"><button type="button" class="font-bold text-teal-800 hover:text-teal-900" @click="openBatchDetail(batch)">Lihat</button><button v-if="['previewed', 'expired', 'failed'].includes(batch.status)" type="button" class="inline-flex items-center gap-1 font-semibold text-rose-700 hover:text-rose-900" :aria-label="`Hapus preview batch ${batch.id}`" @click="openCancelBatch(batch)"><Trash2 :size="14" /><span class="hidden sm:inline">Hapus</span></button></div></td></tr></tbody>
          </table>
        </div>
        <p v-else class="px-5 py-8 text-sm text-slate-500">Belum ada riwayat import.</p>
      </section>
    </template>

    <template v-else-if="activeTab === 'upload'">
      <section class="grid gap-5 xl:grid-cols-[minmax(300px,380px)_1fr]">
        <div class="space-y-5">
          <div class="data-panel rounded-[22px] p-5 sm:p-6">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="data-section-label">Setup import</p>
                <h2 class="mt-1 text-xl font-black text-slate-900">Upload dataset</h2>
              </div>
              <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Upload :size="20" />
              </div>
            </div>
            <p class="mt-4 text-sm text-slate-500">Satu workbook dapat berisi beberapa sheet transaksi. Sistem mendeteksi dataset dan periode setiap sheet secara terpisah.</p>
            <div class="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-sky-900"><span class="font-bold">Mode: Replace Period.</span> File harus menjadi snapshot lengkap periode. Record yang tidak ada pada file tidak masuk versi aktif berikutnya, tetapi tetap tersimpan pada versi historis.</div>
            <div class="mt-5 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              <span>Template `.xlsx` · 3 sheet transaksi · maksimal 15 MB</span>
              <button type="button" class="inline-flex shrink-0 items-center gap-1 font-bold text-teal-800 hover:text-teal-900" @click="handleDownloadTemplate"><ArrowDownToLine :size="14" />Template</button>
            </div>
          </div>

          <section class="data-panel rounded-[22px] p-5 sm:p-6">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="data-section-label">File sumber</p>
                <h2 class="mt-1 text-xl font-black text-slate-900">Excel workbook</h2>
              </div>
              <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <FileSpreadsheet :size="20" />
              </div>
            </div>
            <div class="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center transition hover:border-teal-500 hover:bg-teal-50/40" @click="fileInput?.click()" @dragover.prevent @drop.prevent="handleDrop">
              <input ref="fileInput" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="hidden" @change="getFile">
              <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm">
                <FileSpreadsheet :size="28" />
              </div>
              <p class="mt-4 text-sm font-bold text-slate-700">{{ selectedFile?.name || 'Pilih atau jatuhkan file .xlsx' }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : 'Ukuran maksimum 15 MB' }}</p>
            </div>
            <div v-if="uploadProgress > 0 && uploading" class="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-teal-600 transition-all" :style="{ width: `${uploadProgress}%` }"></div></div>
            <button type="button" class="data-btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold" :disabled="uploading || !selectedFile" @click="handleDetectWorkbook">
              <LoaderCircle v-if="uploading && workbookDetectionBusy" :size="16" class="animate-spin" /><Search v-else :size="16" />{{ workbookDetectionBusy ? 'Mendeteksi worksheet...' : 'Deteksi sheet workbook' }}
            </button>
          </section>
        </div>

        <div class="min-w-0 space-y-4">
          <div v-if="uploadError" role="alert" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{{ uploadError }}</div>
          <section v-if="workbookDetection" class="data-panel space-y-4 rounded-[22px] p-4 sm:p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="data-section-label">Hasil deteksi</p>
                <h2 class="mt-1 text-lg font-black text-slate-900">{{ workbookDetection.original_filename }}</h2>
                <p class="mt-1 text-xs text-slate-500">Setiap pasangan sheet/periode akan menjadi batch preview tersendiri dalam grup workbook ini.</p>
              </div>
              <span v-if="workbookGroupId" class="rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] text-slate-500">Grup {{ workbookGroupId.slice(0, 8) }}</span>
            </div>
            <div v-for="sheet in workbookDetection.sheets" :key="sheet.sheet_name" class="rounded-lg border border-slate-200 bg-white p-3">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-semibold text-slate-800">{{ sheet.sheet_name }}</p>
                  <p class="mt-0.5 text-xs text-slate-500">{{ sheet.target_table || '—' }} · {{ formatDisplayNumber(sheet.rows_found || 0) }} baris</p>
                </div>
                <span class="rounded-full px-2 py-1 text-[10px] font-semibold" :class="sheet.status === 'detected' ? 'bg-emerald-50 text-emerald-700' : sheet.status === 'needs_dataset_choice' ? 'bg-amber-50 text-amber-700' : ['invalid', 'duplicate_conflict'].includes(sheet.status) ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'">
                  {{ sheet.status === 'detected' ? 'Terdeteksi' : sheet.status === 'needs_dataset_choice' ? 'Perlu dipilih' : sheet.status === 'ignored' ? 'Diabaikan' : sheet.status === 'empty' ? 'Kosong · dilewati' : sheet.status === 'unknown' ? 'Tidak dikenal' : sheet.status === 'duplicate_conflict' ? 'Konflik duplikat' : 'Invalid' }}
                </span>
              </div>
              <div v-if="sheet.periods?.length" class="mt-3 space-y-2">
                <div v-for="period in sheet.periods" :key="period.period_key" class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-2">
                  <span class="text-xs font-semibold text-slate-700">{{ period.period_key }} · {{ formatDisplayNumber(period.row_count) }} baris</span>
                  <label v-if="period.requires_quarter" class="flex items-center gap-2 text-xs text-slate-600">Triwulan
                    <select v-model="workbookQuarterChoices[workbookQuarterChoiceKey(sheet.sheet_name, period.period_key)]" class="data-select px-2 py-1.5 text-xs">
                      <option value="">Pilih Q</option><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option>
                    </select>
                  </label>
                </div>
              </div>
              <ul v-if="sheet.errors?.length" class="mt-2 list-inside list-disc space-y-1 text-xs text-rose-700"><li v-for="(error, index) in sheet.errors" :key="index">{{ error.message || error }}</li></ul>
              <p v-if="sheet.message" class="mt-2 text-xs text-slate-500">{{ sheet.message }}</p>
            </div>
            <button type="button" class="data-btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold" :disabled="uploading || !canPreviewDetectedWorkbook" @click="handlePreview"><LoaderCircle v-if="uploading" :size="15" class="animate-spin" /><Upload v-else :size="15" />{{ uploading ? 'Memproses sheet/periode...' : 'Buat preview semua sheet' }}</button>
          </section>
          <section v-if="workbookPreviewResults.length" class="data-panel space-y-3 rounded-[22px] p-4 sm:p-5">
            <h2 class="text-sm font-bold text-slate-800">Status per sheet / periode · grup {{ workbookGroupId.slice(0, 8) }}</h2>
            <article v-for="(result, index) in workbookPreviewResults" :key="`${result.sheet_name}-${result.period_key}-${index}`" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <div>
                <p class="text-sm font-semibold text-slate-800">{{ result.sheet_name }} <span v-if="result.period_key">· {{ result.period_key }}</span></p>
                <p class="mt-0.5 text-xs text-slate-500">{{ result.target_table || '—' }} · {{ result.message }}</p>
                <p v-if="result.preview" class="mt-1 text-xs text-slate-500">{{ formatDisplayNumber(result.preview.total_rows) }} baris · {{ formatDisplayNumber(result.preview.valid_rows) }} valid · {{ formatDisplayNumber(result.preview.invalid_rows) }} invalid</p>
              </div>
              <button v-if="result.batch_id" type="button" class="text-xs font-bold text-teal-800 hover:text-teal-900" @click="openWorkbookChildPreview(result)">Tinjau batch #{{ result.batch_id }}</button>
            </article>
          </section>
          <section v-if="preview" class="space-y-4">
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <article v-for="item in [
                { label: 'Total baris', value: preview.total_rows, tone: 'bg-slate-50 text-slate-700', icon: Database },
                { label: 'Valid', value: previewCounts.valid, tone: 'bg-emerald-50 text-emerald-700', icon: Check },
                { label: 'Warning', value: previewCounts.warning, tone: 'bg-amber-50 text-amber-700', icon: ShieldAlert },
                { label: 'Invalid', value: previewCounts.invalid, tone: 'bg-rose-50 text-rose-700', icon: X },
                { label: 'Status', value: preview.status, tone: 'bg-teal-50 text-teal-700', icon: Activity }
              ]" :key="item.label" class="data-stat-card data-panel rounded-2xl p-4">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{{ item.label }}</p>
                    <p class="mt-3 text-2xl font-black text-slate-900">{{ item.label === 'Status' ? item.value : formatDisplayNumber(Number(item.value)) }}</p>
                  </div>
                  <div :class="`${item.tone} flex h-10 w-10 items-center justify-center rounded-xl`">
                    <component :is="item.icon" :size="18" />
                  </div>
                </div>
              </article>
            </div>
            <SectorPreviewSummary :summary="preview.sector_summary" />
            <div class="data-panel flex flex-col gap-3 rounded-[22px] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 class="text-lg font-black text-slate-900">Hasil validasi · batch #{{ preview.batch_id }}</h2><p class="mt-0.5 text-xs text-slate-500">Token berlaku sampai {{ formatDate(preview.expires_at) }}</p></div>
              <div class="flex flex-wrap items-center gap-2">
                <select v-model="previewFilter" class="data-select px-2.5 py-2 text-xs"><option value="">Semua status</option><option value="valid">Valid</option><option value="warning">Warning</option><option value="invalid">Invalid</option></select>
                <label class="relative"><Search :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input v-model="previewSearch" type="search" placeholder="Cari baris..." class="data-search w-40 py-2 pl-8 pr-2 text-xs" @keydown.enter.prevent @search.prevent></label>
                <button type="button" class="data-btn-secondary inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold" @click="openConfirmDialog" :disabled="!canConfirmImport"><Check :size="14" />Konfirmasi import</button>
                <button type="button" class="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50" @click="rejectCurrentPreview"><X :size="14" />Tolak preview</button>
                <button type="button" class="data-btn-ghost inline-flex items-center justify-center rounded-xl px-2.5 py-2 text-xs font-semibold" @click="clearPreview">Tutup preview</button>
              </div>
            </div>
            <div v-if="currentPeriodHasActiveVersion" class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><ShieldAlert :size="17" class="mt-0.5 shrink-0" /><span>Periode {{ isQuarterlyDataset ? `${selectedYear}/Q${selectedQuarter}` : selectedYear }} sudah memiliki versi aktif. Konfirmasi akan membuat revisi dan mempertahankan versi lama.</span></div>
            <div v-if="preview.invalid_rows > 0" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Konfirmasi diblokir karena terdapat baris invalid. Perbaiki file sumber dan buat preview baru.</div>
            <div class="data-table-shell overflow-x-auto">
              <table class="data-table w-full min-w-[1000px] text-left text-xs">
                <thead class="bg-slate-50 uppercase text-slate-500"><tr><th class="px-3 py-3">Baris</th><th v-for="header in previewDisplayHeaders" :key="header" class="px-3 py-3">{{ header }}</th><th class="px-3 py-3">Validasi</th></tr></thead>
                <tbody>
                  <tr v-for="row in previewRows" :key="row.id" class="border-t border-slate-100 align-top">
                    <td class="px-3 py-2 tabular-nums">{{ row.source_row_number }}</td>
                    <td v-for="header in previewDisplayHeaders" :key="header" class="px-3 py-2"><span>{{ row.raw_data?.[header] ?? '-' }}</span><span v-if="header === 'NILAI' && row.normalized_data?.nilai !== undefined" class="mt-1 block text-[10px] text-slate-500">Normal: {{ formatNullableDecimal(row.normalized_data.nilai) }} · {{ row.normalized_data.value_status }}</span></td>
                    <td class="px-3 py-2"><StatusBadge :status="row.validation_status" /><ul v-if="row.validation_errors?.length" class="mt-1 max-w-64 list-inside list-disc space-y-1 text-rose-700"><li v-for="(message, index) in row.validation_errors" :key="index">{{ message }}</li></ul></td>
                  </tr>
                  <tr v-if="previewRows.length === 0"><td :colspan="previewDisplayHeaders.length + 2" class="px-4 py-10 text-center text-slate-500">Tidak ada baris pada halaman/status ini.</td></tr>
                </tbody>
              </table>
              <PaginationBar :page="previewPage" :total-pages="detailPageCount" :total="previewPagination.total" @change="changePreviewPage" />
            </div>
          </section>
          <section v-else class="data-panel flex min-h-60 flex-col items-center justify-center rounded-[22px] px-6 text-center">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <FileSpreadsheet :size="28" />
            </div>
            <h2 class="mt-4 text-lg font-black text-slate-800">Belum ada preview aktif</h2>
            <p class="mt-1 max-w-md text-sm text-slate-500">Pilih tahun dan workbook asli. Preview akan disimpan ke staging PostgreSQL untuk diperiksa sebelum konfirmasi.</p>
          </section>
        </div>
      </section>
    </template>

    <template v-else-if="activeTab === 'previews'">
      <section class="data-panel overflow-hidden rounded-[22px]">
        <div class="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="data-section-label">Antrean pemeriksaan</p>
            <h2 class="mt-1 text-xl font-black text-slate-900">Preview menunggu keputusan</h2>
            <p class="mt-1 text-sm text-slate-500">Tinjau hasil validasi, lalu setujui import atau batalkan preview.</p>
          </div>
          <button type="button" class="data-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold" :disabled="pendingPreviewLoading" @click="loadPendingPreviews()"><RotateCw :size="14" />Muat ulang</button>
        </div>
        <div v-if="pendingPreviewLoading" role="status" class="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle :size="17" class="animate-spin" />Memuat antrean preview...</div>
        <div v-else-if="pendingPreviews.length" class="overflow-x-auto">
          <table class="data-table w-full min-w-[700px] text-left text-sm">
            <thead><tr><th class="w-16 px-2 py-3">Batch</th><th class="px-2 py-3">Dataset / periode · file</th><th class="w-16 px-2 py-3">Baris</th><th class="w-28 px-2 py-3">Kedaluwarsa</th><th class="w-24 px-2 py-3">Token sesi</th><th class="w-32 px-2 py-3">Aksi</th></tr></thead>
            <tbody>
              <tr v-for="batch in pendingPreviews" :key="batch.id" class="border-t border-slate-100">
                <td class="px-2 py-3 font-mono text-xs">#{{ batch.id }}</td>
                <td class="max-w-[220px] px-2 py-3"><p class="font-semibold text-slate-800">{{ datasetLabels[batch.dataset_key] || batch.dataset_key }} · {{ formatPeriod(batch) }}</p><p class="mt-0.5 truncate text-xs text-slate-500" :title="batch.original_filename">{{ batch.original_filename }}</p><p v-if="batch.workbook_group_id" class="mt-0.5 font-mono text-[10px] text-teal-700">Grup workbook {{ batch.workbook_group_id.slice(0, 8) }}</p></td>
                <td class="px-2 py-3 tabular-nums">{{ formatDisplayNumber(Number(batch.total_rows)) }}</td>
                <td class="px-2 py-3 text-xs text-slate-600"><span>{{ formatDate(batch.preview_expires_at) }}</span><span v-if="new Date(batch.preview_expires_at).getTime() <= Date.now()" class="mt-0.5 block font-semibold text-rose-700">Kedaluwarsa</span></td>
                <td class="px-2 py-3 text-xs"><span :class="previewTokens[String(batch.id)] ? 'text-emerald-700' : 'text-amber-700'">{{ previewTokens[String(batch.id)] ? 'Ada' : 'Tidak ada' }}</span></td>
                <td class="px-2 py-3"><div class="flex items-center gap-2"><button type="button" class="font-bold text-teal-800 hover:text-teal-900" @click="openManagedPreview(batch)">Tinjau</button><button type="button" class="inline-flex items-center gap-1 font-semibold text-rose-700 hover:text-rose-900" @click="openCancelBatch(batch)"><Trash2 :size="14" />Tolak</button></div></td>
              </tr>
            </tbody>
          </table>
          <PaginationBar :page="pendingPreviewPage" :total-pages="pendingPreviewPagination.total_pages" :total="pendingPreviewPagination.total" @change="changePendingPreviewPage" />
        </div>
        <div v-else class="flex min-h-44 flex-col items-center justify-center px-6 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Check :size="22" /></div>
          <p class="mt-3 text-sm font-bold text-slate-800">Tidak ada preview yang menunggu</p>
          <p class="mt-1 text-xs text-slate-500">Preview baru akan muncul di sini setelah file selesai diproses.</p>
        </div>
      </section>

      <section v-if="workbookPreviewResults.length" class="data-panel space-y-3 rounded-[22px] p-4 sm:p-5">
        <div>
          <p class="data-section-label">Satu workbook · beberapa batch</p>
          <h2 class="mt-1 text-lg font-black text-slate-900">Status per sheet / periode</h2>
          <p class="mt-1 text-xs text-slate-500">Grup {{ workbookGroupId }} · setiap batch memiliki approval dan versioning sendiri.</p>
        </div>
        <article v-for="(result, index) in workbookPreviewResults" :key="`${result.sheet_name}-${result.period_key}-${index}`" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <div>
            <p class="text-sm font-semibold text-slate-800">{{ result.sheet_name }} <span v-if="result.period_key">· {{ result.period_key }}</span></p>
            <p class="mt-0.5 text-xs text-slate-500">{{ result.target_table || '—' }} · {{ result.message }}</p>
            <p v-if="result.preview" class="mt-1 text-xs text-slate-500">{{ formatDisplayNumber(result.preview.total_rows) }} baris · {{ formatDisplayNumber(result.preview.valid_rows) }} valid · {{ formatDisplayNumber(result.preview.invalid_rows) }} invalid</p>
          </div>
          <button v-if="result.batch_id" type="button" class="text-xs font-bold text-teal-800 hover:text-teal-900" @click="openWorkbookChildPreview(result)">Tinjau batch #{{ result.batch_id }}</button>
        </article>
      </section>

      <section v-if="pendingPreviewDetail" class="data-panel overflow-hidden rounded-[22px]">
        <div class="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <p class="data-section-label">Pemeriksaan batch #{{ pendingPreviewDetail.batch.id }}</p>
            <h2 class="mt-1 truncate text-lg font-black text-slate-900">{{ pendingPreviewDetail.batch.original_filename }}</h2>
            <p class="mt-1 text-sm text-slate-500">{{ datasetLabels[pendingPreviewDetail.batch.dataset_key] || pendingPreviewDetail.batch.dataset_key }} · {{ formatPeriod(pendingPreviewDetail.batch) }} · kedaluwarsa {{ formatDate(pendingPreviewDetail.batch.preview_expires_at) }}</p>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-2">
            <button type="button" class="data-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold" :disabled="pendingPreviewBusy || !canApproveManagedPreview" @click="openConfirmDialog"><Check :size="14" />Setujui & import</button>
            <button type="button" class="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50" :disabled="pendingPreviewBusy" @click="openCancelBatch(pendingPreviewDetail.batch)"><X :size="14" />Tolak & batalkan</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 border-b border-slate-200 px-5 py-4 sm:grid-cols-4">
          <div class="rounded-lg bg-slate-50 p-3"><p class="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total baris</p><p class="mt-1 text-lg font-black text-slate-900">{{ formatDisplayNumber(Number(pendingPreviewDetail.batch.total_rows)) }}</p></div>
          <div class="rounded-lg bg-emerald-50 p-3"><p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Valid</p><p class="mt-1 text-lg font-black text-emerald-800">{{ formatDisplayNumber(pendingPreviewCounts.valid) }}</p></div>
          <div class="rounded-lg bg-amber-50 p-3"><p class="text-[10px] font-bold uppercase tracking-wide text-amber-700">Warning</p><p class="mt-1 text-lg font-black text-amber-800">{{ formatDisplayNumber(pendingPreviewCounts.warning) }}</p></div>
          <div class="rounded-lg bg-rose-50 p-3"><p class="text-[10px] font-bold uppercase tracking-wide text-rose-700">Invalid</p><p class="mt-1 text-lg font-black text-rose-800">{{ formatDisplayNumber(pendingPreviewCounts.invalid) }}</p></div>
        </div>
        <div class="border-b border-slate-200 p-4 sm:px-5">
          <SectorPreviewSummary :summary="pendingPreviewDetail.sector_summary" />
        </div>
        <div v-if="new Date(pendingPreviewDetail.batch.preview_expires_at).getTime() <= Date.now()" role="status" class="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">Preview ini sudah kedaluwarsa dan tidak dapat disetujui. Upload ulang file untuk membuat preview baru.</div>
        <div v-else-if="!previewTokens[String(pendingPreviewDetail.batch.id)]" role="status" class="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">Token persetujuan batch ini tidak tersedia pada sesi browser. Untuk menjaga keamanan, batch lama ini tidak dapat disetujui dari sini. Upload ulang file untuk membuat preview baru, atau batalkan preview ini.</div>
        <div v-else-if="pendingPreviewCounts.invalid > 0 || pendingPreviewCounts.valid === 0" role="status" class="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800">Persetujuan diblokir karena harus ada baris valid dan tidak boleh ada baris invalid.</div>
        <div v-if="pendingPreviewDetail.comparison" class="border-b border-slate-200 px-5 py-4 sm:px-6">
          <VersionComparisonPanel
            :comparison="pendingPreviewDetail.comparison"
            :busy="pendingPreviewBusy"
            title="Perbandingan usulan dengan versi aktif"
            compact
            @page-change="page => openManagedPreview(pendingPreviewDetail.batch, pendingPreviewDetailPage, page)"
          />
        </div>
        <div v-else role="status" class="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">Comparison belum tersedia untuk preview ini. Upload ulang agar preview merekam versi dasar yang akan dibandingkan.</div>
        <div class="max-h-[55vh] overflow-auto" :class="pendingPreviewBusy ? 'opacity-60' : ''">
          <table class="data-table w-full min-w-[1050px] text-left text-xs">
            <thead class="sticky top-0 z-10"><tr><th class="px-3 py-3">Baris</th><th v-for="header in managedPreviewDisplayHeaders" :key="header" class="px-3 py-3">{{ header }}</th><th class="px-3 py-3">Validasi</th></tr></thead>
            <tbody>
              <tr v-for="row in pendingPreviewRows" :key="row.id" class="border-t border-slate-100 align-top">
                <td class="px-3 py-2 tabular-nums text-slate-500">{{ row.source_row_number }}</td>
                <td v-for="header in managedPreviewDisplayHeaders" :key="header" class="max-w-64 whitespace-normal break-words px-3 py-2"><span>{{ row.raw_data?.[header] ?? '-' }}</span><span v-if="header === 'NILAI'" class="mt-1 block text-slate-500">Normal: {{ formatNullableDecimal(row.normalized_data?.nilai) }} · {{ row.normalized_data?.value_status }}</span></td>
                <td class="max-w-64 whitespace-normal break-words px-3 py-2"><StatusBadge :status="row.validation_status" /><ul v-if="row.validation_errors?.length" class="mt-1 list-inside list-disc space-y-1 text-rose-700"><li v-for="(message, index) in row.validation_errors" :key="index">{{ message }}</li></ul></td>
              </tr>
              <tr v-if="pendingPreviewRows.length === 0"><td :colspan="managedPreviewDisplayHeaders.length + 2" class="px-4 py-8 text-center text-slate-500">Tidak ada baris preview pada halaman ini.</td></tr>
            </tbody>
          </table>
        </div>
        <PaginationBar :page="pendingPreviewDetailPage" :total-pages="pendingPreviewDetail.pagination.total_pages" :total="pendingPreviewDetail.pagination.total" :busy="pendingPreviewBusy" @change="page => openManagedPreview(pendingPreviewDetail.batch, page)" />
      </section>
    </template>

    <template v-else-if="activeTab === 'versions'">
      <div class="data-panel overflow-hidden rounded-[22px]">
        <div class="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <p class="data-section-label">Versi data</p>
          <div class="sm:ml-auto sm:text-right">
            <h2 class="mt-1 text-xl font-black text-slate-900">Riwayat versi</h2>
            <p class="mt-1 text-xs text-slate-500">{{ formatDisplayNumber(historyPagination.total) }} versi tercatat</p>
          </div>
        </div>
        <HistoryFilters v-model:dataset="datasetFilter" v-model:year="yearFilter" v-model:status="statusFilter" v-model:search="historySearch" v-model:sort="versionSort" :show-status="true" :show-sort="true" />
        <section class="p-3 sm:p-4">
          <div class="data-table-shell overflow-x-auto">
          <table class="data-table w-full min-w-[1180px] text-left text-sm">
            <thead class="sticky top-0 z-10"><tr><th class="px-4 py-3">Dataset</th><th class="px-4 py-3">Periode</th><th class="px-4 py-3">Versi / status</th><th class="px-4 py-3">File sumber</th><th class="px-4 py-3 text-right">Baris</th><th class="px-4 py-3">Diperbarui / diimpor</th><th class="px-4 py-3">Batch</th><th class="px-4 py-3">Alasan perubahan</th><th class="px-4 py-3 text-right">Aksi</th></tr></thead>
            <tbody>
              <tr v-for="version in versions" :key="version.id" class="group border-t border-slate-100 transition-colors hover:bg-teal-50/40">
                <td class="px-4 py-3.5">
                  <div class="flex items-center gap-3">
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-teal-700 shadow-sm"><Database :size="16" /></span>
                    <span class="font-semibold leading-5 text-slate-800">{{ datasetLabels[version.dataset_key] || version.dataset_key }}</span>
                  </div>
                </td>
                <td class="whitespace-nowrap px-4 py-3.5"><span class="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold tabular-nums text-slate-700">{{ formatPeriod(version) }}</span></td>
                <td class="px-4 py-3.5"><div class="flex flex-col items-start gap-1.5"><span class="font-mono text-xs font-bold text-slate-800">v{{ version.version_number }}</span><StatusBadge :status="version.status" /></div></td>
                <td class="max-w-56 px-4 py-3.5"><span class="block truncate text-slate-700" :title="version.original_filename || 'Baseline'">{{ version.original_filename || 'Baseline' }}</span><span v-if="!version.original_filename" class="mt-0.5 block text-[11px] text-slate-400">Versi awal</span></td>
                <td class="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">{{ formatDisplayNumber(Number(version.row_count)) }}</td>
                <td class="whitespace-nowrap px-4 py-3.5 text-xs text-slate-600">{{ formatDate(version.updated_at || version.activated_at || version.created_at) }}</td>
                <td class="px-4 py-3.5"><span v-if="version.import_batch_id" class="rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-600">#{{ version.import_batch_id }}</span><span v-else class="text-slate-400">—</span></td>
                <td class="max-w-64 px-4 py-3.5 text-slate-600" :title="version.change_reason || '—'"><span class="block truncate">{{ version.change_reason || '—' }}</span></td>
                <td class="px-4 py-3.5">
                  <div class="flex items-center justify-end gap-1">
                    <button type="button" class="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-900" :aria-label="`Detail versi ${version.version_number}`" title="Lihat detail versi" @click="openVersionDetail(version)"><Search :size="15" /></button>
                    <button v-if="version.status !== 'active'" type="button" class="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-teal-700 transition hover:border-teal-200 hover:bg-teal-50" :aria-label="`Pulihkan versi ${version.version_number}`" title="Pulihkan versi" @click="openVersionAction('restore', version)"><ArchiveRestore :size="15" /></button>
                    <button v-if="version.status !== 'deleted'" type="button" class="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-rose-600 transition hover:border-rose-200 hover:bg-rose-50" :aria-label="`Nonaktifkan versi ${version.version_number}`" title="Nonaktifkan versi" @click="openVersionAction('delete', version)"><Trash2 :size="15" /></button>
                  </div>
                </td>
              </tr>
              <tr v-if="versions.length === 0"><td colspan="9" class="px-4 py-14 text-center"><div class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><History :size="20" /></div><p class="mt-3 text-sm font-semibold text-slate-700">Tidak ada versi yang cocok</p><p class="mt-1 text-xs text-slate-500">Ubah filter dataset, tahun, atau status.</p></td></tr>
            </tbody>
          </table>
          </div>
          <PaginationBar :page="historyPage" :total-pages="historyPagination.total_pages" :total="historyPagination.total" @change="changeHistoryPage" />
        </section>
      </div>
    </template>

    <template v-else-if="activeTab === 'audit'">
      <HistoryFilters v-model:dataset="datasetFilter" v-model:year="yearFilter" v-model:status="statusFilter" v-model:search="historySearch" :show-status="false" />
      <section class="overflow-x-auto border-y border-slate-200 bg-white">
        <table class="w-full min-w-[950px] text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500"><tr><th class="px-4 py-3">Waktu</th><th class="px-4 py-3">Aktivitas</th><th class="px-4 py-3">Dataset / periode</th><th class="px-4 py-3">Versi sebelum</th><th class="px-4 py-3">Versi sesudah</th><th class="px-4 py-3">Batch</th><th class="px-4 py-3">Keterangan</th></tr></thead>
          <tbody><tr v-for="event in auditEvents" :key="event.id" class="border-t border-slate-100"><td class="whitespace-nowrap px-4 py-3">{{ formatDate(event.created_at) }}</td><td class="px-4 py-3"><StatusBadge :status="event.event_type" /></td><td class="px-4 py-3">{{ datasetLabels[event.dataset_key] || event.dataset_key }} · {{ formatPeriod(event) }}</td><td class="px-4 py-3 tabular-nums">{{ event.previous_version_id ?? '—' }}</td><td class="px-4 py-3 tabular-nums">{{ event.version_id ?? '—' }}</td><td class="px-4 py-3 font-mono text-xs">{{ event.batch_id ?? '—' }}</td><td class="max-w-72 truncate px-4 py-3" :title="event.reason">{{ event.reason || '—' }}</td></tr><tr v-if="auditEvents.length === 0"><td colspan="7" class="px-4 py-10 text-center text-slate-500">Belum ada aktivitas tercatat.</td></tr></tbody>
        </table>
        <PaginationBar :page="historyPage" :total-pages="historyPagination.total_pages" :total="historyPagination.total" @change="changeHistoryPage" />
      </section>
    </template>

    <Teleport to="body">
    <div v-if="versionDetail || versionDetailBusy" class="fixed inset-0 z-[78] flex items-center justify-center overflow-hidden bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" @click.self="versionDetail = null">
      <section role="dialog" aria-modal="true" aria-labelledby="version-detail-title" class="flex max-h-[90dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header class="flex items-start justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <div>
            <h2 id="version-detail-title" class="text-lg font-bold text-slate-900">Detail versi</h2>
            <p v-if="versionDetail" class="mt-1 text-sm text-slate-500">{{ datasetLabels[versionDetail.version.dataset_key] }} · {{ formatPeriod(versionDetail.version) }} · Versi {{ versionDetail.version.version_number }}</p>
          </div>
          <button type="button" aria-label="Tutup detail versi" @click="versionDetail = null"><X :size="18" /></button>
        </header>
        <p v-if="versionDetailBusy" role="status" class="p-8 text-center text-sm text-slate-500">Memuat detail versi...</p>
        <template v-else-if="versionDetail">
          <div class="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-4 sm:px-6">
            <div><p class="text-xs text-slate-500">Status</p><StatusBadge :status="versionDetail.version.status" /></div>
            <div><p class="text-xs text-slate-500">Jumlah baris</p><p class="mt-1 font-bold">{{ formatDisplayNumber(Number(versionDetail.version.row_count)) }}</p></div>
            <div><p class="text-xs text-slate-500">Versi sebelumnya</p><p class="mt-1 font-bold">{{ versionDetail.previous_version?.version_number ?? 'Baseline' }}</p></div>
            <div><p class="text-xs text-slate-500">Perubahan jumlah baris</p><p class="mt-1 font-bold">{{ versionDetail.comparison?.row_count_delta ?? '—' }}</p></div>
          </div>
          <p class="border-b border-slate-200 px-4 py-3 text-sm text-slate-600 sm:px-6">{{ versionDetail.version.change_reason || 'Tidak ada keterangan perubahan.' }} · {{ versionDetail.version.original_filename || 'Baseline' }}</p>
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:px-6">
            <VersionComparisonPanel
              v-if="versionDetail.comparison"
              :comparison="versionDetail.comparison"
              :title="`Versi ${versionDetail.comparison.previous_version_number} dibanding versi ${versionDetail.comparison.current_version_number}`"
              @page-change="page => openVersionDetail(versionDetail.version, page)"
            />
            <p v-else role="status" class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Versi baseline belum memiliki versi sebelumnya untuk dibandingkan.</p>
            <details class="group mt-5 border-t border-slate-200 pt-4" @toggle="refreshVersionSampleMetrics">
              <summary class="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
                <span class="flex min-w-0 items-center gap-2">
                  <span class="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 transition duration-200 group-hover:border-teal-300 group-hover:text-teal-700 group-open:rotate-180 group-open:border-teal-200 group-open:bg-teal-50 group-open:text-teal-700"><ChevronDown :size="15" /></span>
                  <span>Sampel data versi ini</span>
                </span>
                <span class="text-xs font-normal text-slate-500">Menampilkan {{ formatDisplayNumber(versionDetail.sample_rows?.length || 0) }} dari {{ formatDisplayNumber(Number(versionDetail.version.row_count)) }} baris</span>
              </summary>
              <div v-if="versionDetail.sample_rows?.length" class="mt-3 rounded-lg border border-slate-200 bg-white">
                <div ref="versionSampleTableScroll" role="region" aria-label="Sampel data versi" tabindex="0" class="overflow-x-hidden" @scroll="syncVersionSampleScroll('table')">
                  <table ref="versionSampleTable" class="data-table w-full min-w-[1200px] text-left text-xs">
                    <thead><tr><th v-for="([key, label]) in versionSampleDisplayColumns" :key="key" class="sticky top-0 z-10 whitespace-nowrap px-3 py-3">{{ label }}</th></tr></thead>
                    <tbody>
                      <tr v-for="(row, rowIndex) in versionDetail.sample_rows" :key="rowIndex" class="border-t border-slate-100 align-top">
                        <td v-for="([key]) in versionSampleDisplayColumns" :key="key" class="px-3 py-2.5 text-slate-700" :class="key === 'konsep' ? 'max-w-[360px] truncate' : ['rincian', 'neraca_rincian', 'transaksi'].includes(key) ? 'max-w-[360px] whitespace-normal break-words' : 'whitespace-nowrap'" :title="key === 'konsep' ? row[key] : undefined">
                          <span :class="['nilai', 'nilai_raw', 'transaksi_raw'].includes(key) ? 'font-mono tabular-nums' : ''">{{ key === 'nilai' ? formatNullableDecimal(row[key]) : row[key] === null || row[key] === undefined || row[key] === '' ? '-' : row[key] }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-if="versionSampleHasOverflow" ref="versionSampleRail" role="region" aria-label="Scroll horizontal tabel sampel" tabindex="0" class="sticky bottom-0 z-20 h-3 overflow-x-auto overflow-y-hidden border-t border-slate-200 bg-slate-50" @scroll="syncVersionSampleScroll('rail')">
                  <div class="h-px" :style="{ width: `${versionSampleContentWidth}px` }"></div>
                </div>
              </div>
              <p v-else class="mt-3 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">Tidak ada sampel baris untuk versi ini.</p>
            </details>
          </div>
        </template>
      </section>
    </div>

    <div v-if="batchDetail" class="fixed inset-0 z-[75] flex items-center justify-center overflow-hidden bg-slate-950/55 p-2 backdrop-blur-sm sm:p-5" @click.self="batchDetail = null">
      <section role="dialog" aria-modal="true" aria-labelledby="batch-detail-title" :aria-busy="batchDetailBusy" class="flex max-h-[94vh] w-full max-w-[1440px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[92vh]">
        <header class="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-6">
          <div class="min-w-0">
            <p class="data-section-label">Rincian import · {{ datasetLabels[batchDetail.batch.dataset_key] || batchDetail.batch.dataset_key }}</p>
            <h2 id="batch-detail-title" class="mt-1 truncate text-lg font-bold text-slate-900 sm:text-xl">{{ batchDetail.batch.original_filename }}</h2>
            <p class="mt-1 text-sm text-slate-500">Batch #{{ batchDetail.batch.id }} · {{ formatPeriod(batchDetail.batch) }} · dibuat {{ formatDate(batchDetail.batch.created_at) }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button
              v-if="batchDetail.version && batchDetail.version.status !== 'deleted'"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
              @click="openVersionAction('delete', batchDetail.version)"
            ><Trash2 :size="14" /><span class="hidden sm:inline">Hapus data import</span><span class="sm:hidden">Hapus</span></button>
            <button
              v-if="!batchDetail.version && ['previewed', 'expired', 'failed'].includes(batchDetail.batch.status)"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
              @click="openCancelBatch(batchDetail.batch)"
            ><Trash2 :size="14" /><span>Hapus preview</span></button>
            <button type="button" aria-label="Tutup detail batch" class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" @click="batchDetail = null"><X :size="18" /></button>
          </div>
        </header>

        <div class="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:grid-cols-3 sm:gap-3 sm:px-6 xl:grid-cols-6">
          <div class="rounded-lg bg-slate-50 px-3 py-2"><p class="text-[10px] font-bold uppercase tracking-wide text-slate-500">Status batch</p><div class="mt-1"><StatusBadge :status="batchDetail.batch.status" /></div></div>
          <div class="rounded-lg bg-slate-50 px-3 py-2"><p class="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total baris</p><p class="mt-1 text-lg font-bold tabular-nums text-slate-900">{{ formatDisplayNumber(Number(batchDetail.batch.total_rows)) }}</p></div>
          <div class="rounded-lg bg-emerald-50/70 px-3 py-2"><p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Valid</p><p class="mt-1 text-lg font-bold tabular-nums text-emerald-800">{{ formatDisplayNumber(Number(batchDetail.validation_counts.valid || 0)) }}</p></div>
          <div class="rounded-lg bg-amber-50/70 px-3 py-2"><p class="text-[10px] font-bold uppercase tracking-wide text-amber-700">Warning</p><p class="mt-1 text-lg font-bold tabular-nums text-amber-800">{{ formatDisplayNumber(Number(batchDetail.validation_counts.warning || 0)) }}</p></div>
          <div class="rounded-lg bg-rose-50/70 px-3 py-2"><p class="text-[10px] font-bold uppercase tracking-wide text-rose-700">Invalid</p><p class="mt-1 text-lg font-bold tabular-nums text-rose-800">{{ formatDisplayNumber(Number(batchDetail.validation_counts.invalid || 0)) }}</p></div>
          <div class="rounded-lg bg-slate-50 px-3 py-2"><p class="text-[10px] font-bold uppercase tracking-wide text-slate-500">Versi data</p><p class="mt-1 text-sm font-bold text-slate-900">{{ batchDetail.version ? `Versi ${batchDetail.version.version_number} · ${batchDetail.version.status}` : 'Belum dibuat' }}</p></div>
        </div>

        <div class="min-h-0 flex-1 overflow-auto" :class="batchDetailBusy ? 'opacity-60' : ''">
          <table v-if="batchDetail.rows.length" class="w-full min-w-[1450px] border-collapse text-left text-xs">
            <thead class="sticky top-0 z-10 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600 shadow-sm">
              <tr>
                <th class="w-16 px-3 py-3 text-right">Baris</th><th v-for="header in batchDetailDisplayHeaders" :key="header" class="min-w-32 px-3 py-3">{{ header }}</th><th class="w-40 px-3 py-3">Nilai normalisasi</th><th class="w-56 px-3 py-3">Validasi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in batchDetail.rows" :key="row.id" class="border-b border-slate-100 align-top transition-colors hover:bg-teal-50/30">
                <td class="px-3 py-3 text-right tabular-nums text-slate-500">{{ row.source_row_number }}</td>
                <td v-for="header in batchDetailDisplayHeaders" :key="header" class="whitespace-normal break-words px-3 py-3" :class="header === 'SEKTOR' ? 'font-medium text-slate-800' : ''">{{ row.raw_data?.[header] ?? '—' }}</td>
                <td class="whitespace-normal break-words px-3 py-3"><span class="font-mono tabular-nums">{{ formatNullableDecimal(row.normalized_data?.nilai) }}</span><span class="mt-1 block text-[10px] text-slate-500">{{ row.normalized_data?.value_status || '—' }}</span></td>
                <td class="whitespace-normal break-words px-3 py-3"><StatusBadge :status="row.validation_status" /><ul v-if="row.validation_errors?.length" class="mt-2 list-inside list-disc space-y-1 text-rose-700"><li v-for="(message, index) in row.validation_errors" :key="index">{{ message }}</li></ul><span v-else class="mt-1 block text-[10px] text-slate-500">Tidak ada catatan</span></td>
              </tr>
            </tbody>
          </table>
          <div v-else class="flex min-h-56 flex-col items-center justify-center px-6 text-center">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><FileSpreadsheet :size="22" /></div>
            <p class="mt-3 text-sm font-semibold text-slate-800">Tidak ada baris untuk ditampilkan</p>
            <p class="mt-1 text-xs text-slate-500">Coba pindah halaman atau periksa status batch ini.</p>
          </div>
        </div>
        <PaginationBar :page="batchDetailPage" :total-pages="batchDetail.pagination.total_pages" :total="batchDetail.pagination.total" :busy="batchDetailBusy" @change="page => openBatchDetail(batchDetail.batch, page)" />
      </section>
    </div>

    <div v-if="preview && showConfirmDialog" class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" @click.self="showConfirmDialog = false">
      <section role="dialog" aria-modal="true" aria-labelledby="confirm-title" class="w-full max-w-xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-semibold uppercase text-teal-700">Konfirmasi tindakan</p><h2 id="confirm-title" class="mt-1 text-lg font-bold text-slate-900">Import {{ datasetLabels[preview.dataset_key] || 'dataset' }}</h2></div><button type="button" aria-label="Tutup dialog" @click="showConfirmDialog = false"><X :size="18" /></button></div>
        <dl class="mt-5 grid grid-cols-2 gap-3 text-sm"><div><dt class="text-slate-500">Dataset / periode</dt><dd class="mt-1 font-semibold">{{ datasetLabels[preview.dataset_key] || preview.dataset_key }} · {{ formatPeriod(preview) }}</dd></div><div><dt class="text-slate-500">Mode import</dt><dd class="mt-1 font-semibold">Replace Period · snapshot lengkap</dd></div><div><dt class="text-slate-500">Nama file</dt><dd class="mt-1 truncate font-semibold">{{ selectedFile?.name || preview.original_filename || 'Workbook preview' }}</dd></div><div><dt class="text-slate-500">Baris valid</dt><dd class="mt-1 font-semibold">{{ preview.valid_rows }}</dd></div><div><dt class="text-slate-500">Versi aktif</dt><dd class="mt-1 font-semibold">{{ currentActiveVersion ? `Versi ${currentActiveVersion.version_number} · ${currentActiveVersion.row_count} baris; akan menjadi revisi` : 'Periode baru' }}</dd></div></dl>
        <p v-if="preview.warning_rows" class="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Terdapat {{ preview.warning_rows }} baris warning. Nilai mentah dan status kualitas akan dipertahankan.</p>
        <label class="mt-4 block text-xs font-semibold text-slate-600">Alasan perubahan (opsional)<input v-model="confirmReason" maxlength="1000" class="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"></label>
        <label class="mt-4 flex items-start gap-2 text-sm text-slate-700"><input v-model="confirmConsent" type="checkbox" class="mt-1 accent-teal-700"><span>Saya menyetujui import ini dan memahami bahwa versi aktif akan digantikan; versi lama tetap tersimpan.</span></label>
        <div class="mt-5 flex justify-end gap-2"><button type="button" class="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" @click="showConfirmDialog = false">Batal</button><button type="button" class="rounded-md bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="!canConfirmImport || confirming" @click="handleConfirmImport">{{ confirming ? 'Menyimpan...' : 'Konfirmasi dan simpan versi' }}</button></div>
      </section>
    </div>

    <div v-if="actionDialog" class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" @click.self="actionDialog = null">
      <section role="dialog" aria-modal="true" class="w-full max-w-lg border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <h2 class="text-lg font-bold text-slate-900">{{ actionDialog.action === 'restore' ? 'Pulihkan versi' : actionDialog.version.import_batch_id ? 'Hapus data import' : 'Nonaktifkan versi' }}</h2>
        <p class="mt-2 text-sm text-slate-600">{{ actionDialog.action === 'restore' ? 'Versi terpilih akan menjadi aktif dan versi aktif saat ini akan tetap tersimpan sebagai nonaktif.' : 'Seluruh data pada versi ini akan dinonaktifkan dari dashboard. Baris dan riwayat tetap tersimpan, dan versi dapat dipulihkan dari Riwayat Versi.' }}</p>
        <p class="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold">{{ datasetLabels[actionDialog.version.dataset_key] || actionDialog.version.dataset_key }} · {{ formatPeriod(actionDialog.version) }} · Versi {{ actionDialog.version.version_number }}</p>
        <label class="mt-4 block text-xs font-semibold text-slate-600">Alasan<input v-model="actionReason" maxlength="1000" class="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"></label>
        <div class="mt-5 flex justify-end gap-2"><button type="button" class="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold" @click="actionDialog = null">Batal</button><button type="button" class="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :class="actionDialog.action === 'restore' ? 'bg-teal-800' : 'bg-rose-700'" :disabled="actionBusy" @click="performVersionAction">{{ actionBusy ? 'Memproses...' : actionDialog.action === 'restore' ? 'Pulihkan versi' : 'Hapus data import' }}</button></div>
      </section>
    </div>
    <div v-if="cancelBatchDialog" class="fixed inset-0 z-[82] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm" @click.self="cancelBatchDialog = null">
      <section role="dialog" aria-modal="true" aria-labelledby="cancel-batch-title" class="my-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><Trash2 :size="18" /></div>
          <div>
            <h2 id="cancel-batch-title" class="text-lg font-bold text-slate-900">{{ cancelBatchDialog.action === 'reject' ? 'Tolak pengajuan import?' : 'Batalkan preview import?' }}</h2>
            <p class="mt-1 text-sm text-slate-600">{{ cancelBatchDialog.original_filename }} · {{ formatPeriod(cancelBatchDialog) }} · Batch #{{ cancelBatchDialog.id }}</p>
          </div>
        </div>
        <p class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-900">Semua baris staging dan token preview akan dicabut. Data aktif tidak berubah; alasan dan aktivitas {{ cancelBatchDialog.action === 'reject' ? 'penolakan' : 'pembatalan' }} dicatat.</p>
        <p v-if="cancelBatchError" role="alert" class="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{{ cancelBatchError }}</p>
        <label class="mt-4 block text-xs font-semibold text-slate-600">Alasan penolakan / pembatalan *<textarea v-model="cancelBatchReason" required maxlength="1000" rows="3" class="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"></textarea></label>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" :disabled="cancelBatchBusy" @click="cancelBatchDialog = null">Batal</button>
          <button type="button" class="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="cancelBatchBusy" @click="performCancelBatch"><LoaderCircle v-if="cancelBatchBusy" :size="15" class="animate-spin" /><Trash2 v-else :size="15" />{{ cancelBatchBusy ? 'Menyimpan...' : cancelBatchDialog.action === 'reject' ? 'Tolak pengajuan' : 'Batalkan preview' }}</button>
        </div>
      </section>
    </div>
    </Teleport>
  </div>
</template>
