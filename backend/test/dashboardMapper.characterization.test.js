const test = require('node:test')
const assert = require('node:assert/strict')

const mapper = require('../src/mappers/dashboardMapper')

function createRow(sektor, nilai, tahun = '2023', kode = 'K1') {
  return {
    SEKTOR: sektor,
    TAHUN: tahun,
    SISI: 'PENGG 2UNAAN',
    'JENIS NERACA': 'Neraca PENGGUNAAN 2',
    KODE: kode,
    RINCIAN: 'PENHH 2unaan',
    'NERACA - RINCIAN': 'SUMBER 2',
    NILAI: nilai
  }
}

test('normalizes mapped text and sector suffixes', () => {
  const normalized = mapper.mapTahunanRow({
    ...createRow(' FC ', '184,39306605199400', '2024'),
    SISI: 'PENGG 2UNAAN',
    'JENIS NERACA': 'PENGGUNAAN 2',
    KODE: ' K1 ',
    RINCIAN: 'PENHH 2unaan',
    'NERACA - RINCIAN': 'SUMBER 2'
  })

  assert.deepEqual(
    {
      sektor: normalized.sektor,
      institusi: normalized.institusi,
      sisi: normalized.sisi,
      jenisNeraca: normalized.jenisNeraca,
      kode: normalized.kode,
      rincian: normalized.rincian,
      neracaRincian: normalized.neracaRincian,
      nilai: normalized.nilai
    },
    {
      sektor: 'FC',
      institusi: 'Korporasi Finansial',
      sisi: 'PENGGUNAAN',
      jenisNeraca: 'PENGGUNAAN',
      kode: 'K1',
      rincian: 'PENGGUNAAN',
      neracaRincian: 'SUMBER',
      nilai: 184.393066051994
    }
  )

  const sectors = [
    'FC 2',
    'GG 2',
    'NFC 2',
    'NFC PRIVATE 2',
    'NFC PUBLIC 3',
    'ODC 2'
  ].map(sektor => {
    const item = mapper.mapTahunanRow(
      createRow(sektor, '1')
    )

    return [item.sektor, item.institusi]
  })

  assert.deepEqual(sectors, [
    ['FC', 'Korporasi Finansial'],
    ['GG', 'Pemerintah Umum'],
    ['NFC', 'Korporasi Nonfinansial'],
    ['NFC PRIVATE', 'NFC PRIVATE'],
    ['NFC PUBLIC', 'NFC PUBLIC'],
    ['ODC', 'ODC']
  ])
})

test('parses Indonesian and international numeric formats', () => {
  const cases = [
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['184,39306605199400', 184.393066051994],
    ['', null],
    ['invalid', null],
    [null, null]
  ]

  for (const [input, expected] of cases) {
    assert.equal(
      mapper.mapTahunanRow(
        createRow('FC', input)
      ).nilai,
      expected,
      `unexpected parsed value for ${String(input)}`
    )
  }
})

test('merges annual sector suffixes and preserves annual summary output', () => {
  const mapped = mapper.mapTahunanData([
    createRow('FC', '1.234,56'),
    createRow('FC 2', '1,234.56'),
    createRow('NFC', '2.500,00'),
    createRow('NFC PRIVATE 2', '999'),
    createRow('NFC PUBLIC 3', '888'),
    createRow('GG', '-10'),
    createRow('FC', '', '2023', 'K2'),
    createRow('FC', 'invalid', '2023', 'K3')
  ])

  assert.deepEqual(
    mapped.map(({ sektor, kode, nilai }) => [sektor, kode, nilai]),
    [
      ['FC', 'K1', 2469.12],
      ['NFC', 'K1', 2500],
      ['NFC PRIVATE', 'K1', 999],
      ['NFC PUBLIC', 'K1', 888],
      ['GG', 'K1', -10],
      ['FC', 'K2', 0],
      ['FC', 'K3', 0]
    ]
  )

  assert.deepEqual(
    mapper.generateTahunanSummary(mapped, {}),
    {
      jumlahBaris: 5,
      totalNilai: null,
      kontributorTerbesar: {
        kode: 'NFC',
        nama: 'Korporasi Nonfinansial',
        nilai: 2500
      },
      institusi: [
        {
          kode: 'NFC',
          nama: 'Korporasi Nonfinansial',
          nilai: 2500
        },
        {
          kode: 'FC',
          nama: 'Korporasi Finansial',
          nilai: 2469.12
        },
        {
          kode: 'GG',
          nama: 'Pemerintah Umum',
          nilai: -10
        }
      ],
      sektorKlasifikasi: [
        { kode: 'FC', nama: 'Korporasi Finansial', klasifikasi: 'PENGGUNAAN', nilai: 2469.12 },
        { kode: 'GG', nama: 'Pemerintah Umum', klasifikasi: 'PENGGUNAAN', nilai: -10 },
        { kode: 'NFC', nama: 'Korporasi Nonfinansial', klasifikasi: 'PENGGUNAAN', nilai: 2500 }
      ],
      metadata: {
        konsep: [],
        jumlahKonsep: 0,
        periode: ['2023'],
        sektor: ['FC', 'GG', 'NFC'],
        rincian: ['PENGGUNAAN']
      }
    }
  )
})

