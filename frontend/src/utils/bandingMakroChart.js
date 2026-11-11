import { BANDING_MAKRO_SECTOR_INDICATOR } from '../data/bandingMakroSectorData.js'

export const BANDING_MAKRO_MAIN_SERIES = 'Transaksi Berjalan (JISDOR)'

export function buildBandingMakroChartData(transactionRows, sectorRows, selectedSectors) {
  const selectedSectorRows = sectorRows.filter(row =>
    selectedSectors.includes(row.sektor)
  )
  const years = [...new Set([
    ...transactionRows.map(row => String(row.tahun)),
    ...selectedSectorRows.map(row => String(row.tahun))
  ])].sort((left, right) => Number(left) - Number(right))

  const transactionValues = new Map(
    transactionRows.map(row => [String(row.tahun), row.nilaiTriliunRupiah])
  )
  const series = [{
    name: BANDING_MAKRO_MAIN_SERIES,
    values: years.map(year => transactionValues.get(year) ?? null)
  }]

  selectedSectors.forEach(sector => {
    const recordsByYear = new Map()

    selectedSectorRows
      .filter(row => row.sektor === sector)
      .forEach(row => {
        const key = String(row.tahun)
        const existing = recordsByYear.get(key)
        if (existing) {
          recordsByYear.set(key, null)
        } else if (!recordsByYear.has(key)) {
          recordsByYear.set(key, row)
        }
      })

    series.push({
      name: sector,
      values: years.map(year => {
        const record = recordsByYear.get(year)
        const value = Number(record?.nilai)

        return record?.indikator === BANDING_MAKRO_SECTOR_INDICATOR &&
          record?.satuan === 'Triliun Rupiah' &&
          Number.isFinite(value)
          ? value
          : null
      })
    })
  })

  return { years, series }
}
