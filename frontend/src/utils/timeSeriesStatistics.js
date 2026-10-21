export function buildSectorClassificationComparisons(
  data,
  frequency,
  selectedSectors = [],
  selectedKlasifikasi = []
) {
  if (
    !Array.isArray(data) ||
    !Array.isArray(selectedSectors) ||
    !['annual', 'quarterly'].includes(frequency)
  ) {
    return []
  }

  const normalize = value =>
    String(value ?? '').trim().toLowerCase()

  const sectors = new Map()
  const requestedSectors =
    selectedSectors.length > 0
      ? selectedSectors
      : data.map(item => item.sektor)

  requestedSectors.forEach(value => {
    const name = String(value ?? '').trim()
    const key = normalize(name)

    if (name && !sectors.has(key)) {
      sectors.set(key, name)
    }
  })

  const classificationNames = new Map()
  const requestedClassifications =
    Array.isArray(selectedKlasifikasi) && selectedKlasifikasi.length > 0
      ? selectedKlasifikasi
      : data.map(item => item.klasifikasi)

  requestedClassifications.forEach(value => {
    const name = String(value ?? '').trim()
    const key = normalize(name)

    if (name && !classificationNames.has(key)) {
      classificationNames.set(key, name)
    }
  })

  return [...sectors.entries()].map(([sectorKey, sektor]) => {
    const rows = data.filter(
      item => normalize(item.sektor) === sectorKey
    )
    const periods = new Map()
    const valuesByClassification = new Map(
      [...classificationNames.keys()].map(key => [key, new Map()])
    )

    rows.forEach(item => {
      const classificationKey = normalize(item.klasifikasi)
      const values = valuesByClassification.get(classificationKey)

      if (!values) {
        return
      }

      const tahun = Number(item.tahun)
      let periodKey
      let label

      if (frequency === 'annual') {
        if (!Number.isInteger(tahun)) {
          return
        }

        periodKey = tahun
        label = String(tahun)
      } else {
        const triwulan = Number(item.triwulan)

        if (
          !Number.isInteger(tahun) ||
          !Number.isInteger(triwulan) ||
          triwulan < 1 ||
          triwulan > 4
        ) {
          return
        }

        periodKey = tahun * 10 + triwulan
        label = `${tahun} Q${triwulan}`
      }

      if (
        item.nilai === null ||
        item.nilai === undefined ||
        (
          typeof item.nilai === 'string' &&
          item.nilai.trim() === ''
        )
      ) {
        return
      }

      const nilai = Number(item.nilai)

      if (!Number.isFinite(nilai)) {
        return
      }

      periods.set(periodKey, label)
      values.set(
        periodKey,
        (values.get(periodKey) || 0) + nilai
      )
    })

    const orderedPeriods = [...periods.entries()]
      .sort(([periodA], [periodB]) => periodA - periodB)

    const series = [...classificationNames.entries()].map(([key, name]) => {
      const values = valuesByClassification.get(key)

      return {
        name,
        data: orderedPeriods.map(
          ([periodKey]) => values.get(periodKey) ?? null
        )
      }
    })

    return {
      key: sectorKey,
      sektor,
      periods: orderedPeriods.map(([, label]) => label),
      series,
      hasData: series.some(item =>
        item.data.some(value => value !== null)
      )
    }
  })
}