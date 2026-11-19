import axios from 'axios'

const apiRoot = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/dashboard\/?$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:3001/api'
    : undefined

if (!apiRoot) {
  throw new Error('VITE_API_BASE_URL must be set for production builds')
}

const api = axios.create({
  baseURL: `${apiRoot}/data-import`,
  timeout: 60000
})

export async function getManagementSummary() {
  const response = await api.get('/management/summary')
  return response.data
}

export async function getImportBatches(params = {}) {
  const response = await api.get('/management/batches', { params })
  return response.data
}

export async function getImportBatch(batchId, params = {}) {
  const response = await api.get(`/management/batches/${batchId}`, { params })
  return response.data
}

export async function confirmImportBatch(batchId, payload) {
  const response = await api.post(`/management/batches/${batchId}/confirm`, payload)
  return response.data
}

export async function cancelImportBatch(batchId, reason) {
  const response = await api.post(`/management/batches/${batchId}/cancel`, { reason })
  return response.data
}

export async function getVersions(params = {}) {
  const response = await api.get('/management/versions', { params })
  return response.data
}

export async function getVersionDetail(versionId, params = {}) {
  const response = await api.get(`/management/versions/${versionId}`, { params })
  return response.data
}

export async function restoreVersion(versionId, reason) {
  const response = await api.post(`/management/versions/${versionId}/restore`, { reason })
  return response.data
}

export async function softDeleteVersion(versionId, reason) {
  const response = await api.post(`/management/versions/${versionId}/delete`, { reason })
  return response.data
}

export async function getAuditTrail(params = {}) {
  const response = await api.get('/management/audit', { params })
  return response.data
}

export async function retryDashboardRefresh() {
  const response = await api.post('/management/cache/retry')
  return response.data
}

export async function downloadDatasetTemplate(datasetKey, year, quarter = null) {
  const response = await api.get(`/templates/${datasetKey || 'tahunan'}`, {
    params: {
      tahun: year,
      quarter: quarter ?? undefined
    },
    responseType: 'blob'
  })
  return response.data
}

export async function downloadAnnualTemplate(year) {
  return downloadDatasetTemplate('tahunan', year)
}

export async function detectWorkbookUpload(file, onUploadProgress) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post('/detect', formData, { onUploadProgress })
  return response.data
}

export async function previewDatasetUpload(file, datasetKey, year, quarter = null, onUploadProgress, mode = 'replace_period', options = {}) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post('/preview', formData, {
    params: {
      dataset: datasetKey || 'tahunan',
      tahun: year,
      quarter: quarter ?? undefined,
      mode,
      sheet_name: options.sheetName,
      period_key: options.periodKey,
      workbook_group_id: options.workbookGroupId
    },
    onUploadProgress
  })
  return response.data
}

export async function previewAnnualUpload(file, year, onUploadProgress) {
  return previewDatasetUpload(file, 'tahunan', year, null, onUploadProgress)
}