test('merges quarterly sector suffixes and reports no total without a TOTAL EKN row', () => {
  const mapped = mapper.mapTriwulananData([
    createRow('FC', '1.234,50', '2023/Q1'),
    createRow('FC 2', '25', '2023/Q1'),
    createRow('NFC', '2,000.00', '2023/Q1'),
    createRow('NFC PRIVATE 2', '50', '2023/Q1'),
    createRow('GG', '-2', '2023/Q1'),
    createRow('FC', 'invalid', '2023/Q1', 'K2')
  ])

  assert.deepEqual(
    mapped.map(({ sektor, periode, triwulan, kode, nilai }) => [
      sektor,
      periode,
      triwulan,
      kode,
      nilai
    ]),
    [
      ['FC', '2023/Q1', 1, 'K1', 1259.5],
      ['NFC', '2023/Q1', 1, 'K1', 2000],
      ['NFC PRIVATE', '2023/Q1', 1, 'K1', 50],
      ['GG', '2023/Q1', 1, 'K1', -2],
      ['FC', '2023/Q1', 1, 'K2', 0]
    ]
  )

  assert.deepEqual(
    mapper.generateTriwulananSummary(
      mapped,
      { tahun: '2023', triwulan: '1' }
    ),
    {
      jumlahBaris: 4,
      totalNilai: null,
      kontributorTerbesar: {
        kode: 'NFC',
        nama: 'Korporasi Nonfinansial',
        nilai: 2000
      },
      institusi: [
        {
          kode: 'NFC',
          nama: 'Korporasi Nonfinansial',
          nilai: 2000
        },
        {
          kode: 'FC',
          nama: 'Korporasi Finansial',
          nilai: 1259.5
        },
        {
          kode: 'GG',
          nama: 'Pemerintah Umum',
          nilai: -2
        }
      ],
      sektorKlasifikasi: [
        { kode: 'FC', nama: 'Korporasi Finansial', klasifikasi: 'PENGGUNAAN', nilai: 1259.5 },
        { kode: 'GG', nama: 'Pemerintah Umum', klasifikasi: 'PENGGUNAAN', nilai: -2 },
        { kode: 'NFC', nama: 'Korporasi Nonfinansial', klasifikasi: 'PENGGUNAAN', nilai: 2000 }
      ],
      metadata: {
        konsep: [],
        jumlahKonsep: 0,
        periode: ['2023/Q1'],
        sektor: ['FC', 'GG', 'NFC'],
        rincian: ['PENGGUNAAN']
      }
    }
  )
})

