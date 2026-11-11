const pivotSectorIndicators = {
  'GG 2': ['PKP'],
  'NPISHS 2': ['PKLNPRT'],
  'HH 2': ['PKRT'],
  'TOTAL EKN 2': ['NTB ADHB', 'Pajak Neto atas Produk']
}

const institutionDefinitions = [
  { value: 'pivot:GG 2', label: 'GG 2 (Pivot)', sector: 'GG 2', source: 'pivot' },
  { value: 'pivot:NPISHS 2', label: 'NPISHS 2 (Pivot)', sector: 'NPISHS 2', source: 'pivot' },
  { value: 'pivot:HH 2', label: 'HH 2 (Pivot)', sector: 'HH 2', source: 'pivot' },
  { value: 'pivot:TOTAL EKN 2', label: 'TOTAL EKN 2 (Pivot)', sector: 'TOTAL EKN 2', source: 'pivot' },
  { value: 'bop:ROW', label: 'ROW (BOP)', sector: 'ROW', source: 'bop' }
]

export const BANDING_MAKRO_TYPE_OPTIONS = [
  { value: 'PKP', label: 'PKP — Pengeluaran Konsumsi Pemerintah' },
  { value: 'PKLNPRT', label: 'PKLNPRT — Pengeluaran Konsumsi LNPRT' },
  { value: 'PKRT', label: 'PKRT — Pengeluaran Konsumsi Rumah Tangga' },
  { value: 'NTB ADHB', label: 'NTB ADHB — Nilai Tambah Bruto Atas Harga Dasar' },
  { value: 'Pajak Neto atas Produk', label: 'Pajak Neto atas Produk — Pajak Dikurang Subsidi Atas Produk' },
  { value: 'PDB', label: 'PDB — Produk Domestik Bruto' },
  { value: 'BOP', label: 'BOP — Transaksi Berjalan (JISDOR)' }
]

function hasValue(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
}

function isQuarterPeriod(value) {
  return /^(\d{4})\/Q([1-4])$/.test(String(value ?? '').trim())
}

function comparePeriods(first, second) {
  const [firstYear, firstQuarter] = first.split('/Q').map(Number)
  const [secondYear, secondQuarter] = second.split('/Q').map(Number)

  return firstYear - secondYear || firstQuarter - secondQuarter
}

function matchesFilters(record, filters, excludedKey = '') {
  return Object.entries({
    institutions: record.institution,
    periods: record.period,
    macroTypes: record.macroType
  }).every(([key, value]) => {
    const selected = filters[key] || []
    return key === excludedKey || selected.length === 0 || selected.includes(value)
  })
}

export function buildBandingMakroFilterOptions({
  pivotRows = [],
  bopRows = [],
  filters = {}
} = {}) {
  const records = []

  for (const row of pivotRows) {
    const sector = String(row.sektorAsli ?? '').trim().toUpperCase()
    const period = String(row.periode ?? '').trim()
    const indicators = pivotSectorIndicators[sector]

    if (!indicators || !isQuarterPeriod(period) || !hasValue(row.nilai)) {
      continue
    }

    for (const macroType of indicators) {
      records.push({
        institution: `pivot:${sector}`,
        period,
        macroType
      })
    }
  }

  for (const row of bopRows) {
    const period = String(row.periode ?? '').trim()

    if (!isQuarterPeriod(period) || !hasValue(row.nilaiTriliunRupiah)) {
      continue
    }

    records.push({
      institution: 'bop:ROW',
      period,
      macroType: 'BOP'
    })
  }

  const institutions = institutionDefinitions
    .filter(institution => records.some(record =>
      record.institution === institution.value &&
      matchesFilters(record, filters, 'institutions')
    ))
    .map(({ value, label }) => ({ value, label }))

  const periods = [...new Set(
    records
      .filter(record => matchesFilters(record, filters, 'periods'))
      .map(record => record.period)
  )].sort(comparePeriods)

  const hasAvailabilityContext =
    (filters.institutions || []).length > 0 ||
    (filters.periods || []).length > 0
  const availableTypes = hasAvailabilityContext
    ? new Set(
        records
          .filter(record => matchesFilters(record, filters, 'macroTypes'))
          .map(record => record.macroType)
      )
    : new Set(BANDING_MAKRO_TYPE_OPTIONS.map(option => option.value))
  availableTypes.add('PDB')

  const macroTypes = BANDING_MAKRO_TYPE_OPTIONS
    .filter(option => availableTypes.has(option.value))

  return {
    institutions,
    periods,
    macroTypes,
    hasMatchingData: records.some(record => matchesFilters(record, filters))
  }
}