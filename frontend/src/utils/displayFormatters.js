let exportNumberFormat = false

export function setExportNumberFormat(enabled) {
  exportNumberFormat = Boolean(enabled)
}

export function getDisplayNumberFormatOptions(options = {}) {
  return {
    ...options,
    useGrouping: !exportNumberFormat
  }
}

export function formatDisplayNumber(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return String(value ?? '0')
  }

  return new Intl.NumberFormat(
    'id-ID',
    getDisplayNumberFormatOptions({ maximumFractionDigits: 2 })
  ).format(number)
}

export function formatNullableDecimal(value) {
  if (value === null || value === undefined || String(value).trim() === '') return '-'

  let text = String(value).trim().replace(/\u00A0/g, '').replace(/\s/g, '')
  const hasComma = text.includes(',')
  const hasDot = text.includes('.')

  if (hasComma && hasDot) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.')
    } else {
      text = text.replace(/,/g, '')
    }
  } else if (hasComma) {
    const groups = text.split(',')
    if (groups.length > 2 && groups.slice(1).every(group => /^\d{3}$/.test(group))) {
      text = text.replace(/,/g, '')
    } else {
      text = text.replace(',', '.')
    }
  } else if (hasDot) {
    const groups = text.split('.')
    if (groups.length > 2 && groups.slice(1).every(group => /^\d{3}$/.test(group))) {
      text = text.replace(/\./g, '')
    } else if (groups.length === 2 && /^\d{1,3}$/.test(groups[0].replace(/^[+-]/, '')) && /^\d{3}$/.test(groups[1])) {
      text = text.replace('.', '')
    }
  }

  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return String(value)

  const negative = text.startsWith('-')
  const positive = text.startsWith('+')
  const unsigned = text.replace(/^[+-]/, '')
  const [integer, fraction] = unsigned.split('.')
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negative ? '-' : positive ? '+' : ''}${groupedInteger}${fraction === undefined ? '' : `,${fraction}`}`
}