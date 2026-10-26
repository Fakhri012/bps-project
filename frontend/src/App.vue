<script setup>
import {
  computed,
  ref
} from 'vue'
import {
  useRoute,
  useRouter
} from 'vue-router'

import Sidebar
  from './components/layout/Sidebar.vue'

import Header
  from './components/layout/Header.vue'

/*
|--------------------------------------------------------------------------
| HALAMAN AKTIF
|--------------------------------------------------------------------------
|
| Halaman default saat aplikasi pertama kali dibuka.
|
*/

const route = useRoute()
const router = useRouter()
const activeMenu = computed(() => route.meta.menu || 'Landing')
const menuRoutes = {
  Landing: 'home',
  Dashboard: 'dashboard',
  Database: 'database',
  'Time Series': 'time-series',
  'Analisis Rasio': 'analisis-rasio'
}

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
  closeMobileSidebar()

  const routeName = menuRoutes[menu]

  if (routeName && route.name !== routeName) {
    router.push({ name: routeName })
  }
}
</script>


<template>
  <RouterView v-slot="{ Component, route }">
    <component
      :is="Component"
      v-if="route.meta.layout === 'landing'"
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

        <div :key="route.path" class="view-frame">
          <component :is="Component" />


        <!-- =====================================================
             ASSET DATA
        ====================================================== -->

        </div>
      </main>
    </div>
    </div>
  </RouterView>
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