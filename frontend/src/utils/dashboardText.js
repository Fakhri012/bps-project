export function normalizeDisplayText(value) {
  return String(value ?? '')
    .replace(
      /PENGG\s*2UNAAN/gi,
      'PENGGUNAAN'
    )
    .replace(
      /PENGGUNAAN\s*2/gi,
      'PENGGUNAAN'
    )
    .trim()
}

export function formatNeracaOptionLabel(value) {
  const label = normalizeDisplayText(value)
  const normalizedLabel = label.toLocaleLowerCase('id-ID')

  const balanceSheetLabels = {
    opening: 'Balance Sheet (Opening)',
    closing: 'Balance Sheet (Closing)',
    'total perubahan aset/kewajiban':
      'Balance Sheet (Total Perubahan Aset/Kewajiban)'
  }

  return balanceSheetLabels[normalizedLabel] ?? label
}

export function prioritizeSectorOptions(options = []) {
  const priority = {
    NFC: 0,
    FC: 1,
    CB: 2,
    ODC: 3
  }

  return options
    .map((option, index) => {
      const value =
        typeof option === 'object' && option !== null
          ? option.value || option.kode || option.label
          : option
      const code = String(value ?? '').trim().toUpperCase()
      const match = code.match(/^(NFC|FC|CB|ODC)(?:\s|$)/)

      return {
        option,
        index,
        priority: match ? priority[match[1]] : Number.MAX_SAFE_INTEGER
      }
    })
    .sort((first, second) =>
      first.priority - second.priority ||
      first.index - second.index
    )
    .map(item => item.option)
}