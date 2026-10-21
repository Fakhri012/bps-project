function mapSheetRowsToObjects(
  rows,
  requiredHeaders,
  sheetName
) {
  const headerIndex =
    rows.findIndex((row) => {
      const normalized =
        row.map((cell) =>
          String(cell ?? '')
            .trim()
            .toUpperCase()
        )

      return requiredHeaders.every(
        header => normalized.includes(header)
      )
    })

  if (headerIndex === -1) {
    throw new Error(
      `Header data tidak ditemukan pada sheet "${sheetName}"`
    )
  }

  const headers =
    rows[headerIndex].map(
      header =>
        String(header ?? '')
          .trim()
    )

  const dataRows =
    rows.slice(
      headerIndex + 1
    )

  return dataRows
    .filter(
      row =>
        row.some(
          cell =>
            String(cell ?? '')
              .trim() !== ''
        )
    )
    .map(row => {
      const item = {}

      headers.forEach(
        (header, index) => {
          if (!header) {
            return
          }

          item[header] =
            row[index] !== undefined
              ? row[index]
              : ''
        }
      )

      return item
    })
}

module.exports = {
  mapSheetRowsToObjects
}