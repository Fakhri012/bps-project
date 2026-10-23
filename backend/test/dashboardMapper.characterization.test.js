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
      totalNilai: 4959.12,
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

test('merges quarterly sector suffixes and preserves filtered summary output', () => {
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
      totalNilai: 3257.5,
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
    { sektor: 'ROW', institusi: 'Abroad', nilai: 0, tahun: 2023, triwulan: 1 },
    { sektor: 'HH', institusi: 'Household', nilai: -4, tahun: 2023, triwulan: 1 },
    { sektor: 'NFC PRIVATE', institusi: 'Private', nilai: 99, tahun: 2023, triwulan: 1 }
  ]

  const expected = {
    jumlahBaris: 8,
    totalNilai: -4,
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
        kode: 'ROW',
        nama: 'Abroad',
        nilai: 0
      },
      {
        kode: 'HH',
        nama: 'Household',
        nilai: -4
      }
    ],
    metadata: {
      konsep: [],
      jumlahKonsep: 0,
      periode: ['2023'],
      sektor: ['FC', 'GG', 'HH', 'ROW'],
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
    totalNilai: 0,
    kontributorTerbesar: null,
    institusi: [],
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