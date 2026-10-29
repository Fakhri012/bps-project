import jsPDF from 'jspdf'
import { getInstanceByDom } from 'echarts/core'

const PDF_CHART_PIXEL_RATIO = 3

function toSlug(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getDateStamp(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getFilterValues(value) {
  const values = Array.isArray(value)
    ? value
    : [value]

  return values
    .map(item => String(item ?? '').trim())
    .filter(Boolean)
}

export function buildExportFilename({
  page,
  mode,
  period,
  filters = {},
  extension
}) {
  const filterSlug = Object.entries(filters)
    .map(([label, value]) => {
      const values = getFilterValues(value)

      if (values.length === 0) {
        return ''
      }

      const shownValues = values.slice(0, 3).map(toSlug).join('_')
      const remaining = values.length > 3
        ? `_plus-${values.length - 3}`
        : ''

      return `${toSlug(label)}-${shownValues}${remaining}`
    })
    .filter(Boolean)
    .join('_') || 'semua-filter'

  const filename = [
    toSlug(page),
    toSlug(mode),
    toSlug(period) || 'semua-periode',
    filterSlug,
    getDateStamp()
  ]
    .filter(Boolean)
    .join('-')
    .slice(0, 180)

  return `${filename}.${extension}`
}

export function formatExportFilterSummary(filters = {}) {
  const entries = Object.entries(filters)
    .map(([label, value]) => {
      const values = getFilterValues(value)
      return values.length > 0
        ? `${label}: ${values.join(', ')}`
        : ''
    })
    .filter(Boolean)

  return entries.length > 0
    ? entries.join('  |  ')
    : 'Filter: Semua data'
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return ''
  }

  const text = String(value)

  return /[;"\n\r]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text
}

export function serializeCsv(headers, rows) {
  const content = [headers, ...rows]
    .map(row => row.map(escapeCsvValue).join(';'))
    .join('\r\n')

  return `\uFEFF${content}`
}

function captureChartCanvas(element) {
  const sourceCanvases = Array.from(
    element.querySelectorAll('canvas')
  ).filter(canvas => canvas.width > 0 && canvas.height > 0)

  if (sourceCanvases.length === 0) {
    throw new Error('Canvas grafik tidak ditemukan.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(...sourceCanvases.map(item => item.width))
  canvas.height = Math.max(...sourceCanvases.map(item => item.height))

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas grafik tidak dapat disiapkan.')
  }

  sourceCanvases.forEach(source => {
    context.drawImage(source, 0, 0, canvas.width, canvas.height)
  })

  return canvas
}

function captureChartImage(element) {
  const chartElements = [
    element,
    ...element.querySelectorAll('[_echarts_instance_]')
  ]
  const chart = chartElements
    .map(getInstanceByDom)
    .find(instance => instance && !instance.isDisposed())

  if (chart) {
    return {
      dataUrl: chart.getDataURL({
        type: 'png',
        pixelRatio: PDF_CHART_PIXEL_RATIO,
        backgroundColor: '#ffffff'
      }),
      width: chart.getWidth(),
      height: chart.getHeight()
    }
  }

  const canvas = captureChartCanvas(element)

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height
  }
}

export function downloadCsvFile(filename, headers, rows) {
  const blob = new Blob(
    [serializeCsv(headers, rows)],
    { type: 'text/csv;charset=utf-8;' }
  )
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  window.setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(url)
  }, 500)
}

export async function exportChartsPdf({
  filename,
  reportTitle,
  mode,
  period,
  filters = {},
  chartElements = []
}) {
  const charts = Array.from(chartElements)
    .filter(element => element instanceof HTMLElement && element.getClientRects().length > 0)

  if (charts.length === 0) {
    throw new Error('Tidak ada grafik yang tersedia untuk diekspor.')
  }

  await document.fonts?.ready

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - margin * 2
  const filterLines = pdf.splitTextToSize(
    formatExportFilterSummary(filters),
    contentWidth
  )

  for (const [index, element] of charts.entries()) {
    if (index > 0) {
      pdf.addPage('a4', 'landscape')
    }

    const image = captureChartImage(element)

    if (image.width === 0 || image.height === 0) {
      throw new Error('Grafik kosong saat disiapkan untuk PDF.')
    }

    pdf.setFillColor(6, 22, 51)
    pdf.rect(0, 0, pageWidth, 17, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text(reportTitle, margin, 10.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.text(getDateStamp(), pageWidth - margin, 10.5, { align: 'right' })

    pdf.setTextColor(30, 41, 59)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text(`Mode: ${mode}  |  Periode: ${period}`, margin, 25)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.text(filterLines, margin, 31)

    const chartTitle = element.dataset.pdfTitle || `Grafik ${index + 1}`
    const titleY = 34 + filterLines.length * 4

    pdf.setTextColor(15, 23, 42)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text(chartTitle, margin, titleY)

    const imageTop = titleY + 6
    const footerTop = pageHeight - margin
    const availableHeight = footerTop - imageTop
    const scale = Math.min(
      contentWidth / image.width,
      availableHeight / image.height
    )
    const imageWidth = image.width * scale
    const imageHeight = image.height * scale
    const imageLeft = (pageWidth - imageWidth) / 2

    pdf.addImage(
      image.dataUrl,
      'PNG',
      imageLeft,
      imageTop,
      imageWidth,
      imageHeight,
      undefined,
      'FAST'
    )

    pdf.setDrawColor(226, 232, 240)
    pdf.line(margin, footerTop + 2, pageWidth - margin, footerTop + 2)
    pdf.setTextColor(100, 116, 139)
    pdf.setFontSize(7)
    pdf.text(`${index + 1} / ${charts.length}`, pageWidth - margin, pageHeight - 5, { align: 'right' })
  }

  pdf.save(filename)
}