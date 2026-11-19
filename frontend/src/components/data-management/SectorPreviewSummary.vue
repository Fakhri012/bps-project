<script setup>
import { formatDisplayNumber, formatNullableDecimal } from '../../utils/displayFormatters.js'

defineProps({
  summary: { type: Object, default: null }
})
</script>

<template>
  <section v-if="summary" class="data-panel rounded-xl p-4 sm:p-5" aria-label="Ringkasan sektor preview">
    <div class="grid grid-cols-3 gap-2 sm:gap-3">
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p class="text-[10px] font-bold uppercase tracking-wide text-slate-500">Sektor existing</p>
        <p class="mt-1 text-lg font-black tabular-nums text-slate-800">{{ formatDisplayNumber(summary.existing?.length || 0) }}</p>
      </div>
      <div class="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
        <p class="text-[10px] font-bold uppercase tracking-wide text-sky-700">Sektor baru</p>
        <p class="mt-1 text-lg font-black tabular-nums text-sky-900">{{ formatDisplayNumber(summary.new_sector_count || 0) }}</p>
      </div>
      <div class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
        <p class="text-[10px] font-bold uppercase tracking-wide text-rose-700">Konflik identitas</p>
        <p class="mt-1 text-lg font-black tabular-nums text-rose-900">{{ formatDisplayNumber(summary.conflict_count || 0) }}</p>
      </div>
    </div>

    <p v-if="summary.new_sector_count" class="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-sky-900">
      Sistem menemukan {{ formatDisplayNumber(summary.new_sector_count) }} sektor baru. Sektor akan didaftarkan ke master sektor saat pengajuan disetujui.
    </p>

    <div v-if="summary.existing?.length" class="mt-4">
      <p class="text-xs font-bold text-slate-700">Sektor existing</p>
      <ul class="mt-2 flex flex-wrap gap-2">
        <li v-for="sector in summary.existing" :key="sector.sector_code" class="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
          <span class="font-semibold">{{ sector.sector_code }}</span>
          <span class="ml-1.5 text-slate-500">{{ formatDisplayNumber(sector.record_count) }} record</span>
        </li>
      </ul>
    </div>

    <div v-if="summary.new?.length" class="mt-4">
      <h3 class="text-xs font-bold text-slate-800">Sektor baru terdeteksi</h3>
      <article v-for="sector in summary.new" :key="sector.sector_code" class="mt-2 border-t border-slate-200 pt-3 first:border-t-0 first:pt-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p class="text-sm font-bold text-slate-900">{{ sector.sector_code }}</p>
            <span class="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">Belum terdaftar</span>
          </div>
          <p class="text-xs text-slate-500">{{ formatDisplayNumber(sector.record_count) }} record</p>
        </div>
        <div class="mt-2 max-h-52 overflow-auto rounded-lg border border-slate-200">
          <table class="w-full table-fixed text-left text-xs">
            <colgroup><col class="w-[18%]"><col class="w-[52%]"><col class="w-[30%]"></colgroup>
            <thead class="sticky top-0 bg-slate-50 text-slate-500">
              <tr><th class="px-2.5 py-2">Kode</th><th class="px-2.5 py-2">Rincian</th><th class="px-2.5 py-2 text-right">Nilai</th></tr>
            </thead>
            <tbody>
              <tr v-for="(record, index) in sector.records" :key="`${record.kode}-${index}`" class="border-t border-slate-100">
                <td class="break-words px-2.5 py-2 font-mono text-slate-700">{{ record.kode || '—' }}</td>
                <td class="break-words px-2.5 py-2 text-slate-700">{{ record.rincian || '—' }}</td>
                <td class="break-all px-2.5 py-2 text-right font-mono tabular-nums text-slate-700">{{ formatNullableDecimal(record.nilai) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>

    <div v-if="summary.conflicts?.length" class="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
      <h3 class="text-xs font-bold text-rose-900">Konflik identitas sektor</h3>
      <p class="mt-1 text-xs leading-relaxed text-rose-800">Sektor dengan identitas master yang bertentangan tidak akan dibuat otomatis. Periksa nama/kode master dan perbaiki file sebelum pengajuan.</p>
      <ul class="mt-2 space-y-1 text-xs text-rose-900">
        <li v-for="sector in summary.conflicts" :key="sector.sector_code">{{ sector.sector_code }} · {{ formatDisplayNumber(sector.record_count) }} record</li>
      </ul>
    </div>
  </section>
</template>