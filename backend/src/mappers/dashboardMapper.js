const {
  DASHBOARD_VALUE_UNIT
} = require(
  '../config/dashboardUnits'
)

/*
|--------------------------------------------------------------------------
| MAPPING NAMA INSTITUSI
|--------------------------------------------------------------------------
|
| Mapping hanya digunakan untuk nama tampilan.
| Ini BUKAN whitelist.
|
| Jika sektor baru muncul dan belum ada di mapping,
| kode sektor asli tetap digunakan sebagai nama.
|
*/

const institusiMap = {
  FC: 'Korporasi Finansial',
  'FC 2': 'Korporasi Finansial',

  NFC: 'Korporasi Nonfinansial',

  HH: 'Rumah Tangga',
  'HH 2': 'Rumah Tangga',

  GG: 'Pemerintah Umum',
  'GG 2': 'Pemerintah Umum',

  NPISHS: 'LNPRT',
  'NPISHS 2': 'LNPRT',

  ROW: 'Luar Negeri',
  'ROW 2': 'Luar Negeri'
}


/*
|--------------------------------------------------------------------------
| SEKTOR YANG SEMENTARA TIDAK DITAMPILKAN
|--------------------------------------------------------------------------
|
| Data tetap dibaca dari Google Sheet dan tetap masuk cache.
|
| Hanya tidak ditampilkan/dihitung sebagai institusi dashboard
| sampai aturan bisnisnya sudah jelas.
|
*/

const excludedDashboardSectors = [
  'TOTAL',
  'TOTAL EKN'
]

/*
|--------------------------------------------------------------------------
| INSTITUSI YANG DISEMBUNYIKAN DI DASHBOARD
|--------------------------------------------------------------------------
|
| Data tetap disimpan dan dibaca backend.
|
| Hanya tidak ditampilkan sebagai pilihan
| institusi pada Dashboard.
|
| NFC Private dan NFC Public nantinya
| tetap tersedia pada halaman Asset.
|
*/

const hiddenDashboardInstitutions = [
  'NFC PRIVATE',
  'NFC PUBLIC'
]


function isDashboardInstitution(sektor) {
  const kode = cleanText(sektor)
    .toUpperCase()

  if (!kode) {
    return false
  }

  return !hiddenDashboardInstitutions.includes(
    kode
  )
}

/*
|--------------------------------------------------------------------------
| CLEAN TEXT
|--------------------------------------------------------------------------
*/

function cleanText(value) {
  return String(value ?? '').trim()
}


/*
|--------------------------------------------------------------------------
| NORMALISASI TYPO TEXT
|--------------------------------------------------------------------------
|
| Memperbaiki typo dari sumber Google Sheets
| TANPA mengubah file Excel.
|
| Contoh:
|
| PENGGUNAAN 2
| PENGG 2UNAAN
| PenGG 2unaan
| PenHH 2unaan
|
| semuanya menjadi:
|
| PENGGUNAAN
|
*/

function normalizeText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return ''
  }

  return String(value)
    .trim()

    /*
     * PenGG 2unaan
     * PenHH 2unaan
     *
     * menjadi:
     * PENGGUNAAN
     */
    .replace(
      /\bPEN(?:GG|HH)\s*2UNAAN\b/gi,
      'PENGGUNAAN'
    )

    /*
     * PENGG 2UNAAN
     *
     * menjadi:
     * PENGGUNAAN
     */
    .replace(
      /\bPENGG\s*2UNAAN\b/gi,
      'PENGGUNAAN'
    )

    /*
     * PENGGUNAAN 2
     *
     * menjadi:
     * PENGGUNAAN
     */
    .replace(
      /\bPENGGUNAAN\s*2\b/gi,
      'PENGGUNAAN'
    )

    /*
     * SUMBER 2
     *
     * menjadi:
     * SUMBER
     */
    .replace(
      /\bSUMBER\s*2\b/gi,
      'SUMBER'
    )

    /*
     * Rapikan spasi ganda.
     */
    .replace(
      /\s+/g,
      ' '
    )

    .trim()
}


/*
|--------------------------------------------------------------------------
| NORMALISASI SISI / JENIS
|--------------------------------------------------------------------------
*/

function normalizeSisi(value) {
  const normalized =
    normalizeText(value)
      .toUpperCase()

  if (
    normalized ===
    'PENGGUNAAN'
  ) {
    return 'PENGGUNAAN'
  }

  if (
    normalized ===
    'SUMBER'
  ) {
    return 'SUMBER'
  }

  return normalized
}


/*
|--------------------------------------------------------------------------
| NORMALISASI NERACA
|--------------------------------------------------------------------------
*/

function normalizeNeraca(value) {
  return normalizeText(value)
}


/*
|--------------------------------------------------------------------------
| NORMALISASI KLASIFIKASI
|--------------------------------------------------------------------------
*/

function normalizeKlasifikasi(value) {
  return normalizeText(value)
}


