const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildTahunanTimeSeries,
  buildTriwulananTimeSeries,
  buildTahunanKlasifikasiTimeSeries,
  buildTriwulananKlasifikasiTimeSeries,
  getLatestAnnualYear,
  getPreviousAnnualYear,
  getLandingNationalIndicators
} = require('../src/controllers/dashboardController')

const annualRows = [
  {
    tahun: 2020,
    sektor: 'FC',
    institusi: 'Korporasi Finansial',
    rincian: 'A',
    nilai: 10
  },
  {
    tahun: 2020,
    sektor: 'FC',
    institusi: 'Korporasi Finansial',
    rincian: 'A',
    nilai: 2
  },
  {
    tahun: 2021,
    sektor: 'FC',
    institusi: 'Korporasi Finansial',
    rincian: 'A',
    nilai: 11
  },
  {
    tahun: 2020,
    sektor: 'NFC',
    institusi: 'Korporasi Nonfinansial',
    rincian: 'A',
    nilai: 7
  },
  {
    tahun: 2021,
    sektor: 'NFC',
    institusi: 'Korporasi Nonfinansial',
    rincian: 'A',
    nilai: 8
  },
  {
    tahun: 2020,
    sektor: 'HH',
    institusi: 'Rumah Tangga',
    rincian: 'A',
    nilai: 5
  }
]

test('annual line chart returns one separate series for one selected sector', () => {
  const result =
    buildTahunanTimeSeries(
      annualRows,
      { institusi: 'FC' }
    )

  assert.deepEqual(
    result,
    [
      {
        tahun: 2020,
        seriesName: 'Korporasi Finansial (FC)',
        nilai: 12
      },
      {
        tahun: 2021,
        seriesName: 'Korporasi Finansial (FC)',
        nilai: 11
      }
    ]
  )
})

test('annual line chart separates each selected sector by period', () => {
  const result =
    buildTahunanTimeSeries(
      annualRows,
      { institusi: ['FC', 'NFC', 'HH'] }
    )

  assert.deepEqual(result,
    [
      {
        tahun: 2020,
        seriesName: 'Korporasi Finansial (FC)',
        nilai: 12
      },
      {
        tahun: 2020,
        seriesName: 'Korporasi Nonfinansial (NFC)',
        nilai: 7
      },
      {
        tahun: 2020,
        seriesName: 'Rumah Tangga (HH)',
        nilai: 5
      },
      {
        tahun: 2021,
        seriesName: 'Korporasi Finansial (FC)',
        nilai: 11
      },
      {
        tahun: 2021,
        seriesName: 'Korporasi Nonfinansial (NFC)',
        nilai: 8
      }
    ]
  )
})

test('annual line chart aggregates selected classifications within each selected sector', () => {
  const sectors =
    buildTahunanTimeSeries(
      annualRows,
      { institusi: ['FC', 'NFC'] }
    )

  assert.deepEqual(sectors, [
    {
      tahun: 2020,
      seriesName: 'Korporasi Finansial (FC)',
      nilai: 12
    },
    {
      tahun: 2020,
      seriesName: 'Korporasi Nonfinansial (NFC)',
      nilai: 7
    },
    {
      tahun: 2021,
      seriesName: 'Korporasi Finansial (FC)',
      nilai: 11
    },
    {
      tahun: 2021,
      seriesName: 'Korporasi Nonfinansial (NFC)',
      nilai: 8
    }
  ])

  const classifications =
    buildTahunanTimeSeries(
      [
        { ...annualRows[0], rincian: 'Konsumsi', nilai: 4 },
        { ...annualRows[0], rincian: 'Investasi', nilai: 6 }
      ],
      {
        institusi: ['FC'],
        klasifikasi: ['Konsumsi', 'Investasi']
      }
    )

  assert.deepEqual(classifications, [
    {
      tahun: 2020,
      seriesName: 'Korporasi Finansial (FC)',
      nilai: 10
    }
  ])
})

test('quarterly line chart separates sectors and preserves chronological periods', () => {
  const result =
    buildTriwulananTimeSeries(
      [
        {
          tahun: 2021,
          triwulan: 2,
          sektor: 'FC',
          institusi: 'Korporasi Finansial',
          rincian: 'A',
          nilai: 3
        },
        {
          tahun: 2020,
          triwulan: 4,
          sektor: 'FC',
          institusi: 'Korporasi Finansial',
          rincian: 'A',
          nilai: 2
        },
        {
          tahun: 2020,
          triwulan: 4,
          sektor: 'NFC',
          institusi: 'Korporasi Nonfinansial',
          rincian: 'A',
          nilai: 9
        }
      ],
      { institusi: ['FC', 'NFC'] }
    )

  assert.deepEqual(
    result.map(item => [
      item.periode,
      item.seriesName,
      item.nilai
    ]),
    [
      ['2020 Q4', 'Korporasi Finansial (FC)', 2],
      ['2020 Q4', 'Korporasi Nonfinansial (NFC)', 9],
      ['2021 Q2', 'Korporasi Finansial (FC)', 3]
    ]
  )
})

