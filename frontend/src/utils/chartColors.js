/*
|--------------------------------------------------------------------------
| CHART COLOR PALETTE
|--------------------------------------------------------------------------
|
| Warna dibuat kontras dan berbeda jelas
| antar sektor / institusi.
|
| Tidak bergantung pada nama sektor.
| Warna mengikuti urutan data.
|
*/

export const chartColors = [
  '#2563EB', // Biru
  '#F97316', // Oranye
  '#16A34A', // Hijau
  '#9333EA', // Ungu
  '#DC2626', // Merah
  '#0891B2', // Cyan
  '#EAB308', // Kuning
  '#DB2777', // Pink
  '#65A30D', // Lime
  '#7C3AED', // Violet
  '#EA580C', // Oranye tua
  '#0D9488', // Teal
  '#C026D3', // Magenta
  '#4D7C0F', // Hijau zaitun
  '#B45309', // Coklat / amber tua
  '#0284C7'  // Biru muda
]


export function getChartColor(index) {
  return chartColors[
    index % chartColors.length
  ]
}