test('preserves summary handling for invalid values, ties, negatives, and empty data', () => {
  const rows = [
    { sektor: 'FC', institusi: 'Financial', nilai: null, tahun: 2023, triwulan: 1 },
    { sektor: 'FC', institusi: 'Financial', nilai: NaN, tahun: 2023, triwulan: 1 },
    { sektor: 'FC', institusi: 'Financial', nilai: Infinity, tahun: 2023, triwulan: 1 },
    { sektor: 'FC', institusi: 'Financial', nilai: '7', tahun: 2023, triwulan: 1 },
    { sektor: 'GG', institusi: 'Government', nilai: 0, tahun: 2023, triwulan: 1 },
    { sektor: 'GG', institusi: 'Government', nilai: 0, tahun: 2023, triwulan: 1 },
    { sektor: 'ROW', institusi: 'Abroad', nilai: 1000, tahun: 2023, triwulan: 1 },
    { sektor: 'HH', institusi: 'Household', nilai: -4, tahun: 2023, triwulan: 1 },
    { sektor: 'NFC PRIVATE', institusi: 'Private', nilai: 99, tahun: 2023, triwulan: 1 }
  ]

  const expected = {
    jumlahBaris: 7,
    totalNilai: null,
    kontributorTerbesar: {
      kode: 'GG',
      nama: 'Government',
      nilai: 0
    },
    institusi: [
      {
        kode: 'GG',
        nama: 'Government',
        nilai: 0
      },
      {
        kode: 'HH',
        nama: 'Household',
        nilai: -4
      }
    ],
    sektorKlasifikasi: [
      { kode: 'GG', nama: 'Government', klasifikasi: '', nilai: 0 },
      { kode: 'HH', nama: 'Household', klasifikasi: '', nilai: -4 }
    ],
    metadata: {
      konsep: [],
      jumlahKonsep: 0,
      periode: ['2023'],
      sektor: ['FC', 'GG', 'HH'],
      rincian: []
    }
  }

  assert.deepEqual(
    mapper.generateTahunanSummary(rows, {}),
    expected
  )

  assert.deepEqual(
    mapper.generateTriwulananSummary(
      rows,
      { tahun: '2023', triwulan: '1' }
    ),
    expected
  )

  const emptySummary = {
    jumlahBaris: 0,
    totalNilai: null,
    kontributorTerbesar: null,
    institusi: [],
    sektorKlasifikasi: [],
    metadata: {
      konsep: [],
      jumlahKonsep: 0,
      periode: [],
      sektor: [],
      rincian: []
    }
  }

  assert.deepEqual(
    mapper.generateTahunanSummary([], {}),
    emptySummary
  )

  assert.deepEqual(
    mapper.generateTriwulananSummary(
      [],
      { tahun: '2023', triwulan: '1' }
    ),
    emptySummary
  )
})

test('dashboard summary defaults to five Total EKN sectors and excludes ROW and totals', () => {
  const rows = [
    { sektor: 'NFC', institusi: 'NFC', nilai: 1, tahun: 2025 },
    { sektor: 'FC', institusi: 'FC', nilai: 2, tahun: 2025 },
    { sektor: 'GG', institusi: 'GG', nilai: 3, tahun: 2025 },
    { sektor: 'HH', institusi: 'HH', nilai: 4, tahun: 2025 },
    { sektor: 'NPISHS', institusi: 'LNPRT', nilai: 5, tahun: 2025 },
    { sektor: 'ROW', institusi: 'Luar Negeri', nilai: 1000, tahun: 2025 },
    { sektor: 'TOTAL EKN', institusi: 'TOTAL EKN', nilai: 10000, tahun: 2025 },
    { sektor: 'TOTAL EKN', institusi: 'TOTAL EKN', nilai: 90000, tahun: 2024 }
  ]

  const summary = mapper.generateTahunanSummary(rows, { tahun: '2025' })

  assert.equal(summary.jumlahBaris, 5)
  assert.equal(summary.totalNilai, 10000)
  assert.equal(
    summary.institusi.reduce((sum, item) => sum + item.nilai, 0),
    15
  )
  assert.deepEqual(
    summary.metadata.sektor,
    ['FC', 'GG', 'HH', 'NFC', 'NPISHS']
  )
})

