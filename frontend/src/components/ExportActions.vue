<script setup>
import {
  Download,
  FileText
} from 'lucide-vue-next'

defineProps({
  csvDisabled: {
    type: Boolean,
    default: false
  },
  pdfDisabled: {
    type: Boolean,
    default: false
  },
  pdfBusy: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'csv',
  'pdf'
])
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" data-html2canvas-ignore="true">
    <button
      type="button"
      :disabled="csvDisabled"
      class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
      @click="emit('csv')"
    >
      <Download :size="14" />
      Export CSV
    </button>

    <button
      type="button"
      :disabled="pdfDisabled || pdfBusy"
      class="inline-flex h-9 items-center gap-2 rounded-lg border border-teal-700 bg-teal-700 px-3 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
      @click="emit('pdf')"
    >
      <FileText :size="14" />
      {{ pdfBusy ? 'Membuat PDF...' : 'Export PDF' }}
    </button>
  </div>
</template>