test('annual classification data groups selected balances within sector and active filters', () => {
  const result =
    buildTahunanKlasifikasiTimeSeries(
      [
        {
          tahun: 2020,
          sektor: 'FC',
          sisi: 'ASET',
          jenisNeraca: 'Neraca A',
          rincian: 'Klasifikasi X',
          nilai: 10
        },
        {
          tahun: 2020,
          sektor: 'NFC',
          sisi: 'ASET',
          jenisNeraca: 'Neraca A',
          rincian: 'Klasifikasi X',
          nilai: 5
        },
        {
          tahun: 2020,
          sektor: 'FC',
          sisi: 'ASET',
          jenisNeraca: 'Neraca B',
          rincian: 'Klasifikasi X',
          nilai: 100
        },
        {
          tahun: 2021,
          sektor: 'FC',
          sisi: 'KEWAJIBAN',
          jenisNeraca: 'Neraca A',
          rincian: 'Klasifikasi X',
          nilai: 90
        },
        {
          tahun: 2021,
          sektor: 'FC',
          sisi: 'ASET',
          jenisNeraca: 'Neraca A',
          rincian: 'Klasifikasi Y',
          nilai: null
        }
      ],
      {
        institusi: ['FC', 'NFC'],
        sisi: 'ASET',
        klasifikasi: 'Klasifikasi X'
      }
    )

  assert.deepEqual(
    result.map(item => [
      item.sektor,
      item.klasifikasi,
      item.tahun,
      item.nilai
    ]),
    [
      ['FC', 'Klasifikasi X', 2020, 110],
      ['NFC', 'Klasifikasi X', 2020, 5]
    ]
  )
})

test('quarterly classification data retains chronological periods separately', () => {
  const result =
    buildTriwulananKlasifikasiTimeSeries(
      [
        {
          tahun: 2021,
          triwulan: 1,
          sektor: 'FC',
          jenisNeraca: 'Neraca A',
          rincian: 'Klasifikasi Y',
          nilai: 8
        },
        {
          tahun: 2020,
          triwulan: 4,
          sektor: 'FC',
          jenisNeraca: 'Neraca A',
          rincian: 'Klasifikasi X',
          nilai: 3
        },
        {
          tahun: 2020,
          triwulan: 4,
          sektor: 'FC',
          jenisNeraca: 'Neraca B',
          rincian: 'Klasifikasi Y',
          nilai: 30
        }
      ],
      { institusi: 'FC' }
    )

  assert.deepEqual(
    result.map(item => [
      item.klasifikasi,
      item.periode,
      item.nilai
    ]),
    [
      ['Klasifikasi X', '2020 Q4', 3],
      ['Klasifikasi Y', '2020 Q4', 30],
      ['Klasifikasi Y', '2021 Q1', 8]
    ]
  )
})

test('landing overview selects the latest annual year and ignores quarterly rows', () => {
  const rows = [
    { tahun: 2024, sektor: 'TOTAL EKN', rincian: 'Nilai tambah bruto', nilai: 100 },
    { tahun: 2025, sektor: 'TOTAL EKN', rincian: 'Nilai tambah bruto', nilai: 10 },
    { tahun: 2025, sektor: 'TOTAL EKN', rincian: 'Nilai tambah bruto', nilai: 2 },
    { tahun: 2025, sektor: 'TOTAL EKN', rincian: 'Tabungan bruto', nilai: 4 },
    { tahun: 2025, triwulan: 4, sektor: 'TOTAL EKN', rincian: 'Nilai tambah bruto', nilai: 1000 },
    { tahun: 2026, triwulan: 1, sektor: 'TOTAL EKN', rincian: 'Nilai tambah bruto', nilai: 2000 },
    { tahun: 2025, sektor: 'FC', rincian: 'Nilai tambah bruto', nilai: 200 },
    { tahun: 2025, sektor: 'TOTAL EKN', rincian: 'Invalid', nilai: 'not-a-number' }
  ]

  const latestAnnualYear = getLatestAnnualYear(rows)
  const previousAnnualYear = getPreviousAnnualYear(
    rows,
    latestAnnualYear
  )

  assert.equal(latestAnnualYear, 2025)
  assert.equal(previousAnnualYear, 2024)

  assert.deepEqual(
    getLandingNationalIndicators(rows, latestAnnualYear),
    [
      { klasifikasi: 'Nilai tambah bruto', nilai: 12 },
      { klasifikasi: 'Tabungan bruto', nilai: 4 }
    ]
  )

  assert.deepEqual(
    getLandingNationalIndicators(rows, previousAnnualYear),
    [
      { klasifikasi: 'Nilai tambah bruto', nilai: 100 }
    ]
  )
})
