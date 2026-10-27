const sheets =
  require('../config/googleSheets')

const {
  mapSheetRowsToObjects
} = require('../utils/sheetRows')


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

const ANALISIS_RASIO_SHEET =
  'Analisis Rasio'

const PIVOT_HEADERS = [
  'SEKTOR',
  'TAHUN',
  'SISI',
  'JENIS NERACA',
  'KODE',
  'RINCIAN',
  'NILAI'
]

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
| M = KONSEP (opsional)
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
        `'${sheetName}'!E:M`
    })

  const rows =
    response.data.values || []

  if (rows.length === 0) {
    return []
  }


  return mapSheetRowsToObjects(
    rows,
    PIVOT_HEADERS,
    sheetName
  )
}

async function getDashboardData() {
  const spreadsheetId =
    process.env.GOOGLE_SHEET_ID

  if (!spreadsheetId) {
    throw new Error(
      'GOOGLE_SHEET_ID belum diatur'
    )
  }

  const response =
    await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [
        `'${TAHUNAN_SHEET}'!E:M`,
        `'${TRIWULANAN_SHEET}'!E:M`,
        `'${TRIWULANAN_SHEET_2}'!E:M`
      ]
    })

  const valueRanges =
    response.data.valueRanges || []

  const tahunanData =
    mapSheetRowsToObjects(
      valueRanges[0]?.values || [],
      PIVOT_HEADERS,
      TAHUNAN_SHEET
    )

  const triwulananData = [
    mapSheetRowsToObjects(
      valueRanges[1]?.values || [],
      PIVOT_HEADERS,
      TRIWULANAN_SHEET
    ),
    mapSheetRowsToObjects(
      valueRanges[2]?.values || [],
      PIVOT_HEADERS,
      TRIWULANAN_SHEET_2
    )
  ].flat()

  return {
    tahunan: tahunanData,
    triwulanan: triwulananData
  }
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
  const [
    data1,
    data2
  ] = await Promise.all([
    getPivotData(
      TRIWULANAN_SHEET
    ),
    getPivotData(
      TRIWULANAN_SHEET_2
    )
  ])

  return [
    ...data1,
    ...data2
  ]
}

/*
|--------------------------------------------------------------------------
| DATA ANALISIS RASIO
|--------------------------------------------------------------------------
*/

async function getAnalisisRasioData() {
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
        `'${ANALISIS_RASIO_SHEET}'!E:J`
    })

  const rows =
    response.data.values || []

  if (rows.length === 0) {
    return []
  }

  return mapSheetRowsToObjects(
    rows,
    [
      'SEKTOR',
      'TAHUN',
      'JENIS RASIO',
      'KODE',
      'RINCIAN',
      'NILAI'
    ],
    ANALISIS_RASIO_SHEET
  )
}

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {
  getTahunanData,
  getTriwulananData,
  getDashboardData,
  getAnalisisRasioData
}