/*
|--------------------------------------------------------------------------
| NORMALISASI RINCIAN
|--------------------------------------------------------------------------
*/

function normalizeRincian(value) {
  return normalizeText(value)
}

/*
|--------------------------------------------------------------------------
| NORMALISASI SISI
|--------------------------------------------------------------------------
|
| Beberapa data menggunakan suffix "2"
| karena penamaan/versi sumber data.
|
| Dashboard menganggap:
|
| PENGGUNAAN   = PENGGUNAAN 2
| SUMBER       = SUMBER 2
|
*/


/*
|--------------------------------------------------------------------------
| CEK SEKTOR DASHBOARD
|--------------------------------------------------------------------------
*/

function isDashboardSector(sektor) {
  const kode =
    cleanText(sektor).toUpperCase()

  if (!kode) {
    return false
  }

  return !excludedDashboardSectors.includes(
    kode
  )
}


/*
|--------------------------------------------------------------------------
| NAMA INSTITUSI
|--------------------------------------------------------------------------
*/

function getInstitusiName(sektor) {
  const kode =
    cleanText(sektor)

  if (!kode) {
    return ''
  }

  const normalizedKode =
    kode.toUpperCase()

  return (
    institusiMap[normalizedKode] ||
    kode
  )
}


/*
|--------------------------------------------------------------------------
| PARSE NILAI
|--------------------------------------------------------------------------
|
| Jika NILAI Pivot masih kosong,
| hasilnya null.
|
| Ini normal selama sheet mentor masih dalam proses.
|
*/

function parseNilai(value) {
  /*
   * Kosong = tidak ada nilai
   */
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null
  }


  /*
   * Kalau Google API sudah mengirim number,
   * langsung gunakan.
   */
  if (
    typeof value === 'number'
  ) {
    return Number.isFinite(value)
      ? value
      : null
  }


  let text =
    String(value)
      .trim()
      .replace(/\s/g, '')


  if (!text) {
    return null
  }


  /*
   * Google Sheets dengan locale Indonesia
   * dapat mengirim:
   *
   * 184,39306605199400
   *
   * atau:
   *
   * 1.234,56
   *
   * JavaScript membutuhkan:
   *
   * 184.39306605199400
   * 1234.56
   */


  /*
   * Ada koma dan titik.
   */
  if (
    text.includes(',') &&
    text.includes('.')
  ) {
    const lastComma =
      text.lastIndexOf(',')

    const lastDot =
      text.lastIndexOf('.')


    /*
     * Format Indonesia:
     * 1.234,56
     */
    if (
      lastComma >
      lastDot
    ) {
      text =
        text
          .replace(/\./g, '')
          .replace(',', '.')
    }

    /*
     * Format internasional:
     * 1,234.56
     */
    else {
      text =
        text.replace(/,/g, '')
    }
  }

  /*
   * Hanya ada koma.
   *
   * Contoh:
   * 184,39306605199400
   */
  else if (
    text.includes(',')
  ) {
    text =
      text.replace(',', '.')
  }


  const number =
    Number(text)


  return Number.isFinite(number)
    ? number
    : null
}


/*
|--------------------------------------------------------------------------
| UNIQUE VALUES
|--------------------------------------------------------------------------
*/

function uniqueValues(values) {
  return [
    ...new Set(
      values.filter(
        (value) =>
          value !== '' &&
          value !== null &&
          value !== undefined
      )
    )
  ]
}


/*
|--------------------------------------------------------------------------
| MAP SATU ROW TAHUNAN
|--------------------------------------------------------------------------
*/

function mapTahunanRow(row) {
const sektor =
  normalizeSektor(
    cleanText(row['SEKTOR'])
  )

  return {
    /*
     * Kode sektor asli Pivot.
     */

    sektor,

    /*
     * Nama untuk tampilan dashboard.
     */

    institusi:
      getInstitusiName(sektor),

    tahun:
      Number(row['TAHUN']) || null,

    sisi: normalizeSisi(
      row['SISI']
    ),

    jenisNeraca:
      normalizeNeraca(
        row['JENIS NERACA']
      ),

    kode:
      cleanText(
        row['KODE']
      ),

    rincian:
      normalizeRincian(
        row['RINCIAN']
      ),

    neracaRincian:
      normalizeText(
        row['NERACA - RINCIAN']
      ),

    nilai:
      parseNilai(row['NILAI'])
  }
}

function normalizeNamaGabungan(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return value
  }

  return String(value)
    .trim()
    .replace(/\s+\d+$/, '')
    .trim()
}

/*
|--------------------------------------------------------------------------
| MAP SEMUA DATA TAHUNAN
|--------------------------------------------------------------------------
*/

function mapTahunanData(rows) {
  const mapped =
    rows.map(
      mapTahunanRow
    )

  return mergeBySektor(
    mapped
  )
}