test('Total EKN uses the selected year, side, balance, and classification while sector details stay separate', () => {
  const sectors = [
    ['NFC', 10],
    ['FC', 20],
    ['GG', 30],
    ['HH', 25],
    ['NPISHS', 15]
  ]
  const additionalCodeValues = new Map([
    ['NFC', 1],
    ['FC', 2],
    ['GG', 3],
    ['HH', 4],
    ['NPISHS', 5]
  ])
  const common = {
    tahun: 2025,
    sisi: 'PENGGUNAAN',
    jenisNeraca: 'Neraca A',
    kode: 'K1',
    rincian: 'Rincian A',
    neracaRincian: 'Balance A'
  }
  const rows = [
    ...sectors.map(([sektor, nilai]) => ({ ...common, sektor, nilai })),
    ...sectors.map(([sektor]) => ({
      ...common,
      sektor,
      kode: 'K2',
      nilai: additionalCodeValues.get(sektor)
    })),
    { ...common, sektor: 'ROW', nilai: 5000 },
    { ...common, sektor: 'TOTAL EKN', nilai: 88 },
    { ...common, sektor: 'TOTAL EKN', tahun: 2024, nilai: 99 },
    { ...common, sektor: 'TOTAL EKN', sisi: 'SUMBER', nilai: 100 },
    { ...common, sektor: 'TOTAL EKN', jenisNeraca: 'Neraca B', nilai: 101 },
    { ...common, sektor: 'TOTAL EKN', kode: 'K2', nilai: 102 },
    { ...common, sektor: 'TOTAL EKN', rincian: 'Rincian B', nilai: 103 }
  ]

  const summary = mapper.generateTahunanSummary(rows, {
    tahun: '2025',
    sisi: 'PENGGUNAAN',
    neraca: 'Neraca A',
    klasifikasi: 'Rincian A'
  })

  assert.equal(summary.totalNilai, 190)
  assert.equal(summary.jumlahBaris, 10)
  assert.equal(
    summary.institusi.reduce((sum, item) => sum + item.nilai, 0),
    115
  )

  const quarterlySummary = mapper.generateTriwulananSummary(
    rows.map(row => ({
      ...row,
      triwulan: 1,
      periode: '2025/Q1'
    })),
    {
      tahun: '2025',
      triwulan: '1',
      sisi: 'PENGGUNAAN',
      neraca: 'Neraca A',
      klasifikasi: 'Rincian A'
    }
  )

  assert.equal(quarterlySummary.totalNilai, 190)
  assert.equal(quarterlySummary.jumlahBaris, 10)
  assert.equal(
    quarterlySummary.institusi.reduce((sum, item) => sum + item.nilai, 0),
    115
  )
})

test('keeps reported historical years available through annual and quarterly sector filters', () => {
  const years = [2016, 2017, 2018, 2019, 2020, 2021, 2023]
  const annual = mapper.mapTahunanData(
    years.flatMap(year => [
      createRow('FC', '10', String(year)),
      createRow('TOTAL EKN', '100', String(year)),
      createRow('ROW', '5', String(year))
    ])
  )
  const quarterly = mapper.mapTriwulananData(
    years.flatMap(year => [
      createRow('FC', '10', `${year}/Q1`),
      createRow('TOTAL EKN', '100', `${year}/Q1`),
      createRow('ROW', '5', `${year}/Q1`)
    ])
  )

  assert.deepEqual(
    mapper.generateTahunanFilters(annual).tahun,
    years
  )
  assert.deepEqual(
    mapper.generateTriwulananFilters(quarterly).tahun,
    years
  )

  for (const year of years) {
    const annualRows = mapper.filterTahunanData(annual, {
      tahun: String(year),
      institusi: 'FC'
    })
    const quarterlyRows = mapper.filterTriwulananData(quarterly, {
      tahun: String(year),
      triwulan: '1',
      institusi: 'FC'
    })

    assert.deepEqual(annualRows.map(item => [item.tahun, item.sektor]), [[year, 'FC']])
    assert.deepEqual(quarterlyRows.map(item => [item.tahun, item.triwulan, item.sektor]), [[year, 1, 'FC']])
  }
})

test('returns distinct metadata only for rows matching dashboard filters', () => {
  const annualRows = mapper.mapTahunanData([
    {
      ...createRow('FC', '5', '2024', 'K1'),
      KONSEP: 'Konsep A'
    },
    {
      ...createRow('FC 2', '6', '2024', 'K1'),
      KONSEP: 'Konsep B'
    },
    {
      ...createRow('FC', '7', '2023', 'K2'),
      KONSEP: 'Konsep tahun lalu'
    },
    {
      ...createRow('GG', '8', '2024', 'K3'),
      KONSEP: 'Konsep sektor lain'
    }
  ])

  assert.deepEqual(
    mapper.generateTahunanSummary(
      annualRows,
      { tahun: '2024', institusi: 'FC' }
    ).metadata,
    {
      konsep: [],
      jumlahKonsep: 2,
      periode: ['2024'],
      sektor: ['FC'],
      rincian: ['PENGGUNAAN']
    }
  )

  const quarterlyRows = mapper.mapTriwulananData([
    {
      ...createRow('FC', '5', '2024/Q3', 'K1'),
      KONSEP: 'Konsep triwulan terpilih'
    },
    {
      ...createRow('FC', '6', '2024/Q2', 'K1'),
      KONSEP: 'Konsep triwulan lain'
    },
    {
      ...createRow('GG', '7', '2024/Q3', 'K1'),
      KONSEP: 'Konsep sektor lain'
    }
  ])

  assert.deepEqual(
    mapper.generateTriwulananSummary(
      quarterlyRows,
      { tahun: '2024', triwulan: '3', institusi: 'FC' }
    ).metadata,
    {
      konsep: ['Konsep triwulan terpilih'],
      jumlahKonsep: 1,
      periode: ['2024/Q3'],
      sektor: ['FC'],
      rincian: ['PENGGUNAAN']
    }
  )
})

