<script setup>
import { ref } from 'vue'
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-vue-next'
import { refreshCache } from '../services/dashboardApi'

defineProps({
  variant: {
    type: String,
    default: 'light'
  },
  compact: {
    type: Boolean,
    default: false
  }
})

const refreshing = ref(false)
const message = ref('')
const failed = ref(false)

function formatRefreshTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(date)
}

async function handleRefresh() {
  if (refreshing.value) {
    return
  }

  refreshing.value = true
  message.value = ''
  failed.value = false

  try {
    const response = await refreshCache()
    const time = formatRefreshTime(response.refreshedAt)
    message.value = time
      ? `Data berhasil diperbarui pada ${time}.`
      : 'Data berhasil diperbarui.'
  } catch (error) {
    console.error('Gagal memperbarui cache dashboard:', error)
    failed.value = true
    message.value = error?.response?.data?.message ||
      'Gagal mengambil data terbaru. Cache lama tetap digunakan jika tersedia.'
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-end gap-1">
    <button
      type="button"
      :disabled="refreshing"
      :aria-label="refreshing ? 'Sedang mengambil data terbaru' : 'Ambil Data Terbaru'"
      title="Ambil Data Terbaru dari Google Sheets"
      :class="[
        variant === 'dark'
          ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20 focus-visible:outline-[#a4d3ff]'
          : 'border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-teal-600',
        compact ? 'h-8 px-2.5' : 'min-h-8 px-3 py-1.5'
      ]"
      class="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60 sm:text-xs"
      @click="handleRefresh"
    >
      <RefreshCw
        :size="14"
        :class="{ 'animate-spin': refreshing }"
        aria-hidden="true"
      />
      <span>
        {{ refreshing ? 'Mengambil data…' : 'Ambil Data Terbaru' }}
      </span>
    </button>
    <p
      v-if="message"
      role="status"
      aria-live="polite"
      class="flex max-w-[min(90vw,24rem)] items-start justify-end gap-1 text-right text-[10px] leading-4 sm:text-xs"
      :class="[
        compact ? 'max-w-[min(70vw,18rem)]' : '',
        failed
          ? (variant === 'dark' ? 'text-rose-200' : 'text-red-600')
          : (variant === 'dark' ? 'text-emerald-200' : 'text-emerald-700')
      ]"
    >
      <AlertCircle v-if="failed" :size="13" class="mt-0.5 shrink-0" aria-hidden="true" />
      <CheckCircle2 v-else :size="13" class="mt-0.5 shrink-0" aria-hidden="true" />
      {{ message }}
    </p>
  </div>
</template>
