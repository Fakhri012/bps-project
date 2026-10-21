export function formatFixedTwoDecimals(value) {
  return new Intl.NumberFormat(
    'id-ID',
    {
      useGrouping: true,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(
    Number(value) || 0
  )
}

export function formatTimeSeriesNumber(value) {
  const number =
    Number(value)

  if (!Number.isFinite(number)) {
    return '0'
  }

  return new Intl.NumberFormat(
    'id-ID',
    {
      maximumFractionDigits: 2
    }
  ).format(number)
}

export function formatTimeSeriesAxis(value) {
  const number =
    Number(value)

  if (!Number.isFinite(number)) {
    return '0,00 T'
  }

  const trillion =
    number / 1000000

  return (
    trillion.toLocaleString(
      'id-ID',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ) + ' T'
  )
}