/*
|--------------------------------------------------------------------------
| PARSE FILTER MULTI VALUE
|--------------------------------------------------------------------------
|
| Mendukung:
|
| FC 2
|
| atau:
|
| FC 2,NFC,ROW
|
*/

function parseMultiFilter(value) {
  if (!value) {
    return []
  }

  const values =
    Array.isArray(value)
      ? value
      : String(value).split(',')

  return values
    .map((item) =>
      cleanText(item)
    )
    .filter(Boolean)
}


/*
|--------------------------------------------------------------------------
| FILTER DATA TAHUNAN
|--------------------------------------------------------------------------
*/

function filterTahunanData(
  data,
  selectedFilters = {}
) {
  /*
   * TOTAL dan TOTAL EKN
   * tidak digunakan pada output dashboard.
   */

  let filteredData =
    data.filter(
      (item) =>
        isDashboardSector(
          item.sektor
        )
    )


  /*
  |--------------------------------------------------------------------------
  | TAHUN
  |--------------------------------------------------------------------------
  */

  if (selectedFilters.tahun) {
    const selectedTahun =
      parseMultiFilter(
        selectedFilters.tahun
      )
        .map(Number)
        .filter(Number.isFinite)

    if (selectedTahun.length > 0) {
      filteredData =
        filteredData.filter(
          (item) =>
            selectedTahun.includes(
              item.tahun
            )
        )
    }
  }


  /*
  |--------------------------------------------------------------------------
  | SISI
  |--------------------------------------------------------------------------
  */

  if (selectedFilters.sisi) {
    const selectedSisi =
      parseMultiFilter(
        selectedFilters.sisi
      )
        .map((item) =>
          item.toUpperCase()
        )

    if (selectedSisi.length > 0) {
      filteredData =
        filteredData.filter(
          (item) =>
            selectedSisi.includes(
              item.sisi.toUpperCase()
            )
        )
    }
  }


  /*
  |--------------------------------------------------------------------------
  | NERACA
  |--------------------------------------------------------------------------
  */

  if (selectedFilters.neraca) {
    const selectedNeraca =
      parseMultiFilter(
        selectedFilters.neraca
      )

    if (selectedNeraca.length > 0) {
      filteredData =
        filteredData.filter(
          (item) =>
            selectedNeraca.includes(
              item.jenisNeraca
            )
        )
    }
  }


  /*
  |--------------------------------------------------------------------------
  | KLASIFIKASI
  |--------------------------------------------------------------------------
  */

  if (
    selectedFilters.klasifikasi
  ) {
    const selectedKlasifikasi =
      parseMultiFilter(
        selectedFilters.klasifikasi
      )

    if (
      selectedKlasifikasi.length > 0
    ) {
      filteredData =
        filteredData.filter(
          (item) =>
            selectedKlasifikasi.includes(
              item.rincian
            )
        )
    }
  }


  /*
  |--------------------------------------------------------------------------
  | INSTITUSI
  |--------------------------------------------------------------------------
  |
  | Filter menggunakan kode SEKTOR asli.
  |
  | Bisa satu:
  |
  | FC 2
  |
  | Bisa banyak:
  |
  | FC 2,NFC,ROW
  |
  */

  if (
    selectedFilters.institusi
  ) {
    const selectedInstitusi =
      parseMultiFilter(
        selectedFilters.institusi
      )
        .map((item) =>
          item.toUpperCase()
        )

    if (
      selectedInstitusi.length > 0
    ) {
      filteredData =
        filteredData.filter(
          (item) =>
            selectedInstitusi.includes(
              item.sektor.toUpperCase()
            )
        )
    }
  }

  return filteredData
}


/*
|--------------------------------------------------------------------------
| GENERATE FILTER TAHUNAN
|--------------------------------------------------------------------------
|
| Cascading:
|
| Tahun
|   ↓
| Sisi
|   ↓
| Neraca
|   ↓
| Klasifikasi
|   ↓
| Institusi
|
*/

