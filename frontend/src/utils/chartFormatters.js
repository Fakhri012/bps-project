export function formatDatabaseNumber(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return String(value ?? '0')
  }

  const decimal = number.toString()

  if (/[eE]/.test(decimal)) {
    return new Intl.NumberFormat(
      'id-ID',
      { maximumSignificantDigits: 21 }
    ).format(number)
  }

  const negative = decimal.startsWith('-')
  const [integer, fraction] =
    (negative ? decimal.slice(1) : decimal).split('.')
  const groupedInteger = Number(integer).toLocaleString(
    'id-ID',
    { maximumFractionDigits: 0 }
  )

  return `${negative ? '-' : ''}${groupedInteger}${fraction ? `,${fraction}` : ''}`
}

export function formatTimeSeriesNumber(value) {
  const number =
    Number(value)

  if (!Number.isFinite(number)) {
    return '0'
  }

  return formatDatabaseNumber(number)
}

export function formatTimeSeriesAxis(value) {
  const number =
    Number(value)

  if (!Number.isFinite(number)) {
    return '0'
  }

  return formatTimeSeriesNumber(number)
}