<script setup>
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount
} from 'vue'

import {
  ChevronDown,
  Search,
  Check,
  X
} from 'lucide-vue-next'


/*
|--------------------------------------------------------------------------
| PROPS
|--------------------------------------------------------------------------
|
| options bisa berupa:
|
| ['2016', '2017']
|
| atau:
|
| [
|   {
|     value: 'FC',
|     label: 'Korporasi Finansial'
|   }
| ]
|
*/

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },

  label: {
    type: String,
    default: ''
  },

  placeholder: {
    type: String,
    default: 'Pilih'
  },

  options: {
    type: Array,
    default: () => []
  }
})


const emit = defineEmits([
  'update:modelValue'
])


/*
|--------------------------------------------------------------------------
| STATE
|--------------------------------------------------------------------------
*/

const open = ref(false)

const search = ref('')

const containerRef = ref(null)

const openUpward = ref(false)


/*
|--------------------------------------------------------------------------
| NORMALISASI OPTION
|--------------------------------------------------------------------------
|
| String:
|
| "2016"
|
| menjadi:
|
| {
|   value: "2016",
|   label: "2016"
| }
|
|
| Object:
|
| {
|   value: "FC",
|   label: "Korporasi Finansial"
| }
|
| tetap digunakan.
|
*/

function normalizeOption(option) {
  if (
    typeof option === 'object' &&
    option !== null
  ) {
    return {
      value:
        String(
          option.value ?? ''
        ),

      label:
        String(
          option.label ??
          option.value ??
          ''
        )
    }
  }


  return {
    value:
      String(option ?? ''),

    label:
      String(option ?? '')
  }
}


/*
|--------------------------------------------------------------------------
| NORMALIZED OPTIONS
|--------------------------------------------------------------------------
*/

const normalizedOptions =
  computed(() => {
    return props.options
      .map(normalizeOption)
      .filter(
        item =>
          item.value !== ''
      )
  })


/*
|--------------------------------------------------------------------------
| FILTER SEARCH
|--------------------------------------------------------------------------
*/

const filteredOptions =
  computed(() => {
    const keyword =
      search.value
        .trim()
        .toLowerCase()


    if (!keyword) {
      return normalizedOptions.value
    }


    return normalizedOptions.value.filter(
      item => {
        return (
          item.label
            .toLowerCase()
            .includes(keyword) ||

          item.value
            .toLowerCase()
            .includes(keyword)
        )
      }
    )
  })


/*
|--------------------------------------------------------------------------
| SELECTED
|--------------------------------------------------------------------------
*/

function isSelected(value) {
  return props.modelValue.some(
    item =>
      String(item) ===
      String(value)
  )
}


/*
|--------------------------------------------------------------------------
| TOGGLE OPTION
|--------------------------------------------------------------------------
*/

function toggleOption(value) {
  const normalizedValue =
    String(value)


  if (
    isSelected(
      normalizedValue
    )
  ) {
    emit(
      'update:modelValue',

      props.modelValue.filter(
        item =>
          String(item) !==
          normalizedValue
      )
    )

    return
  }


  emit(
    'update:modelValue',

    [
      ...props.modelValue,
      normalizedValue
    ]
  )
}

/*
|--------------------------------------------------------------------------
| PILIH HANYA SATU
|--------------------------------------------------------------------------
|
| Menghapus semua pilihan sebelumnya
| lalu memilih hanya option yang diklik.
|
| Contoh:
|
| ['2016', '2017', '2018']
|
| klik "Hanya" pada 2020
|
| menjadi:
|
| ['2020']
|
*/

function selectOnly(value) {
  emit(
    'update:modelValue',
    [value]
  )
}

/*
|--------------------------------------------------------------------------
| SELECT ALL
|--------------------------------------------------------------------------
*/

function selectAll() {
  const allValues =
    normalizedOptions.value.map(
      item =>
        item.value
    )


  const allSelected =
    allValues.length > 0 &&
    allValues.every(
      value =>
        isSelected(value)
    )


  if (allSelected) {
    emit(
      'update:modelValue',
      []
    )

    return
  }


  emit(
    'update:modelValue',
    allValues
  )
}


