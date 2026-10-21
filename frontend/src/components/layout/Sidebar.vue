<script setup>
import {
  LayoutDashboard,
  TableProperties,
  TrendingUp,
  ChartNoAxesCombined,
  ChevronRight
} from 'lucide-vue-next'


/*
|--------------------------------------------------------------------------
| ASSETS
|--------------------------------------------------------------------------
*/

import logoBps
  from '../../assets/logo.png'

import gedungBps
  from '../../assets/bps.jpg'


/*
|--------------------------------------------------------------------------
| PROPS
|--------------------------------------------------------------------------
|
| activeMenu dikirim dari App.vue
|
*/

defineProps({
  activeMenu: {
    type: String,
    default: 'Dashboard'
  }
})


/*
|--------------------------------------------------------------------------
| EMIT
|--------------------------------------------------------------------------
*/

const emit =
  defineEmits([
    'select-menu'
  ])


/*
|--------------------------------------------------------------------------
| MENU
|--------------------------------------------------------------------------
*/

const menus = [
  {
    name:
      'Dashboard',

    icon:
      LayoutDashboard
  },


  {
    name:
      'Time Series',

    icon:
      TrendingUp
  },


  {
    name:
      'Analisis Rasio',

    icon:
      ChartNoAxesCombined
  },


  {
    name:
      'Database',

    icon:
      TableProperties
  }
]


/*
|--------------------------------------------------------------------------
| PILIH MENU
|--------------------------------------------------------------------------
*/

function selectMenu(
  menu
) {
  emit(
    'select-menu',
    menu
  )
}
</script>


<template>
  <aside
    class="
      fixed
      left-0
      top-0
      z-40
      flex
      h-screen
      w-16
      md:w-64
      flex-col
      overflow-hidden
      border-r
      border-white/10
      bg-gradient-to-b
      from-[#06152d]
      via-[#0a2846]
      to-[#0d3556]
      text-white
      shadow-xl
    "
  >
    <!--
    |--------------------------------------------------------------------------
    | LOGO / BRAND
    |--------------------------------------------------------------------------
    -->

    <div
      class="
        px-2
        pb-5
        pt-4
        md:px-5
        md:pt-6
      "
    >
      <div
        class="
          flex
          items-center
          justify-center
          gap-0
          md:justify-start
          md:gap-3
        "
      >
        <!-- LOGO -->
        <div
          class="
            flex
            h-12
            w-12
            shrink-0
            items-center
            justify-center
          "
        >
          <img
            :src="logoBps"
            alt="Logo BPS"
            class="
              h-11
              w-11
              object-contain
            "
          />
        </div>


        <!-- BRAND -->
        <div class="hidden min-w-0 md:block">
          <h1
            class="
              text-xl
              font-bold
              tracking-wide
              text-white
            "
          >
            BPS
          </h1>

          <p
            class="
              mt-0.5
              text-[11px]
              text-blue-200/70
            "
          >
            Analytics Dashboard
          </p>
        </div>
      </div>
    </div>


    <!-- DIVIDER -->
    <div
      class="
        mx-5
        border-t
        border-white/10
      "
    ></div>


    <!--
    |--------------------------------------------------------------------------
    | NAVIGATION
    |--------------------------------------------------------------------------
    -->

    <nav
      class="
        mt-4
        px-1
        md:px-3
      "
    >
      <div
        class="
          space-y-1.5
        "
      >
        <button
          v-for="
            menu in menus
          "
          :key="
            menu.name
          "
          type="button"
          class="
            group
            relative
            flex
            w-full
            items-center
            justify-center
            gap-0
            rounded-xl
            px-0
            py-3
            text-left
            text-sm
            font-medium
            transition-all
            duration-200
            md:justify-start
            md:gap-3
            md:px-3.5
          "
          :aria-label="menu.name"
          :title="menu.name"
          :class="
            activeMenu ===
            menu.name

              ? `
                  bg-gradient-to-r
                  from-blue-600
                  to-blue-500
                  text-white
                  shadow-lg
                  shadow-blue-950/30
                `

              : `
                  text-slate-300
                  hover:bg-white/[0.07]
                  hover:text-white
                `
          "
          @click="
            selectMenu(
              menu.name
            )
          "
        >
          <!-- ACTIVE INDICATOR -->
          <span
            v-if="
              activeMenu ===
              menu.name
            "
            class="
              absolute
              -left-1
              md:-left-3
              h-7
              w-1
              rounded-r-full
              bg-cyan-400
            "
          ></span>


          <!-- ICON -->
          <component
            :is="
              menu.icon
            "
            :size="18"
            :stroke-width="1.8"
            class="
              shrink-0
            "
            :class="
              activeMenu ===
              menu.name

                ? 'text-white'

                : `
                    text-blue-200/70
                    group-hover:text-white
                  `
            "
          />


          <!-- NAME -->
          <span
            class="
              sr-only
              md:not-sr-only
              md:flex-1
            "
          >
            {{ menu.name }}
          </span>


          <!-- ARROW -->
          <ChevronRight
            v-if="
              activeMenu ===
              menu.name
            "
            :size="15"
            class="
              hidden
              text-blue-100/70
              md:block
            "
          />
        </button>
      </div>
    </nav>


    <!--
    |--------------------------------------------------------------------------
    | DIVIDER
    |--------------------------------------------------------------------------
    -->

    <div
      class="
        mx-5
        mt-6
        border-t
        border-white/10
      "
    ></div>


    <!--
    |--------------------------------------------------------------------------
    | BOTTOM / GEDUNG BPS
    |--------------------------------------------------------------------------
    -->

    <div
      class="
        hidden
        relative
        mt-auto
        min-h-[300px]
        overflow-hidden
        md:block
      "
    >
      <!-- FOTO GEDUNG -->
      <img
        :src="gedungBps"
        alt="Gedung Badan Pusat Statistik"
        class="
          absolute
          inset-0
          h-full
          w-full
          object-cover
          object-center
        "
      />


      <!-- GRADIENT -->
      <div
        class="
          absolute
          inset-0
          bg-gradient-to-b
          from-[#0d3556]
          via-[#0a2846]/60
          to-[#06152d]/95
        "
      ></div>


      <!-- DARK OVERLAY -->
      <div
        class="
          absolute
          inset-0
          bg-[#06152d]/15
        "
      ></div>


      <!-- GLOW -->
      <div
        class="
          absolute
          -bottom-16
          -right-16
          h-48
          w-48
          rounded-full
          bg-blue-500/10
          blur-3xl
        "
      ></div>


      <!-- CONTENT -->
      <div
        class="
          relative
          z-10
          flex
          min-h-[300px]
          flex-col
          justify-end
          px-5
          pb-6
        "
      >
        <!-- ACCENT -->
        <div
          class="
            mb-4
            h-1
            w-9
            rounded-full
            bg-blue-500
          "
        ></div>


        <!-- TAGLINE -->
        <p
          class="
            text-sm
            font-semibold
            leading-6
            text-white
          "
        >
          Mencatat Indonesia

          <br />

          untuk Masa Depan
        </p>


        <!-- FOOTER -->
        <div
          class="
            mt-5
            border-t
            border-white/10
            pt-4
          "
        >
          <p
            class="
              text-[9px]
              leading-4
              text-blue-100/50
            "
          >
            Badan Pusat Statistik

            <br />

            © 2026
          </p>
        </div>
      </div>
    </div>
  </aside>
</template>