function generateTahunanFilters(
  data,
  selectedFilters = {}
) {
  /*
   * Untuk filter dashboard,
   * TOTAL dan TOTAL EKN tidak disertakan.
   */

  const dashboardData =
    data.filter(
      (item) =>
        isDashboardSector(
          item.sektor
        )
    )


  /*
  |--------------------------------------------------------------------------
  | TAHUN
  |--------------------------------------------------------------------------
  */

  const tahun =
    uniqueValues(
      dashboardData.map(
        (item) => item.tahun
      )
    ).sort(
      (a, b) => a - b
    )


  /*
  |--------------------------------------------------------------------------
  | SISI
  |--------------------------------------------------------------------------
  |
  | Mengikuti Tahun.
  |
  */

  let sisiData =
    [...dashboardData]

  const selectedTahun =
    parseMultiFilter(
      selectedFilters.tahun
    )
      .map(Number)
      .filter(Number.isFinite)

  if (selectedTahun.length > 0) {
    sisiData =
      sisiData.filter(
        (item) =>
          selectedTahun.includes(
            item.tahun
          )
      )
  }

  const sisi =
    uniqueValues(
      sisiData.map(
        (item) => item.sisi
      )
    ).sort()


  /*
  |--------------------------------------------------------------------------
  | NERACA
  |--------------------------------------------------------------------------
  |
  | Mengikuti Tahun + Sisi.
  |
  */

  let neracaData =
    [...sisiData]

  const selectedSisi =
    parseMultiFilter(
      selectedFilters.sisi
    )
      .map((item) =>
        item.toUpperCase()
      )

  if (selectedSisi.length > 0) {
    neracaData =
      neracaData.filter(
        (item) =>
          selectedSisi.includes(
            item.sisi.toUpperCase()
          )
      )
  }

  const neraca =
    uniqueValues(
      neracaData.map(
        (item) =>
          item.jenisNeraca
      )
    ).sort()


  /*
  |--------------------------------------------------------------------------
  | KLASIFIKASI
  |--------------------------------------------------------------------------
  |
  | Mengikuti:
  |
  | Tahun
  | + Sisi
  | + Neraca
  |
  | Jika beberapa Neraca dipilih,
  | hasil klasifikasi adalah gabungan/union
  | dari Neraca yang dipilih.
  |
  */

  let klasifikasiData =
    [...neracaData]

  const selectedNeraca =
    parseMultiFilter(
      selectedFilters.neraca
    )

  if (selectedNeraca.length > 0) {
    klasifikasiData =
      klasifikasiData.filter(
        (item) =>
          selectedNeraca.includes(
            item.jenisNeraca
          )
      )
  }

  const klasifikasi =
    uniqueValues(
      klasifikasiData.map(
        (item) =>
          item.rincian
      )
    ).sort()


  /*
  |--------------------------------------------------------------------------
  | INSTITUSI
  |--------------------------------------------------------------------------
  |
  | Mengikuti:
  |
  | Tahun
  | + Sisi
  | + Neraca
  | + Klasifikasi
  |
  */

  let institusiData =
    [...klasifikasiData]

  const selectedKlasifikasi =
    parseMultiFilter(
      selectedFilters.klasifikasi
    )

  if (
    selectedKlasifikasi.length > 0
  ) {
    institusiData =
      institusiData.filter(
        (item) =>
          selectedKlasifikasi.includes(
            item.rincian
          )
      )
  }

  const institusiResult =
    new Map()

  institusiData.forEach(
    (item) => {
      if (
        !isDashboardSector(
          item.sektor
        )
      ) {
        return
      }

      if (
        !institusiResult.has(
          item.sektor
        )
      ) {
        institusiResult.set(
          item.sektor,
          item.institusi
        )
      }
    }
  )

  const institusi =
    Array.from(
      institusiResult.entries()
    )
      .map(
        ([kode, nama]) => ({
          kode,
          nama
        })
      )
      .sort(
        (a, b) =>
          a.nama.localeCompare(
            b.nama
          )
      )


  /*
  |--------------------------------------------------------------------------
  | RESPONSE
  |--------------------------------------------------------------------------
  */

  return {
    tahun,
    sisi,
    neraca,
    klasifikasi,
    institusi
  }
}


/*
|--------------------------------------------------------------------------
| GET INSTITUSI OPTIONS
|--------------------------------------------------------------------------
|
| Endpoint daftar institusi.
|
| TOTAL dan TOTAL EKN tidak dikirim ke dashboard.
|
*/

function getInstitusiOptions(data) {
  const institusiMapResult =
    new Map()


  data
    /*
     * TOTAL / TOTAL EKN
     * tidak digunakan Dashboard.
     */
    .filter(
      item =>
        isDashboardSector(
          item.sektor
        )
    )

    /*
     * NFC Private / NFC Public
     * tidak ditampilkan sebagai
     * institusi Dashboard.
     *
     * Tetapi data aslinya tetap ada.
     */
    .filter(
      item =>
        isDashboardInstitution(
          item.sektor
        )
    )

    .forEach(item => {
      const kode =
        cleanText(
          item.sektor
        )

      if (!kode) {
        return
      }


      if (
        !institusiMapResult.has(
          kode
        )
      ) {
        institusiMapResult.set(
          kode,
          {
            kode,

            nama:
              getInstitusiName(
                kode
              )
          }
        )
      }
    })


  return [
    ...institusiMapResult.values()
  ].sort(
    (a, b) =>
      a.nama.localeCompare(
        b.nama,
        'id'
      )
  )
}


/*
|--------------------------------------------------------------------------
| GENERATE SUMMARY TAHUNAN
|--------------------------------------------------------------------------
|
| NILAI kosong otomatis diabaikan.
|
| Jadi selama Pivot mentor belum selesai,
| dashboard tidak error.
|
*/