/*
|--------------------------------------------------------------------------
| CLEAR
|--------------------------------------------------------------------------
*/

function clearSelection() {
  emit(
    'update:modelValue',
    []
  )
}


/*
|--------------------------------------------------------------------------
| LABEL BUTTON
|--------------------------------------------------------------------------
*/

const displayText =
  computed(() => {
    const count =
      props.modelValue.length


    if (count === 0) {
      return props.placeholder
    }


    if (count === 1) {
      const selectedValue =
        String(
          props.modelValue[0]
        )


      const option =
        normalizedOptions.value.find(
          item =>
            item.value ===
            selectedValue
        )


      return (
        option?.label ||
        selectedValue
      )
    }


    return `${count} dipilih`
  })


/*
|--------------------------------------------------------------------------
| ALL SELECTED
|--------------------------------------------------------------------------
*/

const allSelected =
  computed(() => {
    if (
      normalizedOptions.value.length ===
      0
    ) {
      return false
    }


    return normalizedOptions.value.every(
      item =>
        isSelected(
          item.value
        )
    )
  })


/*
|--------------------------------------------------------------------------
| OPEN / CLOSE
|--------------------------------------------------------------------------
*/

function toggleDropdown() {
  if (open.value) {
    open.value = false
    return
  }


  /*
   * Tentukan dropdown
   * buka ke atas / bawah.
   */

  if (containerRef.value) {
    const rect =
      containerRef.value
        .getBoundingClientRect()


    const spaceBelow =
      window.innerHeight -
      rect.bottom


    const spaceAbove =
      rect.top


    openUpward.value =
      spaceBelow < 300 &&
      spaceAbove > spaceBelow
  }


  open.value = true
}


/*
|--------------------------------------------------------------------------
| CLICK OUTSIDE
|--------------------------------------------------------------------------
*/

function handleClickOutside(event) {
  if (
    containerRef.value &&
    !containerRef.value.contains(
      event.target
    )
  ) {
    open.value = false
  }
}


onMounted(() => {
  document.addEventListener(
    'mousedown',
    handleClickOutside
  )
})


onBeforeUnmount(() => {
  document.removeEventListener(
    'mousedown',
    handleClickOutside
  )
})
</script>


