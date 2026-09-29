<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },

  value: {
    type: [String, Number],
    default: '-'
  },

  description: {
    type: String,
    default: ''
  },

  icon: {
    type: [Object, Function],
    default: null
  }
})
</script>

<template>
  <div
    class="group relative overflow-hidden
           rounded-2xl border border-slate-200
           bg-white p-6 shadow-sm
           transition duration-300
           hover:-translate-y-1
           hover:shadow-md"
  >
    <div
      class="flex items-start
             justify-between gap-4"
    >
      <div class="min-w-0">
        <p
          class="text-sm font-medium
                 text-slate-500"
        >
          {{ title }}
        </p>

        <h3
          class="mt-3 text-3xl
                 font-bold tracking-tight
                 text-slate-900"
        >
          {{ value }}
        </h3>

        <p
          v-if="description"
          class="mt-3 text-xs
                 text-slate-400"
        >
          {{ description }}
        </p>
      </div>

      <div
        v-if="icon"
        class="flex h-11 w-11
               shrink-0 items-center
               justify-center rounded-xl
               bg-blue-50 text-blue-600
               transition
               group-hover:bg-blue-600
               group-hover:text-white"
      >
        <component
          :is="icon"
          :size="21"
          :stroke-width="1.8"
        />
      </div>
    </div>
  </div>
</template>