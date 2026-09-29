const sheets =
  require('../config/googleSheets')


/*
|--------------------------------------------------------------------------
| NAMA SHEET
|--------------------------------------------------------------------------
*/

const TAHUNAN_SHEET =
  'Karakteristik & Pivot Tahunan'

const TRIWULANAN_SHEET =
  'Karakteristik & Pivot Triwulanan'

const TRIWULANAN_SHEET_2 =
  'Karakteristik & Pivot Triwulan 2'


/*
|--------------------------------------------------------------------------
| HELPER MEMBACA PIVOT
|--------------------------------------------------------------------------
|
| Kedua Pivot mempunyai struktur:
|
| E = SEKTOR
| F = TAHUN
| G = SISI
| H = JENIS NERACA
| I = KODE
| J = RINCIAN
| K = NERACA - RINCIAN
| L = NILAI
|
*/

async function getPivotData(
  sheetName
) {
  const spreadsheetId =
    process.env.GOOGLE_SHEET_ID

  if (!spreadsheetId) {
    throw new Error(
      'GOOGLE_SHEET_ID belum diatur'
    )
  }

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId,

      range:
        `'${sheetName}'!E:L`
    })

  const rows =
    response.data.values || []

  if (rows.length === 0) {
    return []
  }


  /*
  |--------------------------------------------------------------------------
  | CARI HEADER
  |--------------------------------------------------------------------------
  |
  | Jangan menganggap header selalu berada
  | pada baris pertama.
  |
  */

  const headerIndex =
    rows.findIndex((row) => {
      const normalized =
        row.map((cell) =>
          String(cell ?? '')
            .trim()
            .toUpperCase()
        )

      return (
        normalized.includes(
          'SEKTOR'
        ) &&
        normalized.includes(
          'TAHUN'
        ) &&
        normalized.includes(
          'SISI'
        ) &&
        normalized.includes(
          'JENIS NERACA'
        ) &&
        normalized.includes(
          'KODE'
        ) &&
        normalized.includes(
          'RINCIAN'
        ) &&
        normalized.includes(
          'NILAI'
        )
      )
    })


  /*
  |--------------------------------------------------------------------------
  | HEADER TIDAK DITEMUKAN
  |--------------------------------------------------------------------------
  */

  if (headerIndex === -1) {
    throw new Error(
      `Header data tidak ditemukan pada sheet "${sheetName}"`
    )
  }


  /*
  |--------------------------------------------------------------------------
  | AMBIL HEADER
  |--------------------------------------------------------------------------
  */

  const headers =
    rows[headerIndex].map(
      (header) =>
        String(header ?? '')
          .trim()
    )


  /*
  |--------------------------------------------------------------------------
  | AMBIL DATA SETELAH HEADER
  |--------------------------------------------------------------------------
  */

  const dataRows =
    rows.slice(
      headerIndex + 1
    )


  /*
  |--------------------------------------------------------------------------
  | UBAH ROW MENJADI OBJECT
  |--------------------------------------------------------------------------
  */

  return dataRows
    .filter(
      (row) =>
        row.some(
          (cell) =>
            String(cell ?? '')
              .trim() !== ''
        )
    )
    .map((row) => {
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


/*
|--------------------------------------------------------------------------
| DATA TAHUNAN
|--------------------------------------------------------------------------
*/

async function getTahunanData() {
  return getPivotData(
    TAHUNAN_SHEET
  )
}


/*
|--------------------------------------------------------------------------
| DATA TRIWULANAN
|--------------------------------------------------------------------------
*/

async function getTriwulananData() {
  const data1 =
    await getPivotData(
      TRIWULANAN_SHEET
    )

  const data2 =
    await getPivotData(
      TRIWULANAN_SHEET_2
    )

  // console.log(
  //   'Triwulanan Sheet 1:',
  //   data1.length
  // )

  // console.log(
  //   'Triwulanan Sheet 2:',
  //   data2.length
  // )

  // console.log(
  //   'Total setelah digabung:',
  //   data1.length + data2.length
  // )

  return [
    ...data1,
    ...data2
  ]
}


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {
  getTahunanData,
  getTriwulananData
}