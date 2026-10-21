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
      ]
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
      ]
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
    ]
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
    institusi: []
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