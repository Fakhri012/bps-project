<script setup>
import {
  ref
} from 'vue'

import Sidebar
  from './components/layout/Sidebar.vue'

import Header
  from './components/layout/Header.vue'

import DashboardView
  from './views/DashboardView.vue'

import AssetView
  from './views/AssetView.vue'

import TimeSeriesView
  from './views/TimeSeriesView.vue'

import AnalisisRasioView
  from './views/AnalisisRasioView.vue'

import LandingView
  from './views/LandingView.vue'

/*
|--------------------------------------------------------------------------
| HALAMAN AKTIF
|--------------------------------------------------------------------------
|
| Halaman default saat aplikasi pertama kali dibuka.
|
*/

const validMenus = [
  'Landing',
  'Dashboard',
  'Database',
  'Time Series',
  'Analisis Rasio'
]

const savedMenu =
  localStorage.getItem('activeMenu')

const activeMenu =
  ref(
    validMenus.includes(savedMenu)
      ? savedMenu
      : 'Landing'
  )

const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)

function toggleSidebar() {
  if (window.matchMedia('(min-width: 768px)').matches) {
    sidebarCollapsed.value = !sidebarCollapsed.value
    return
  }

  mobileSidebarOpen.value = !mobileSidebarOpen.value
}

function closeMobileSidebar() {
  mobileSidebarOpen.value = false
}

function expandSidebar() {
  sidebarCollapsed.value = false
}


/*
|--------------------------------------------------------------------------
| GANTI HALAMAN
|--------------------------------------------------------------------------
|
| Dipanggil ketika Sidebar mengirim event:
|
| @select-menu
|
*/

function handleMenuChange(
  menu
) {
  activeMenu.value =
    menu

  closeMobileSidebar()

  localStorage.setItem(
    'activeMenu',
    menu
  )
}
</script>


<template>
  <LandingView
    v-if="activeMenu === 'Landing'"
    key="landing"
    class="page-frame"
    @select-menu="handleMenuChange"
  />

  <div
    v-else
    key="application"
    class="application-shell min-h-screen bg-slate-50"
    :class="{ 'sidebar-collapsed': sidebarCollapsed }"
  >
    <!--
    |--------------------------------------------------------------------------
    | SIDEBAR
    |--------------------------------------------------------------------------
    -->

    <Sidebar
      :active-menu="
        activeMenu
      "
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileSidebarOpen"
      @select-menu="
        handleMenuChange
      "
      @toggle-sidebar="
        toggleSidebar
      "
      @expand-sidebar="
        expandSidebar
      "
      @close-mobile="
        closeMobileSidebar
      "
    />

    <button
      v-if="mobileSidebarOpen"
      type="button"
      class="fixed inset-0 z-[35] bg-slate-950/45 md:hidden"
      aria-label="Tutup navigasi"
      @click="closeMobileSidebar"
    ></button>


    <!--
    |--------------------------------------------------------------------------
    | MAIN AREA
    |--------------------------------------------------------------------------
    |
    | Sidebar memiliki width w-64.
    | Karena itu content diberi ml-64.
    |
    -->

    <div
      class="application-content min-h-screen min-w-0"
    >
      <!--
      |--------------------------------------------------------------------------
      | HEADER
      |--------------------------------------------------------------------------
      -->

      <Header
        :mobile-sidebar-open="mobileSidebarOpen"
        @toggle-sidebar="toggleSidebar"
      />


      <!--
      |--------------------------------------------------------------------------
      | PAGE CONTENT
      |--------------------------------------------------------------------------
      -->

      <main
        class="
          min-w-0
          min-h-[calc(100vh-64px)]
          p-3
          sm:p-6
          lg:p-8
        "
      >
        <!-- =====================================================
             DASHBOARD
        ====================================================== -->

        <div :key="activeMenu" class="view-frame">
          <DashboardView
            v-if="
              activeMenu ===
              'Dashboard'
            "
            key="dashboard"
          />


        <!-- =====================================================
             ASSET DATA
        ====================================================== -->

          <AssetView
            v-else-if="
              activeMenu ===
              'Database'
            "
            key="database"
          />


        <!-- =====================================================
             TIME SERIES
        ====================================================== -->

          <TimeSeriesView
            v-else-if="
              activeMenu ===
              'Time Series'
            "
            key="time-series"
          />
<!-- =====================================================
     ANALISIS RASIO
====================================================== -->

          <AnalisisRasioView
            v-else-if="
              activeMenu ===
              'Analisis Rasio'
            "
            key="analisis-rasio"
          />

        <!-- =====================================================
             FALLBACK
        ====================================================== -->

          <div
            v-else
            key="fallback"
            class="
              flex
              min-h-[420px]
              items-center
              justify-center
            "
          >
          <div
            class="
              max-w-sm
              rounded-2xl
              border
              border-slate-200
              bg-white
              px-8
              py-10
              text-center
              shadow-sm
            "
          >
            <!-- ICON / INITIAL -->
            <div
              class="
                mx-auto
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-slate-100
                text-lg
                font-bold
                text-slate-400
              "
            >
              ?
            </div>


            <!-- TITLE -->
            <h2
              class="
                mt-4
                text-base
                font-bold
                text-slate-800
              "
            >
              Halaman belum tersedia
            </h2>


            <!-- DESCRIPTION -->
            <p
              class="
                mt-1.5
                text-xs
                leading-5
                text-slate-400
              "
            >
              Menu yang dipilih belum memiliki halaman
              yang dapat ditampilkan.
            </p>
          </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style>
.application-content {
  margin-left: 0;
  transition: margin-left 450ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: margin-left;
}

@media (min-width: 768px) {
  .application-content {
    margin-left: 16rem;
  }

  .application-shell.sidebar-collapsed .application-content {
    margin-left: 5rem;
  }
}

.page-frame {
  animation: landing-enter 850ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.view-frame {
  animation: view-enter 160ms ease-out both;
}

@keyframes landing-enter {
  from {
    opacity: 0.76;
    transform: translateY(14px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes view-enter {
  from {
    transform: translateY(7px);
  }

  to {
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .application-content {
    transition-duration: 1ms;
  }

  .page-frame {
    animation-duration: 1ms;
  }

  .view-frame {
    animation-duration: 1ms;
  }
}
</style>