function generateTahunanSummary(
  data,
  selectedFilters = {}
) {
  const filteredData =
    filterTahunanData(
      data,
      selectedFilters
    )


  /*
  |--------------------------------------------------------------------------
  | GROUP PER SEKTOR
  |--------------------------------------------------------------------------
  */

  const institusiMapResult =
    new Map()

  filteredData.forEach(
    (item) => {
      /*
       * NILAI kosong/null
       * tidak dihitung.
       */

      if (
        item.nilai === null ||
        !Number.isFinite(
          item.nilai
        )
      ) {
        return
      }

      const kode =
        item.sektor

      const nama =
        item.institusi ||
        item.sektor

      /*
       * Group berdasarkan kode sektor.
       *
       * Jangan group berdasarkan nama,
       * karena kode asli tetap penting.
       */

      if (
        !institusiMapResult.has(
          kode
        )
      ) {
        institusiMapResult.set(
          kode,
          {
            kode,
            nama,
            nilai: 0
          }
        )
      }

      const current =
        institusiMapResult.get(
          kode
        )

      current.nilai +=
        item.nilai
    }
  )


  /*
  |--------------------------------------------------------------------------
  | SORT RANKING
  |--------------------------------------------------------------------------
  */

  const institusi =
    Array.from(
      institusiMapResult.values()
    )
      .sort(
        (a, b) =>
          b.nilai - a.nilai
      )


  /*
  |--------------------------------------------------------------------------
  | TOTAL NILAI
  |--------------------------------------------------------------------------
  */

  const totalNilai =
    institusi.reduce(
      (total, item) =>
        total + item.nilai,
      0
    )


  /*
  |--------------------------------------------------------------------------
  | KONTRIBUTOR TERBESAR
  |--------------------------------------------------------------------------
  */

  const kontributorTerbesar =
    institusi.length > 0
      ? {
          kode:
            institusi[0].kode,

          nama:
            institusi[0].nama,

          nilai:
            institusi[0].nilai
        }
      : null


  /*
  |--------------------------------------------------------------------------
  | RESPONSE
  |--------------------------------------------------------------------------
  */

  return {
    jumlahBaris:
      filteredData.length,

    totalNilai,

    kontributorTerbesar,

    institusi
  }
}


/*
|--------------------------------------------------------------------------
| PARSE PERIODE TRIWULANAN
|--------------------------------------------------------------------------
|
| Format dari Google Sheet:
|
| 2016/Q1
| 2016/Q2
| 2016/Q3
| 2016/Q4
|
| Hasil:
|
| {
|   periode: '2016/Q1',
|   tahun: 2016,
|   triwulan: 1
| }
|
*/

function parsePeriodeTriwulanan(value) {
  const periode =
    cleanText(value)

  if (!periode) {
    return {
      periode: '',
      tahun: null,
      triwulan: null
    }
  }

  const match =
    periode.match(
      /^(\d{4})\/Q([1-4])$/i
    )

  if (!match) {
    return {
      periode,
      tahun: null,
      triwulan: null
    }
  }

  return {
    periode,

    tahun:
      Number(match[1]),

    triwulan:
      Number(match[2])
  }
}


/*
|--------------------------------------------------------------------------
| MAP SATU ROW TRIWULANAN
|--------------------------------------------------------------------------
*/

function mapTriwulananRow(row) {
  const sektor =
    normalizeSektor(
      cleanText(row['SEKTOR'])
    )

  const periodeData =
    parsePeriodeTriwulanan(
      row['TAHUN']
    )

  return {
    /*
     * Kode sektor.
     *
     * Contoh:
     * FC
     * NFC
     * GG
     * ROW
     *
     * GG 2 -> GG
     * ODC 2 -> ODC
     */

    sektor,

    /*
     * Nama untuk dashboard.
     */

    institusi:
      getInstitusiName(sektor),

    /*
     * Periode asli.
     *
     * Contoh:
     * 2016/Q1
     */

    periode:
      periodeData.periode,

    /*
     * Tahun hasil parsing.
     */

    tahun:
      periodeData.tahun,

    /*
     * Triwulan:
     *
     * 1 = Q1
     * 2 = Q2
     * 3 = Q3
     * 4 = Q4
     */

    triwulan:
      periodeData.triwulan,

    sisi:
      normalizeSisi(
        row['SISI']
      ),

    jenisNeraca:
      normalizeNeraca(
        row['JENIS NERACA']
      ),

    kode:
      cleanText(
        row['KODE']
      ),

    rincian:
      normalizeRincian(
        row['RINCIAN']
      ),

    neracaRincian:
      normalizeText(
        row['NERACA - RINCIAN']
      ),

    /*
     * Kalau NILAI masih kosong:
     * null
     */

    nilai:
      parseNilai(
        row['NILAI']
      )
  }
}