<template>
  <div
    ref="containerRef"
    class="relative"
  >

    <!-- LABEL -->

    <div
      class="mb-2 flex
             items-center
             justify-between"
    >

      <p
        class="text-[10px]
               font-semibold
               uppercase
               tracking-wider
               text-slate-400"
      >
        {{ label }}
      </p>


      <button
        v-if="modelValue.length > 0"
        type="button"
        @click.stop="clearSelection"
        class="text-[10px]
               font-semibold
               text-slate-400
               transition
               hover:text-red-500"
      >
        Hapus
      </button>

    </div>


    <!-- BUTTON UTAMA -->

    <button
      type="button"
      @click="toggleDropdown"
      class="flex w-full
             items-center
             justify-between
             gap-3
             rounded-xl
             border
             border-slate-200
             bg-white
             px-4
             py-3.5
             text-left
             transition
             hover:border-blue-300
             focus:border-blue-400
             focus:outline-none
             focus:ring-2
             focus:ring-blue-100"
    >

      <span
        class="min-w-0
               truncate
               text-sm"
        :class="
          modelValue.length > 0
            ? 'font-semibold text-slate-700'
            : 'font-medium text-slate-500'
        "
      >
        {{ displayText }}
      </span>


      <ChevronDown
        :size="16"
        class="shrink-0
               text-slate-400
               transition-transform"
        :class="
          open
            ? 'rotate-180'
            : ''
        "
      />

    </button>


    <!-- DROPDOWN -->

    <div
      v-if="open"
      class="absolute
             left-0
             z-50
             w-full
             overflow-hidden
             rounded-xl
             border
             border-slate-200
             bg-white
             shadow-xl"
      :class="
        openUpward
          ? 'bottom-[calc(100%+8px)]'
          : 'top-[calc(100%+8px)]'
      "
    >

      <!-- SEARCH -->

      <div
        class="border-b
               border-slate-100
               p-2"
      >

        <div
          class="flex
                 items-center
                 gap-2
                 rounded-lg
                 bg-slate-50
                 px-3
                 py-2"
        >

          <Search
            :size="14"
            class="mt-1 shrink-0
                   text-slate-400"
          />


          <input
            v-model="search"
            type="text"
            placeholder="Cari..."
            class="min-w-0
                   flex-1
                   bg-transparent
                   text-xs
                   text-slate-700
                   outline-none
                   placeholder:text-slate-400"
            @click.stop
          />


          <button
            v-if="search"
            type="button"
            @click.stop="
              search = ''
            "
            class="text-slate-400
                   hover:text-slate-600"
          >
            <X :size="13" />
          </button>

        </div>

      </div>


      <!-- PILIH SEMUA -->

      <button
        v-if="
          normalizedOptions.length > 0
        "
        type="button"
        @click.stop="selectAll"
        class="flex w-full
               items-center
               gap-2.5
               border-b
               border-slate-100
               px-3
               py-2.5
               text-left
               transition
               hover:bg-slate-50"
      >

        <div
          class="flex h-4 w-4
                 shrink-0
                 items-center
                 justify-center
                 rounded
                 border"
          :class="
            allSelected
              ? 'border-blue-600 bg-blue-600'
              : 'border-slate-300 bg-white'
          "
        >

          <Check
            v-if="allSelected"
            :size="11"
            class="text-white"
          />

        </div>


        <span
          class="text-xs
                 font-semibold
                 text-slate-600"
        >
          Pilih Semua
        </span>

      </button>


      <!-- OPTIONS -->

      <div
        class="max-h-56
               overflow-y-auto
               p-1.5"
      >

      <div
        v-for="
          item in filteredOptions
        "
        :key="item.value"
        class="group flex
              w-full
              items-start
              gap-2
              rounded-lg
              px-2
              py-1
              transition
              hover:bg-slate-50"
      >

          <!-- CHECKBOX + LABEL -->

        <button
          type="button"
          @click.stop="
            toggleOption(
              item.value
            )
          "
          class="flex min-w-0
                flex-1
                items-center
                gap-2.5
                py-1.5
                text-left"
        >

            <!-- CHECKBOX -->

            <div
              class="flex h-4 w-4
                     shrink-0
                     items-center
                     justify-center
                     rounded
                     border"
              :class="
                isSelected(
                  item.value
                )
                  ? 'border-blue-600 bg-blue-600'
                  : 'border-slate-300 bg-white'
              "
            >

              <Check
                v-if="
                  isSelected(
                    item.value
                  )
                "
                :size="11"
                class="text-white"
              />

            </div>


            <!-- LABEL -->

          <span
            class="min-w-0
                  flex-1
                  whitespace-normal
                  break-words
                  text-xs
                  leading-5
                  text-slate-700"
          >
            {{ item.label }}
          </span>

          </button>


          <!-- TOMBOL HANYA -->

          <button
            type="button"
            @click.stop="
              selectOnly(
                item.value
              )
            "
            class="mt-1 shrink-0
                   rounded-md
                   px-2
                   py-1
                   text-[10px]
                   font-semibold
                   text-blue-600
                   opacity-0
                   transition
                   hover:bg-blue-50
                   hover:text-blue-700
                   group-hover:opacity-100
                   focus:opacity-100"
          >
            Hanya
          </button>

        </div>


        <!-- EMPTY SEARCH -->

        <div
          v-if="
            filteredOptions.length === 0
          "
          class="px-3
                 py-6
                 text-center"
        >
          <p
            class="text-xs
                   text-slate-400"
          >
            Data tidak ditemukan
          </p>
        </div>

      </div>


      <!-- FOOTER -->

      <div
        v-if="
          modelValue.length > 0
        "
        class="flex
               items-center
               justify-between
               border-t
               border-slate-100
               bg-slate-50/70
               px-3
               py-2"
      >

        <span
          class="text-[10px]
                 font-medium
                 text-slate-500"
        >
          {{ modelValue.length }}
          dipilih
        </span>


        <button
          type="button"
          @click.stop="clearSelection"
          class="text-[10px]
                 font-semibold
                 text-red-500
                 hover:text-red-600"
        >
          Hapus Semua
        </button>

      </div>

    </div>

  </div>
</template>