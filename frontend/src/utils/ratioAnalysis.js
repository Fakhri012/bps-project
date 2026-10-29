export function normalizeRatioSektor(value) {
  const sektor = String(value ?? '').trim().toUpperCase()

  if (/^ROW\s*2$/.test(sektor)) {
    return 'ROW'
  }

  if (/^NFC(?:\s+\d+)?$/.test(sektor)) {
    return 'NFC'
  }

  if (/^NFC PRIVATE(?:\s+\d+)?$/.test(sektor)) {
    return 'NFC PRIVATE'
  }

  if (/^NFC PUBLIC(?:\s+\d+)?$/.test(sektor)) {
    return 'NFC PUBLIC'
  }

  return sektor.replace(/\s+\d+$/, '').trim()
}

export function getRatioTypesForSectors(data, selectedSectors) {
  const sectors = new Set(
    selectedSectors.map(normalizeRatioSektor)
  )

  return [
    ...new Set(
      data
        .filter(item =>
          sectors.size === 0 ||
          sectors.has(normalizeRatioSektor(item.SEKTOR))
        )
        .map(item => String(item['JENIS RASIO'] ?? '').trim())
        .filter(Boolean)
    )
  ]
}

export function filterRatioData(
  data,
  { sectors = [], periods = [], ratios = [] } = {}
) {
  const selectedSectors = new Set(sectors.map(normalizeRatioSektor))
  const selectedPeriods = new Set(periods.map(String))
  const selectedRatios = new Set(ratios)

  return data.filter(item =>
    (selectedSectors.size === 0 ||
      selectedSectors.has(normalizeRatioSektor(item.SEKTOR))) &&
    (selectedPeriods.size === 0 ||
      selectedPeriods.has(String(item.TAHUN))) &&
    (selectedRatios.size === 0 ||
      selectedRatios.has(item['JENIS RASIO']))
  )
}

export function numericRatioValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : null
  }

  const normalized = String(value).trim()
  const lastComma = normalized.lastIndexOf(',')
  const lastPeriod = normalized.lastIndexOf('.')
  let numericText = normalized

  if (lastComma >= 0 && lastPeriod >= 0) {
    const decimalSeparator = lastComma > lastPeriod ? ',' : '.'
    const groupingSeparator = decimalSeparator === ',' ? '.' : ','

    numericText = normalized
      .replaceAll(groupingSeparator, '')
      .replace(decimalSeparator, '.')
  } else if (lastComma >= 0) {
    numericText = normalized.replace(',', '.')
  }

  const parsed = Number(numericText)

  return Number.isFinite(parsed)
    ? parsed
    : null
}

export function buildRatioChartRows(sourceData, ratio) {
  const map = new Map()
  const sectors = new Set()

  sourceData.forEach(item => {
    if (item['JENIS RASIO'] !== ratio) {
      return
    }

    const periode = String(item.TAHUN ?? '').trim()
    const rawSektor = String(item.SEKTOR ?? '').trim().toUpperCase()
    const sektor = normalizeRatioSektor(item.SEKTOR)

    if (!periode || !sektor) {
      return
    }

    if (!map.has(periode)) {
      map.set(periode, { periode })
    }

    const row = map.get(periode)
    const isCanonicalSector = rawSektor === sektor
    const hasCanonicalValue = row[`_${sektor}Canonical`]

    if (!hasCanonicalValue || isCanonicalSector) {
      row[sektor] = numericRatioValue(item.NILAI)
      row[`_${sektor}Canonical`] = isCanonicalSector
    }

    sectors.add(sektor)
  })

  return {
    rows: Array.from(map.values()).sort((first, second) =>
      String(first.periode).localeCompare(
        String(second.periode),
        undefined,
        { numeric: true }
      )
    ),
    sectors: Array.from(sectors)
  }
}
