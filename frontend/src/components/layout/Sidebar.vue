<script setup>
import {
  House,
  LayoutDashboard,
  TableProperties,
  TrendingUp,
  ChartNoAxesCombined,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  X
} from 'lucide-vue-next'


/*
|--------------------------------------------------------------------------
| ASSETS
|--------------------------------------------------------------------------
*/

import logoBps
  from '../../assets/logo.png'

import gedungBps
  from '../../assets/bawah1.png'

import sidebarSky
  from '../../assets/atas.png'


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
  },
  collapsed: {
    type: Boolean,
    default: false
  },
  mobileOpen: {
    type: Boolean,
    default: false
  }
})


/*
|--------------------------------------------------------------------------
| EMIT
|--------------------------------------------------------------------------
*/

const emit =
  defineEmits([
    'select-menu',
    'toggle-sidebar',
    'expand-sidebar',
    'close-mobile'
  ])


/*
|--------------------------------------------------------------------------
| MENU
|--------------------------------------------------------------------------
*/

const menus = [
  {
    name:
      'Landing',

    label:
      'Beranda',

    icon:
      House
  },

  {
    name:
      'Dashboard',

      label:
      'Struktur',

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
      flex-col
      overflow-hidden
      border-r
      border-white/10
      bg-[#061633]
      text-white
      shadow-[8px_0_32px_rgba(2,12,18,0.22)]
      transition-[width,transform]
      duration-[450ms]
      ease-[cubic-bezier(0.22,1,0.36,1)]
      will-change-[width,transform]
      motion-reduce:duration-[1ms]
    "
    :style="{ width: mobileOpen || !collapsed ? '16rem' : '5rem' }"
    :class="[
      mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    ]"
  >
    <img
      :src="sidebarSky"
      alt=""
      aria-hidden="true"
      class="
        pointer-events-none
        absolute
        inset-x-0
        top-0
        z-0
        hidden
        h-1/2
        w-full
        object-cover
        object-top
        md:block
      "
    />

    <img
      :src="gedungBps"
      alt=""
      aria-hidden="true"
      class="
        pointer-events-none
        absolute
        inset-x-0
        bottom-0
        z-0
        hidden
        h-1/2
        w-full
        object-cover
        object-bottom
        md:block
      "
    />

    <div
      class="
        pointer-events-none
        absolute
        inset-x-0
        top-[39%]
        z-[1]
        hidden
        h-[22%]
        bg-gradient-to-b
        from-transparent
        via-[#061633]/75
        to-transparent
        md:block
      "
      aria-hidden="true"
    ></div>

    <div
      class="
        pointer-events-none
        absolute
        inset-0
        z-0
        hidden
        bg-[#061633]/10
        md:block
      "
      aria-hidden="true"
    ></div>

    <div
      class="
        pointer-events-none
        absolute
        inset-x-0
        bottom-0
        z-10
        px-5
        pb-6
      "
      :class="mobileOpen ? 'block' : collapsed ? 'hidden' : 'hidden md:block'"
    >
      <div class="mb-4 h-1 w-9 rounded-full bg-blue-500"></div>
      <p class="text-sm font-bold leading-6 text-white">
        Mencatat Indonesia<br />
        <span class="text-sky-300">untuk Masa Depan</span>
      </p>
      <div class="mt-5 border-t border-white/15 pt-3 text-[9px] leading-4 text-blue-100/70">
        Badan Pusat Statistik<br />
        © 2026
      </div>
    </div>

    <!--
    |--------------------------------------------------------------------------
    | LOGO / BRAND
    |--------------------------------------------------------------------------
    -->

    <div
      class="
        relative
        z-10
        px-3
        pb-5
        pt-4
        md:px-4
        md:pt-6
      "
    >
      <div
        class="
          flex
          items-center
          justify-between
          gap-3
          md:justify-start
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
            rounded-2xl
            bg-white
            shadow-[0_4px_16px_rgba(0,0,0,0.18)]
          "
        >
          <img
            :src="logoBps"
            alt="Logo BPS"
            class="
              h-10
              w-10
              object-contain
            "
          />
        </div>


        <!-- BRAND -->
        <div
          class="min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-[1ms]"
          :class="mobileOpen || !collapsed ? 'max-w-48 translate-x-0 opacity-100' : 'max-w-0 -translate-x-1 opacity-0'"
        >
          <h1
            class="
              text-lg
              font-bold
              tracking-[0.04em]
              text-white
            "
          >
            BPS
          </h1>

          <p
            class="
              mt-0.5
              text-[11px]
              text-teal-100/70
            "
          >
            Analytics Dashboard
          </p>
        </div>

        <button
          v-if="!collapsed"
          type="button"
          class="
            ml-auto
            hidden
            h-9 w-9
            shrink-0
            items-center
            justify-center
            rounded-lg
            text-blue-100
            transition-colors
            hover:bg-white/10
            focus-visible:outline
            focus-visible:outline-2
            focus-visible:outline-offset-2
            focus-visible:outline-sky-300
            md:inline-flex
          "
          aria-label="Ciutkan sidebar"
          :aria-expanded="!collapsed"
          title="Ciutkan sidebar"
          @click="emit('toggle-sidebar')"
        >
          <PanelLeftClose :size="18" />
        </button>

        <button
          type="button"
          class="
            inline-flex
            h-9 w-9
            shrink-0
            items-center
            justify-center
            rounded-lg
            text-blue-100
            hover:bg-white/10
            focus-visible:outline
            focus-visible:outline-2
            focus-visible:outline-offset-2
            focus-visible:outline-sky-300
            md:hidden
          "
          aria-label="Tutup navigasi"
          title="Tutup navigasi"
          @click="emit('close-mobile')"
        >
          <X :size="18" />
        </button>
      </div>
    </div>

    <button
      v-if="collapsed"
      type="button"
      class="
        relative
        z-20
        mx-auto
        my-3
        flex
        h-10 w-10
        items-center
        justify-center
        rounded-lg
        border border-sky-200/60
        bg-blue-600
        text-white
        shadow-sm
        transition-colors
        hover:bg-blue-500
        focus-visible:outline
        focus-visible:outline-2
        focus-visible:outline-offset-2
        focus-visible:outline-sky-300
      "
      aria-label="Perluas sidebar"
      :aria-expanded="!collapsed"
      title="Perluas sidebar"
      @click="emit('expand-sidebar')"
    >
      <PanelLeftOpen :size="19" :stroke-width="2.5" class="text-white" />
    </button>


    <!-- DIVIDER -->
    <div
      class="
        relative
        z-10
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
        relative
        z-10
        mt-5
        px-1
        md:px-3
      "
    >
        <p
          class="
            mb-2
            px-3.5
            text-[9px]
            font-bold
            uppercase
            tracking-[0.16em]
            text-teal-100/45
          "
          :class="mobileOpen ? 'block' : collapsed ? 'hidden' : 'hidden md:block'"
        >
          Navigasi
        </p>

      <div
        class="
            space-y-1
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
            rounded-xl
            py-3
            text-left
            text-sm
            font-medium
            transition-all
            duration-[450ms]
            ease-[cubic-bezier(0.22,1,0.36,1)]
            motion-reduce:duration-[1ms]
          "
          :class="[
            activeMenu === menu.name
              ? 'bg-gradient-to-r from-teal-700/95 to-teal-600/80 text-white shadow-[0_8px_20px_rgba(13,148,136,0.18)] ring-1 ring-inset ring-teal-200/15'
              : 'text-slate-300 hover:bg-white/[0.07] hover:text-white',
            collapsed && !mobileOpen
              ? 'md:justify-center md:gap-0 md:px-0'
              : 'justify-start gap-3 px-3.5'
          ]"
          :aria-label="menu.label || menu.name"
          :title="menu.label || menu.name"
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
              h-7
              w-1
              rounded-r-full
              bg-lime-300
            "
            :class="collapsed && !mobileOpen ? 'md:left-0' : 'md:-left-3'"
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
                    text-teal-100/60
                    group-hover:text-white
                  `
            "
          />


          <!-- NAME -->
          <span
            class="min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-[1ms]"
            :class="mobileOpen || !collapsed ? 'max-w-48 translate-x-0 opacity-100' : 'max-w-0 -translate-x-1 opacity-0 pointer-events-none'"
          >
            {{ menu.label || menu.name }}
          </span>


          <!-- ARROW -->
          <ChevronRight
            v-if="
              activeMenu ===
              menu.name &&
              (!collapsed || mobileOpen)
            "
            :size="15"
            class="
              hidden
              text-teal-100/70
              md:block
            "
          />
        </button>
      </div>
    </nav>


  </aside>
</template>