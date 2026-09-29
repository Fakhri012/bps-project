<template>
  <div
    class="rounded-2xl border border-slate-200
           bg-white p-5 shadow-sm"
  >
    <div
      class="grid grid-cols-1 gap-4
             md:grid-cols-2 xl:grid-cols-5"
    >
      <!-- Tahun -->
      <div>
        <label class="mb-2 block text-xs font-semibold text-slate-600">
          Tahun
        </label>

        <select class="input-filter">
          <option>2026</option>
          <option>2025</option>
          <option>2024</option>
        </select>
      </div>

      <!-- Provinsi -->
      <div>
        <label class="mb-2 block text-xs font-semibold text-slate-600">
          Provinsi
        </label>

        <select class="input-filter">
          <option>Semua Provinsi</option>
          <option>DKI Jakarta</option>
          <option>Jawa Barat</option>
        </select>
      </div>

      <!-- Kabupaten -->
      <div>
        <label class="mb-2 block text-xs font-semibold text-slate-600">
          Kabupaten/Kota
        </label>

        <select class="input-filter">
          <option>Semua Kabupaten/Kota</option>
        </select>
      </div>

      <!-- Kecamatan -->
      <div>
        <label class="mb-2 block text-xs font-semibold text-slate-600">
          Kecamatan
        </label>

        <select class="input-filter">
          <option>Semua Kecamatan</option>
        </select>
      </div>

      <!-- Reset -->
      <div class="flex items-end">
        <button
          class="h-[42px] w-full rounded-xl bg-blue-600
                 text-sm font-semibold text-white
                 transition hover:bg-blue-700"
        >
          Reset Filter
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../../style.css";

.input-filter {
  @apply h-[42px] w-full rounded-xl border border-slate-200
         bg-white px-3 text-sm text-slate-700 outline-none
         transition focus:border-blue-500 focus:ring-2
         focus:ring-blue-100;
}
</style>