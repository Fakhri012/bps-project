<script setup>
import { ArrowLeft, ArrowRight } from 'lucide-vue-next'
import { formatDisplayNumber, formatNullableDecimal } from '../../utils/displayFormatters.js'

const props = defineProps({
  comparison: { type: Object, default: null },
  title: { type: String, default: 'Perbandingan nilai' },
  compact: { type: Boolean, default: false },
  busy: { type: Boolean, default: false }
})

const emit = defineEmits(['page-change'])

const identityLabels = {
  sektor: 'Sektor',
  periode: 'Periode',
  sisi: 'Sisi',
  jenis_neraca: 'Jenis neraca',
  jenis_rasio: 'Jenis rasio',
  kode: 'Kode',
  rincian: 'Rincian',
  neraca_rincian: 'Neraca - rincian',
  konsep: 'Konsep'
}

const changeLabels = {
  increased: 'Meningkat',
  decreased: 'Menurun',
  newly_filled: 'Baru terisi',
  newly_emptied: 'Dikosongkan',
  updated: 'Nilai berubah',
  metadata_updated: 'Metadata berubah',
  added: 'Ditambahkan',
  removed: 'Dihapus'
}

const changeTones = {
  increased: 'bg-emerald-100 text-emerald-800',
  decreased: 'bg-rose-100 text-rose-800',
  newly_filled: 'bg-sky-100 text-sky-800',
  newly_emptied: 'bg-amber-100 text-amber-800',
  updated: 'bg-amber-100 text-amber-800',
  metadata_updated: 'bg-slate-100 text-slate-700',
  added: 'bg-sky-100 text-sky-800',
  removed: 'bg-rose-100 text-rose-800'
}

