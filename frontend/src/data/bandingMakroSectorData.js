export const bandingMakroSectorOptions = [
  { kode: 'FC', nama: 'FC' },
  { kode: 'NFC', nama: 'NFC' },
  { kode: 'HH', nama: 'HH' },
  { kode: 'GG', nama: 'GG' },
  { kode: 'NPISHS', nama: 'NPISHS' },
  { kode: 'ROW', nama: 'ROW' }
]

export const BANDING_MAKRO_SECTOR_INDICATOR = 'Transaksi Berjalan'

// Expected row: { tahun, sektor, indikator, nilai, satuan: 'Triliun Rupiah' }.
// Populate only after the sector source is verified against this indicator and unit.
export const bandingMakroSectorRows = []
