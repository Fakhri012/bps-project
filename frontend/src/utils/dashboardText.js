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