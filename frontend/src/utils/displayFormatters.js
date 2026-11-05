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