test('preserves source order and first occurrence in filter options', () => {
  const annualRows = [
    {
      sektor: 'HH',
      institusi: 'Rumah Tangga',
      tahun: 2024,
      sisi: 'SUMBER',
      jenisNeraca: 'Z Neraca',
      rincian: 'Z Rincian'
    },
    {
      sektor: 'FC',
      institusi: 'Korporasi Finansial',
      tahun: 2023,
      sisi: 'PENGGUNAAN',
      jenisNeraca: 'A Neraca',
      rincian: 'A Rincian'
    },
    {
      sektor: 'HH',
      institusi: 'Rumah Tangga',
      tahun: 2024,
      sisi: 'SUMBER',
      jenisNeraca: 'Z Neraca',
      rincian: 'Z Rincian'
    }
  ]

  const annualFilters =
    mapper.generateTahunanFilters(
      annualRows,
      {}
    )

  assert.deepEqual(annualFilters, {
    tahun: [2024, 2023],
    sisi: ['SUMBER', 'PENGGUNAAN'],
    neraca: ['Z Neraca', 'A Neraca'],
    klasifikasi: ['Z Rincian', 'A Rincian'],
    institusi: [
      { kode: 'HH', nama: 'Rumah Tangga' },
      { kode: 'FC', nama: 'Korporasi Finansial' }
    ]
  })

  const quarterlyRows = annualRows.map((item, index) => ({
    ...item,
    tahun: index === 1 ? 2023 : 2024,
    triwulan: index === 1 ? 1 : 2
  }))

  assert.deepEqual(
    mapper.generateTriwulananFilters(
      quarterlyRows,
      {}
    ),
    {
      tahun: [2024, 2023],
      triwulan: [
        { value: 2, label: 'Q2' },
        { value: 1, label: 'Q1' }
      ],
      sisi: ['SUMBER', 'PENGGUNAAN'],
      neraca: ['Z Neraca', 'A Neraca'],
      klasifikasi: ['Z Rincian', 'A Rincian'],
      institusi: [
        { kode: 'HH', nama: 'Rumah Tangga' },
        { kode: 'FC', nama: 'Korporasi Finansial' }
      ]
    }
  )
})

test('summary keeps each sector and classification as a separate ranking entry', () => {
  const rows = [
    { sektor: 'NFC', institusi: 'Korporasi Nonfinansial', rincian: 'Klasifikasi A', nilai: 5 },
    { sektor: 'NFC', institusi: 'Korporasi Nonfinansial', rincian: 'Klasifikasi A', nilai: 3 },
    { sektor: 'NFC', institusi: 'Korporasi Nonfinansial', rincian: 'Klasifikasi B', nilai: 7 },
    { sektor: 'FC', institusi: 'Korporasi Finansial', rincian: 'Klasifikasi A', nilai: 10 },
    { sektor: 'GG', institusi: 'Pemerintah Umum', rincian: 'Klasifikasi B', nilai: -2 },
    { sektor: 'ROW', institusi: 'Luar Negeri', rincian: 'Klasifikasi A', nilai: 1000 }
  ]

  const summary = mapper.generateTahunanSummary(rows, {})

  assert.deepEqual(summary.sektorKlasifikasi, [
    { kode: 'FC', nama: 'Korporasi Finansial', klasifikasi: 'Klasifikasi A', nilai: 10 },
    { kode: 'GG', nama: 'Pemerintah Umum', klasifikasi: 'Klasifikasi B', nilai: -2 },
    { kode: 'NFC', nama: 'Korporasi Nonfinansial', klasifikasi: 'Klasifikasi A', nilai: 8 },
    { kode: 'NFC', nama: 'Korporasi Nonfinansial', klasifikasi: 'Klasifikasi B', nilai: 7 }
  ])
})