const summaryItems = [
  { key: 'current_records', label: 'Record versi baru', color: 'border-sky-200 bg-sky-50 text-sky-900', recordCount: true },
  { key: 'unchanged', label: 'Tidak berubah', color: 'border-slate-200 bg-slate-50 text-slate-800' },
  { key: 'revised', label: 'Nilai direvisi', color: 'border-amber-200 bg-amber-50 text-amber-900' },
  { key: 'added', label: 'Ditambahkan', color: 'border-sky-200 bg-sky-50 text-sky-900' },
  { key: 'removed', label: 'Dihapus', color: 'border-rose-200 bg-rose-50 text-rose-900' },
  { key: 'increased', label: 'Meningkat', color: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  { key: 'decreased', label: 'Menurun', color: 'border-rose-200 bg-rose-50 text-rose-900' },
  { key: 'newly_filled', label: 'Baru terisi', color: 'border-sky-200 bg-sky-50 text-sky-900' },
  { key: 'newly_emptied', label: 'Dikosongkan', color: 'border-amber-200 bg-amber-50 text-amber-900' },
  { key: 'metadata_updated', label: 'Metadata berubah', color: 'border-slate-200 bg-slate-50 text-slate-800' }
]

function summaryValue(item) {
  return item.recordCount
    ? props.comparison?.records?.current ?? 0
    : props.comparison?.counts?.[item.key] ?? 0
}

function identityEntries(identity) {
  return Object.entries(identity || {}).map(([key, value]) => ({
    key,
    label: identityLabels[key] || key,
    value: value ?? '—'
  }))
}

function signedValue(value) {
  if (value === null || value === undefined) return '—'
  return `${String(value).startsWith('-') ? '' : '+'}${value}`
}
</script>

<template>
  <section v-if="comparison" aria-label="Perbandingan nilai" :class="compact ? 'py-4' : ''">
    <header class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="data-section-label">{{ title }}</p>
        <p v-if="comparison.previous_version_number" class="mt-1 text-sm font-bold text-slate-900">Versi {{ comparison.previous_version_number }} <span class="font-normal text-slate-500">dibanding</span> {{ comparison.current_version_number === 'Usulan' ? 'Usulan import' : `Versi ${comparison.current_version_number}` }}</p>
      </div>
      <p class="text-xs text-slate-500">Dicocokkan berdasarkan identitas data, bukan urutan baris.</p>
    </header>

    <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      <article v-for="item in summaryItems" :key="item.key" class="rounded-lg border p-3" :class="item.color">
        <p class="text-[10px] font-bold uppercase tracking-wide">{{ item.label }}</p>
        <p class="mt-1 text-xl font-black tabular-nums">{{ formatDisplayNumber(summaryValue(item)) }}</p>
      </article>
    </div>

    <div v-if="comparison.changes?.length" class="data-table-shell mt-4" :class="busy ? 'opacity-60' : ''">
      <div class="overflow-x-auto overscroll-x-contain" role="region" aria-label="Tabel perubahan perbandingan" tabindex="0">
        <table class="data-table w-full min-w-[1120px] text-left text-xs">
          <thead><tr><th class="px-3 py-3">Status</th><th class="px-3 py-3">Identitas data</th><th class="px-3 py-3">Nilai sebelumnya</th><th class="px-3 py-3">Nilai terbaru</th><th class="px-3 py-3">Selisih / perubahan</th></tr></thead>
          <tbody>
            <tr v-for="(change, index) in comparison.changes" :key="`${change.change_type}-${index}`" class="border-t border-slate-100 align-top">
              <td class="px-3 py-3"><span class="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold" :class="changeTones[change.change_type] || 'bg-slate-100 text-slate-700'">{{ changeLabels[change.change_type] || change.change_type }}</span></td>
              <td class="px-3 py-3">
                <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1"><template v-for="entry in identityEntries(change.identity)" :key="entry.key"><dt class="text-slate-500">{{ entry.label }}</dt><dd class="font-medium text-slate-800">{{ entry.value }}</dd></template></dl>
                <ul v-if="change.metadata_changes?.length" class="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[10px] text-slate-600"><li v-for="metadata in change.metadata_changes" :key="metadata.field">{{ identityLabels[metadata.field] || metadata.field }}: {{ metadata.previous_value ?? '—' }} → {{ metadata.current_value ?? '—' }}</li></ul>
              </td>
              <td class="px-3 py-3"><div v-if="change.previous_values?.length" class="space-y-2"><div v-for="(item, itemIndex) in change.previous_values" :key="itemIndex"><span class="font-mono font-semibold text-slate-900">{{ formatNullableDecimal(item.value) }}</span><span v-if="item.raw_value !== null && item.raw_value !== item.value" class="mt-0.5 block text-[10px] text-slate-500">Asli: {{ item.raw_value }}</span><span v-if="item.value_status" class="mt-0.5 block text-[10px] text-slate-500">{{ item.value_status }}</span></div></div><span v-else class="text-slate-400">—</span></td>
              <td class="px-3 py-3"><div v-if="change.current_values?.length" class="space-y-2"><div v-for="(item, itemIndex) in change.current_values" :key="itemIndex"><span class="font-mono font-semibold text-slate-900">{{ formatNullableDecimal(item.value) }}</span><span v-if="item.raw_value !== null && item.raw_value !== item.value" class="mt-0.5 block text-[10px] text-slate-500">Asli: {{ item.raw_value }}</span><span v-if="item.value_status" class="mt-0.5 block text-[10px] text-slate-500">{{ item.value_status }}</span></div></div><span v-else class="text-slate-400">—</span></td>
              <td class="px-3 py-3"><span v-if="change.delta !== null" class="font-mono font-bold" :class="change.change_type === 'increased' ? 'text-emerald-700' : change.change_type === 'decreased' ? 'text-rose-700' : 'text-slate-800'">{{ signedValue(change.delta) }}</span><span v-else class="text-slate-400">—</span><span v-if="change.percentage_change !== null && change.percentage_change_below_precision" class="mt-1 block text-[10px] text-slate-600">&lt;0,000000000000000001%</span><span v-else-if="change.percentage_change !== null" class="mt-1 block font-semibold tabular-nums" :class="change.change_type === 'increased' ? 'text-emerald-700' : change.change_type === 'decreased' ? 'text-rose-700' : 'text-slate-600'">{{ signedValue(change.percentage_change) }}%</span><span v-else-if="change.change_type === 'increased' || change.change_type === 'decreased'" class="mt-1 block text-[10px] text-amber-700">Persentase tidak tersedia untuk nilai awal 0.</span><span v-if="change.metadata_changes?.length" class="mt-1 block text-[10px] text-slate-500">Ada perubahan metadata.</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="comparison.pagination?.total_pages > 1" class="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        <span>{{ formatDisplayNumber(comparison.pagination.total) }} perubahan · halaman {{ comparison.pagination.page }} dari {{ comparison.pagination.total_pages }}</span>
        <div class="flex gap-2">
          <button type="button" class="flex h-8 w-8 items-center justify-center rounded border border-slate-300 disabled:opacity-40" aria-label="Halaman perbandingan sebelumnya" :disabled="busy || comparison.pagination.page <= 1" @click="emit('page-change', comparison.pagination.page - 1)"><ArrowLeft :size="14" /></button>
          <button type="button" class="flex h-8 w-8 items-center justify-center rounded border border-slate-300 disabled:opacity-40" aria-label="Halaman perbandingan berikutnya" :disabled="busy || comparison.pagination.page >= comparison.pagination.total_pages" @click="emit('page-change', comparison.pagination.page + 1)"><ArrowRight :size="14" /></button>
        </div>
      </div>
    </div>
    <p v-else class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Tidak ada perubahan nilai atau identitas data dibanding versi sebelumnya.</p>
  </section>
</template>
