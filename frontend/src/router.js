import {
  createRouter,
  createWebHistory
} from 'vue-router'

import LandingView from './views/LandingView.vue'
import DashboardView from './views/DashboardView.vue'
import AssetView from './views/AssetView.vue'
import TimeSeriesView from './views/TimeSeriesView.vue'
import AnalisisRasioView from './views/AnalisisRasioView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: LandingView,
    meta: { menu: 'Landing', layout: 'landing' }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: { menu: 'Dashboard' }
  },
  {
    path: '/database',
    name: 'database',
    component: AssetView,
    meta: { menu: 'Database' }
  },
  {
    path: '/time-series',
    name: 'time-series',
    component: TimeSeriesView,
    meta: { menu: 'Time Series' }
  },
  {
    path: '/analisis-rasio',
    name: 'analisis-rasio',
    component: AnalisisRasioView,
    meta: { menu: 'Analisis Rasio' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})