function normalizeSektor(sektor) {
  if (
    sektor === null ||
    sektor === undefined
  ) {
    return sektor
  }

  let value =
    String(sektor)
      .trim()
      .toUpperCase()

  /*
   * Semua NFC dianggap
   * sebagai satu sektor:
   *
   * NFC
   * NFC 2
   * NFC PRIVATE
   * NFC PUBLIC
   * NFC PRIVATE 2
   * NFC PUBLIC 2
   * dst.
   */

  if (
    /^NFC(?:\s+(?:PRIVATE|PUBLIC))?(?:\s+\d+)?$/.test(
      value
    )
  ) {
    return 'NFC'
  }

  /*
   * Sektor lain:
   *
   * GG 2 -> GG
   * ODC 2 -> ODC
   * Total EKN 2 -> Total EKN
   */

  return value
    .replace(
      /\s+\d+$/,
      ''
    )
    .trim()
}

function mergeBySektor(data) {
  const grouped = new Map()

  for (const item of data) {
    const sektor =
      normalizeSektor(
        item.sektor
      )

    const key = JSON.stringify({
      sektor,
      tahun: item.tahun,
      triwulan:
        item.triwulan ?? null,
      periode:
        item.periode ?? null,
      sisi: item.sisi,
      jenisNeraca:
        item.jenisNeraca,
      kode: item.kode,
      rincian: item.rincian,
      neracaRincian:
        item.neracaRincian
    })

    if (!grouped.has(key)) {
      grouped.set(
        key,
        {
          ...item,
          sektor,
          institusi:
            getInstitusiName(
              sektor
            ),
          nilai:
            Number(item.nilai) || 0
        }
      )
    } else {
      const existing =
        grouped.get(key)

      existing.nilai +=
        Number(item.nilai) || 0
    }
  }

  return Array.from(
    grouped.values()
  )
}
/*
|--------------------------------------------------------------------------
| MAP SEMUA DATA TRIWULANAN
|--------------------------------------------------------------------------
*/

function mapTriwulananData(rows) {
  const mapped =
    rows.map(
      mapTriwulananRow
    )

  return mergeBySektor(
    mapped
  )
}

/*
|--------------------------------------------------------------------------
| FILTER DATA TRIWULANAN
|--------------------------------------------------------------------------
|
| Mendukung:
|
| Tahun
| Triwulan
| Sisi
| Neraca
| Klasifikasi
| Institusi
|
| Semua filter mendukung multi-select.
|
*/

function filterTriwulananData(
  data,
  selectedFilters = {}
) {
  /*
   * TOTAL dan TOTAL EKN
   * tidak digunakan pada output dashboard.
   */

  let filteredData =
    data.filter(
      (item) =>
        isDashboardSector(
          item.sektor
        )
    )


  /*
  |--------------------------------------------------------------------------
  | TAHUN
  |--------------------------------------------------------------------------
  */

  const selectedTahun =
    parseMultiFilter(
      selectedFilters.tahun
    )
      .map(Number)
      .filter(Number.isFinite)

  if (selectedTahun.length > 0) {
    filteredData =
      filteredData.filter(
        (item) =>
          selectedTahun.includes(
            item.tahun
          )
      )
  }


  /*
  |--------------------------------------------------------------------------
  | TRIWULAN
  |--------------------------------------------------------------------------
  |
  | Bisa:
  |
  | triwulan=1
  |
  | atau:
  |
  | triwulan=1,2,3
  |
  */

  const selectedTriwulan =
    parseMultiFilter(
      selectedFilters.triwulan
    )
      .map((item) =>
        Number(
          String(item)
            .replace(/^Q/i, '')
        )
      )
      .filter(
        (item) =>
          Number.isInteger(item) &&
          item >= 1 &&
          item <= 4
      )

  if (
    selectedTriwulan.length > 0
  ) {
    filteredData =
      filteredData.filter(
        (item) =>
          selectedTriwulan.includes(
            item.triwulan
          )
      )
  }


  /*
  |--------------------------------------------------------------------------
  | SISI
  |--------------------------------------------------------------------------
  */

  const selectedSisi =
    parseMultiFilter(
      selectedFilters.sisi
    )
      .map((item) =>
        item.toUpperCase()
      )

  if (selectedSisi.length > 0) {
    filteredData =
      filteredData.filter(
        (item) =>
          selectedSisi.includes(
            item.sisi.toUpperCase()
          )
      )
  }


  /*
  |--------------------------------------------------------------------------
  | NERACA
  |--------------------------------------------------------------------------
  */

  const selectedNeraca =
    parseMultiFilter(
      selectedFilters.neraca
    )

  if (selectedNeraca.length > 0) {
    filteredData =
      filteredData.filter(
        (item) =>
          selectedNeraca.includes(
            item.jenisNeraca
          )
      )
  }


  /*
  |--------------------------------------------------------------------------
  | KLASIFIKASI
  |--------------------------------------------------------------------------
  */

  const selectedKlasifikasi =
    parseMultiFilter(
      selectedFilters.klasifikasi
    )

  if (
    selectedKlasifikasi.length > 0
  ) {
    filteredData =
      filteredData.filter(
        (item) =>
          selectedKlasifikasi.includes(
            item.rincian
          )
      )
  }


  /*
  |--------------------------------------------------------------------------
  | INSTITUSI
  |--------------------------------------------------------------------------
  */

  const selectedInstitusi =
    parseMultiFilter(
      selectedFilters.institusi
    )
      .map((item) =>
        item.toUpperCase()
      )

  if (
    selectedInstitusi.length > 0
  ) {
    filteredData =
      filteredData.filter(
        (item) =>
          selectedInstitusi.includes(
            item.sektor.toUpperCase()
          )
      )
  }

  return filteredData
}


