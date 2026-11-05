import jsPDF from 'jspdf'
import { getInstanceByDom } from 'echarts/core'
import { setExportNumberFormat } from './displayFormatters.js'

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

function formatCsvDecimal(value) {
  if (value === null || value === undefined) {
    return value
  }

  const text = String(value)
  const source = text.trim()
  const percent = source.endsWith('%')
  let numericText = percent ? source.slice(0, -1).trim() : source
  const lastComma = numericText.lastIndexOf(',')
  const lastPeriod = numericText.lastIndexOf('.')

  if (lastComma >= 0 && lastPeriod >= 0) {
    const decimalSeparator = lastComma > lastPeriod ? ',' : '.'
    const groupingSeparator = decimalSeparator === ',' ? '.' : ','
    numericText = numericText
      .replaceAll(groupingSeparator, '')
      .replace(decimalSeparator, '.')
  } else if (lastComma >= 0) {
    numericText = numericText.replace(',', '.')
  }

  if (!/^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(numericText)) {
    return text
  }

  return `${numericText}${percent ? '%' : ''}`
}

export function serializeCsv(headers, rows, { numericColumns = [] } = {}) {
  const numericColumnSet = new Set(numericColumns)
  const content = [headers, ...rows]
    .map(row => row
      .map((value, index) => escapeCsvValue(
        numericColumnSet.has(index)
          ? formatCsvDecimal(value)
          : value
      ))
      .join(';'))
    .join('\r\n')

  return `\uFEFFsep=;\r\n${content}`
}

function getNumericCell(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { value, source: String(value), percent: false }
      : null
  }

  if (value === null || value === undefined || value === '') {
    return null
  }

  const source = String(value).trim()
  const percent = source.endsWith('%')
  let numericText = percent ? source.slice(0, -1).trim() : source
  const lastComma = numericText.lastIndexOf(',')
  const lastPeriod = numericText.lastIndexOf('.')

  if (lastComma >= 0 && lastPeriod >= 0) {
    const decimalSeparator = lastComma > lastPeriod ? ',' : '.'
    const groupingSeparator = decimalSeparator === ',' ? '.' : ','
    numericText = numericText
      .replaceAll(groupingSeparator, '')
      .replace(decimalSeparator, '.')
  } else if (lastComma >= 0) {
    numericText = numericText.replace(',', '.')
  }

  if (!/^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(numericText)) {
    return null
  }

  const numericParts = numericText.match(
    /^([+-]?\d+(?:\.\d+)?)(?:[eE]([+-]?\d+))?$/
  )

  if (!numericParts) {
    return null
  }

  const adjustedExponent = Number(numericParts[2] || 0) - (percent ? 2 : 0)
  const valueNumber = Number(`${numericParts[1]}e${adjustedExponent}`)

  return Number.isFinite(valueNumber)
    ? { value: valueNumber, source, percent }
    : null
}

function getExcelNumberFormat(source, percent) {
  const numericText = source.replace(/%$/, '').trim()
  const decimalPart = numericText.split(/[.,]/).at(-1)
  const decimalPlaces = /[.,]/.test(numericText)
    ? (decimalPart.match(/^\d+/)?.[0].length || 0)
    : 0
  const numberFormat = decimalPlaces > 0
    ? `0.${'0'.repeat(decimalPlaces)}`
    : '0'

  return `[$-421]${numberFormat}${percent ? '%' : ''}`
}

function createExcelWorkbook(ExcelJS, headers, rows, { numericColumns = [] } = {}) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Data')
  const numericColumnSet = new Set(numericColumns)
  const tableRows = rows.map(row => row.map((value, columnIndex) => {
    const numericCell = numericColumnSet.has(columnIndex)
      ? getNumericCell(value)
      : null

    return numericCell?.value ?? value ?? null
  }))

  worksheet.views = [{
    state: 'frozen',
    ySplit: 1,
    topLeftCell: 'A2',
    activeCell: 'A2',
    showGridLines: false
  }]
  worksheet.addTable({
    name: 'DashboardExport',
    ref: 'A1',
    headerRow: true,
    style: {
      theme: 'TableStyleMedium4',
      showRowStripes: true,
      showColumnStripes: false
    },
    columns: headers.map((header, index) => ({
      name: String(header ?? `Kolom ${index + 1}`),
      filterButton: true
    })),
    rows: tableRows
  })

  worksheet.getRow(1).height = 30
  headers.forEach((_, columnIndex) => {
    const cell = worksheet.getCell(1, columnIndex + 1)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B5D58' }
    }
    cell.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
      size: 11
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true
    }
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF084C48' } }
    }
  })

  rows.forEach((row, rowIndex) => {
    worksheet.getRow(rowIndex + 2).height = 23

    row.forEach((value, columnIndex) => {
      const cell = worksheet.getCell(rowIndex + 2, columnIndex + 1)
      const numericCell = numericColumnSet.has(columnIndex)
        ? getNumericCell(value)
        : null

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: rowIndex % 2 === 0 ? 'FFF1F7F6' : 'FFFFFFFF'
        }
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: numericColumnSet.has(columnIndex) ? 'right' : 'left'
      }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFDCE8E6' } }
      }

      if (numericCell) {
        cell.value = numericCell.value
        cell.numFmt = getExcelNumberFormat(numericCell.source, numericCell.percent)
      }
    })
  })

  headers.forEach((header, columnIndex) => {
    const maxLength = rows.reduce(
      (length, row) => Math.max(length, String(row[columnIndex] ?? '').length),
      String(header ?? '').length
    )

    worksheet.getColumn(columnIndex + 1).width = Math.min(
      Math.max(maxLength + 4, 14),
      72
    )
  })

  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0
  }

  return { workbook, worksheet }
}

async function loadExcelJS() {
  const module = await import('exceljs')
  return module.default ?? module
}

export async function buildExcelWorksheet(headers, rows, options) {
  const ExcelJS = await loadExcelJS()
  return createExcelWorkbook(ExcelJS, headers, rows, options).worksheet
}

export async function downloadExcelFile(filename, headers, rows, options) {
  try {
    const ExcelJS = await loadExcelJS()
    const { workbook } = createExcelWorkbook(ExcelJS, headers, rows, options)
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
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
  } catch (error) {
    console.error('Gagal mengekspor file Excel:', error)
    window.alert(error?.message || 'Gagal membuat file Excel.')
  }
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

export function downloadCsvFile(filename, headers, rows, options) {
  const blob = new Blob(
    [serializeCsv(headers, rows, options)],
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

  const chartInstances = Array.from(new Set(
    charts.flatMap(element => [
      element,
      ...element.querySelectorAll('[_echarts_instance_]')
    ])
      .map(getInstanceByDom)
      .filter(instance => instance && !instance.isDisposed())
  ))
  const refreshCharts = () => chartInstances.forEach(chart => chart.resize())
  const waitForFrame = () => new Promise(resolve => requestAnimationFrame(resolve))

  setExportNumberFormat(true)

  try {
    refreshCharts()
    await waitForFrame()

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
  } finally {
    setExportNumberFormat(false)
    refreshCharts()
    await waitForFrame()
  }
}