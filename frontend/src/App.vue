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


/*
|--------------------------------------------------------------------------
| HALAMAN AKTIF
|--------------------------------------------------------------------------
|
| Halaman default saat aplikasi pertama kali dibuka.
|
*/

const activeMenu =
  ref('Dashboard')


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
}
</script>


<template>
  <div
    class="
      min-h-screen
      bg-slate-50
    "
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
      @select-menu="
        handleMenuChange
      "
    />


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
      class="
        ml-64
        min-h-screen
      "
    >
      <!--
      |--------------------------------------------------------------------------
      | HEADER
      |--------------------------------------------------------------------------
      -->

      <Header />


      <!--
      |--------------------------------------------------------------------------
      | PAGE CONTENT
      |--------------------------------------------------------------------------
      -->

      <main
        class="
          min-h-[calc(100vh-64px)]
          p-6
          lg:p-8
        "
      >
        <!-- =====================================================
             DASHBOARD
        ====================================================== -->

        <DashboardView
          v-if="
            activeMenu ===
            'Dashboard'
          "
        />


        <!-- =====================================================
             ASSET DATA
        ====================================================== -->

        <AssetView
          v-else-if="
            activeMenu ===
            'Asset Data'
          "
        />


        <!-- =====================================================
             TIME SERIES
        ====================================================== -->

        <TimeSeriesView
          v-else-if="
            activeMenu ===
            'Time Series'
          "
        />


        <!-- =====================================================
             FALLBACK
        ====================================================== -->

        <div
          v-else
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
      </main>
    </div>
  </div>
</template>