/*
|--------------------------------------------------------------------------
| GENERATE FILTER TRIWULANAN
|--------------------------------------------------------------------------
|
| Cascading:
|
| Tahun
|   ↓
| Triwulan
|   ↓
| Sisi
|   ↓
| Neraca
|   ↓
| Klasifikasi
|   ↓
| Institusi
|
*/

function generateTriwulananFilters(
  data,
  selectedFilters = {}
) {
  /*
   * Hilangkan TOTAL / TOTAL EKN
   * hanya dari layer dashboard.
   */

  const dashboardData =
    data.filter(
      (item) =>
        isDashboardSector(
          item.sektor
        )
    )


  /*
  |--------------------------------------------------------------------------
  | TAHUN
  |--------------------------------------------------------------------------
  */

  const tahun =
    uniqueValues(
      dashboardData.map(
        (item) => item.tahun
      )
    )
      .filter(
        Number.isFinite
      )
      .sort(
        (a, b) => a - b
      )


  /*
  |--------------------------------------------------------------------------
  | TRIWULAN
  |--------------------------------------------------------------------------
  |
  | Triwulan mengikuti Tahun.
  |
  */

  let triwulanData =
    [...dashboardData]

  const selectedTahun =
    parseMultiFilter(
      selectedFilters.tahun
    )
      .map(Number)
      .filter(Number.isFinite)

  if (selectedTahun.length > 0) {
    triwulanData =
      triwulanData.filter(
        (item) =>
          selectedTahun.includes(
            item.tahun
          )
      )
  }

  const triwulan =
    uniqueValues(
      triwulanData.map(
        (item) =>
          item.triwulan
      )
    )
      .filter(
        (item) =>
          Number.isInteger(item) &&
          item >= 1 &&
          item <= 4
      )
      .sort(
        (a, b) => a - b
      )
      .map(
        (item) => ({
          value: item,
          label: `Q${item}`
        })
      )


  /*
  |--------------------------------------------------------------------------
  | SISI
  |--------------------------------------------------------------------------
  |
  | Mengikuti Tahun + Triwulan.
  |
  */

  let sisiData =
    [...triwulanData]

  const selectedTriwulan =
    parseMultiFilter(
      selectedFilters.triwulan
    )
      .map((item) =>
        Number(
          String(item)
            .replace(/^Q/i, '')
        )
      )
      .filter(
        (item) =>
          Number.isInteger(item) &&
          item >= 1 &&
          item <= 4
      )

  if (
    selectedTriwulan.length > 0
  ) {
    sisiData =
      sisiData.filter(
        (item) =>
          selectedTriwulan.includes(
            item.triwulan
          )
      )
  }

  const sisi =
    uniqueValues(
      sisiData.map(
        (item) =>
          item.sisi
      )
    ).sort()


  /*
  |--------------------------------------------------------------------------
  | NERACA
  |--------------------------------------------------------------------------
  |
  | Mengikuti:
  |
  | Tahun
  | + Triwulan
  | + Sisi
  |
  */

  let neracaData =
    [...sisiData]

  const selectedSisi =
    parseMultiFilter(
      selectedFilters.sisi
    )
      .map((item) =>
        item.toUpperCase()
      )

  if (selectedSisi.length > 0) {
    neracaData =
      neracaData.filter(
        (item) =>
          selectedSisi.includes(
            item.sisi.toUpperCase()
          )
      )
  }

  const neraca =
    uniqueValues(
      neracaData.map(
        (item) =>
          item.jenisNeraca
      )
    ).sort()


  /*
  |--------------------------------------------------------------------------
  | KLASIFIKASI
  |--------------------------------------------------------------------------
  |
  | Mengikuti:
  |
  | Tahun
  | + Triwulan
  | + Sisi
  | + Neraca
  |
  */

  let klasifikasiData =
    [...neracaData]

  const selectedNeraca =
    parseMultiFilter(
      selectedFilters.neraca
    )

  if (selectedNeraca.length > 0) {
    klasifikasiData =
      klasifikasiData.filter(
        (item) =>
          selectedNeraca.includes(
            item.jenisNeraca
          )
      )
  }

  const klasifikasi =
    uniqueValues(
      klasifikasiData.map(
        (item) =>
          item.rincian
      )
    ).sort()


  /*
  |--------------------------------------------------------------------------
  | INSTITUSI
  |--------------------------------------------------------------------------
  |
  | Mengikuti semua filter sebelumnya.
  |
  */

  let institusiData =
    [...klasifikasiData]

  const selectedKlasifikasi =
    parseMultiFilter(
      selectedFilters.klasifikasi
    )

  if (
    selectedKlasifikasi.length > 0
  ) {
    institusiData =
      institusiData.filter(
        (item) =>
          selectedKlasifikasi.includes(
            item.rincian
          )
      )
  }

  const institusiMapResult =
    new Map()

  institusiData.forEach(
    (item) => {
      if (
        !isDashboardSector(
          item.sektor
        )
      ) {
        return
      }

      if (
        !institusiMapResult.has(
          item.sektor
        )
      ) {
        institusiMapResult.set(
          item.sektor,
          item.institusi
        )
      }
    }
  )

  const institusi =
    Array.from(
      institusiMapResult.entries()
    )
      .map(
        ([kode, nama]) => ({
          kode,
          nama
        })
      )
      .sort(
        (a, b) =>
          a.nama.localeCompare(
            b.nama
          )
      )


  /*
  |--------------------------------------------------------------------------
  | RESPONSE
  |--------------------------------------------------------------------------
  */

  return {
    tahun,
    triwulan,
    sisi,
    neraca,
    klasifikasi,
    institusi
  }
}


