import axios from 'axios'

const developmentApiBaseUrl = import.meta.env.DEV
  ? 'http://localhost:3001/api'
  : undefined

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/dashboard\/?$/, '')
  : developmentApiBaseUrl

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL must be set for production builds')
}

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000
})

export async function getBandingMakroData(filters = {}) {
  const response = await api.get('/banding-makro', {
    params: filters
  })

  return response.data
}
