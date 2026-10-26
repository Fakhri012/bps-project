import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'


import './plugins/echarts'

createApp(App)
	.use(router)
	.mount('#app')