/*
|--------------------------------------------------------------------------
| GENERATE SUMMARY TRIWULANAN
|--------------------------------------------------------------------------
|
| Digunakan untuk:
|
| - Total Nilai
| - Kontributor Terbesar
| - Donut Chart
| - Ranking Chart
|
| Semua filter didukung:
|
| Tahun
| Triwulan
| Sisi
| Neraca
| Klasifikasi
| Institusi
|
*/

function generateTriwulananSummary(
  data,
  selectedFilters = {}
) {
  /*
   * Filter data berdasarkan
   * pilihan dashboard.
   */

  const filteredData =
    filterTriwulananData(
      data,
      selectedFilters
    )


  /*
  |--------------------------------------------------------------------------
  | GROUP BERDASARKAN SEKTOR
  |--------------------------------------------------------------------------
  */

  const institusiMapResult =
    new Map()

  filteredData.forEach(
    (item) => {
      /*
       * NILAI kosong/null
       * tidak dihitung.
       *
       * Saat Pivot mentor masih kosong,
       * bagian ini otomatis dilewati.
       */

      if (
        item.nilai === null ||
        !Number.isFinite(
          item.nilai
        )
      ) {
        return
      }

      const kode =
        item.sektor

      const nama =
        item.institusi ||
        item.sektor


      /*
       * Buat institusi jika
       * belum ada.
       */

      if (
        !institusiMapResult.has(
          kode
        )
      ) {
        institusiMapResult.set(
          kode,
          {
            kode,
            nama,
            nilai: 0
          }
        )
      }


      /*
       * Tambahkan NILAI.
       */

      const current =
        institusiMapResult.get(
          kode
        )

      current.nilai +=
        item.nilai
    }
  )


  /*
  |--------------------------------------------------------------------------
  | URUTKAN BERDASARKAN NILAI
  |--------------------------------------------------------------------------
  |
  | Terbesar → terkecil.
  |
  */

  const institusi =
    Array.from(
      institusiMapResult.values()
    )
      .sort(
        (a, b) =>
          b.nilai - a.nilai
      )


  /*
  |--------------------------------------------------------------------------
  | TOTAL NILAI
  |--------------------------------------------------------------------------
  */

  const totalNilai =
    institusi.reduce(
      (total, item) =>
        total + item.nilai,
      0
    )


  /*
  |--------------------------------------------------------------------------
  | KONTRIBUTOR TERBESAR
  |--------------------------------------------------------------------------
  */

  const kontributorTerbesar =
    institusi.length > 0
      ? {
          kode:
            institusi[0].kode,

          nama:
            institusi[0].nama,

          nilai:
            institusi[0].nilai
        }
      : null


  /*
  |--------------------------------------------------------------------------
  | RESPONSE
  |--------------------------------------------------------------------------
  */

  return {
    jumlahBaris:
      filteredData.length,

    totalNilai,

    kontributorTerbesar,

    institusi
  }
}

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {

  /*
   * Unit
   */

  DASHBOARD_VALUE_UNIT,


  /*
   * Tahunan
   */

  mapTahunanRow,
  mapTahunanData,

  filterTahunanData,

  generateTahunanFilters,
  generateTahunanSummary,


  /*
   * Triwulanan
   */

  parsePeriodeTriwulanan,

  mapTriwulananRow,
  mapTriwulananData,

  filterTriwulananData,

  generateTriwulananFilters,
  generateTriwulananSummary,


  /*
   * Shared
   */

  getInstitusiOptions,

  getInstitusiName,

  isDashboardSector

}