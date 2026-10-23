export function formatDisplayNumber(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return String(value ?? '0')
  }

  return new Intl.NumberFormat(
    'id-ID',
    { maximumFractionDigits: 2 }
  ).format(number)
}