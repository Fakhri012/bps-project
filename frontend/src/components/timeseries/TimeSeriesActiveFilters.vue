<script setup>
import {
  computed
} from 'vue'

import {
  Filter,
  X
} from 'lucide-vue-next'


/*
|--------------------------------------------------------------------------
| PROPS
|--------------------------------------------------------------------------
*/

const props =
  defineProps({
    filters: {
      type: Object,

      default: () => ({
        tahun: [],
        triwulan: [],
        sisi: [],
        neraca: [],
        klasifikasi: [],
        institusi: []
      })
    }
  })


/*
|--------------------------------------------------------------------------
| EMIT
|--------------------------------------------------------------------------
*/

const emit =
  defineEmits([
    'remove',
    'reset'
  ])


/*
|--------------------------------------------------------------------------
| NORMALIZE ARRAY
|--------------------------------------------------------------------------
*/

function toArray(
  value
) {
  if (
    Array.isArray(value)
  ) {
    return value
  }

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return []
  }

  return [
    value
  ]
}


/*
|--------------------------------------------------------------------------
| CHIP DATA
|--------------------------------------------------------------------------
*/

const chips =
  computed(() => {
    const result = []


    /*
    |--------------------------------------------------------------------------
    | TAHUN
    |--------------------------------------------------------------------------
    */

    toArray(
      props.filters.tahun
    ).forEach(
      value => {
        result.push({
          key:
            'tahun',

          group:
            'Tahun',

          value:
            String(value),

          label:
            String(value)
        })
      }
    )


    /*
    |--------------------------------------------------------------------------
    | TRIWULAN
    |--------------------------------------------------------------------------
    */

    toArray(
      props.filters.triwulan
    ).forEach(
      value => {
        const raw =
          String(value)

        result.push({
          key:
            'triwulan',

          group:
            'Triwulan',

          value:
            raw,

          label:
            raw
              .toUpperCase()
              .startsWith('Q')
                ? raw.toUpperCase()
                : `Q${raw}`
        })
      }
    )


    /*
    |--------------------------------------------------------------------------
    | JENIS / SISI
    |--------------------------------------------------------------------------
    */

    toArray(
      props.filters.sisi
    ).forEach(
      value => {
        result.push({
          key:
            'sisi',

          group:
            'Jenis',

          value:
            String(value),

          label:
            String(value)
        })
      }
    )


    /*
    |--------------------------------------------------------------------------
    | INSTITUSI
    |--------------------------------------------------------------------------
    */

    toArray(
      props.filters.institusi
    ).forEach(
      value => {
        result.push({
          key:
            'institusi',

          group:
            'Institusi',

          value:
            String(value),

          label:
            String(value)
        })
      }
    )


    /*
    |--------------------------------------------------------------------------
    | NERACA
    |--------------------------------------------------------------------------
    */

    toArray(
      props.filters.neraca
    ).forEach(
      value => {
        result.push({
          key:
            'neraca',

          group:
            'Neraca',

          value:
            String(value),

          label:
            String(value)
        })
      }
    )


    /*
    |--------------------------------------------------------------------------
    | KLASIFIKASI
    |--------------------------------------------------------------------------
    */

    toArray(
      props.filters.klasifikasi
    ).forEach(
      value => {
        result.push({
          key:
            'klasifikasi',

          group:
            'Klasifikasi',

          value:
            String(value),

          label:
            String(value)
        })
      }
    )


    return result
  })


/*
|--------------------------------------------------------------------------
| REMOVE
|--------------------------------------------------------------------------
*/

function removeChip(
  chip
) {
  emit(
    'remove',
    chip
  )
}
</script>


<template>
  <!-- TAMPIL HANYA JIKA ADA FILTER -->
  <section
    v-if="
      chips.length > 0
    "
    class="
      flex
      flex-col
      gap-3
      rounded-xl
      border
      border-slate-200/80
      bg-white
      px-4
      py-3
      shadow-[0_1px_3px_rgba(15,23,42,0.03)]
      lg:flex-row
      lg:items-center
      lg:justify-between
    "
  >
    <!-- LEFT -->
    <div
      class="
        flex
        min-w-0
        items-start
        gap-2.5
      "
    >
      <!-- ICON -->
      <div
        class="
          flex
          h-8
          w-8
          shrink-0
          items-center
          justify-center
          rounded-lg
          bg-slate-100
          text-slate-500
        "
      >
        <Filter
          :size="14"
          :stroke-width="1.8"
        />
      </div>


      <!-- CHIPS -->
      <div
        class="
          min-w-0
          flex-1
        "
      >
        <p
          class="
            text-[9px]
            font-bold
            uppercase
            tracking-[0.12em]
            text-slate-400
          "
        >
          Filter Aktif
        </p>


        <div
          class="
            mt-1.5
            flex
            max-w-full
            items-center
            gap-1.5
            overflow-x-auto
            pb-1
          "
        >
<div
  v-for="chip in chips"
            :key="
              `${chip.key}-${chip.value}`
            "
            type="button"
            class="
              group
              inline-flex
              shrink-0
              items-center
              gap-1.5
              rounded-lg
              border
              border-slate-200
              bg-slate-50
              px-2.5
              py-1.5
              text-[10px]
              font-medium
              text-slate-600
              transition
              hover:border-red-200
              hover:bg-red-50
              hover:text-red-600
            "
            :title="
              `Hapus ${chip.group}: ${chip.label}`
            "

          >
            <span
              class="
                font-bold
                text-slate-400
                group-hover:text-red-400
              "
            >
              {{ chip.group }}:
            </span>

            <span>
              {{ chip.label }}
            </span>


</div>
        </div>
      </div>
    </div>


    <!-- RIGHT -->
    <div
      class="
        shrink-0
      "
    >
      <button
        type="button"
        class="
          text-[10px]
          font-semibold
          text-slate-400
          transition
          hover:text-red-600
        "
        @click="
          emit(
            'reset'
          )
        "
      >
        Hapus semua filter
      </button>
    </div>
  </section>
</template>