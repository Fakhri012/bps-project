'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  addSectorToIdentityIndex,
  addSectorPreviewRecord,
  createSectorIdentityIndex,
  createSectorPreviewSummary,
  finalizeSectorPreviewSummary,
  normalizeSectorIdentity,
  normalizeSectorLabel,
  resolveSectorIdentity
} = require('../src/utils/sectorIdentity')

test('sector identity normalization collapses whitespace and case without fuzzy matching', () => {
  assert.equal(normalizeSectorIdentity('  NFC\u00a0 PRIVATE   2 '), 'NFC PRIVATE 2')
  assert.equal(normalizeSectorLabel('  Nfc   Private 2 '), 'Nfc Private 2')
  const index = createSectorIdentityIndex([{ id: 1, code: 'NFC PRIVATE' }])
  assert.equal(resolveSectorIdentity(index, 'NFC PRIVATE 2').status, 'new_sector_candidate')
})

test('sector identity resolves exact canonical codes, names, and legacy aliases', () => {
  const index = createSectorIdentityIndex([
    { id: 1, code: 'CB', name: 'Central Bank', source_code: 'CB 2' }
  ])

  assert.equal(resolveSectorIdentity(index, ' cb ').sector_id, 1)
  assert.equal(resolveSectorIdentity(index, 'central bank').sector_id, 1)
  assert.equal(resolveSectorIdentity(index, 'CB 2').sector_id, 1)
})

test('official Indonesian and English names resolve to their exact existing master codes', () => {
  const index = createSectorIdentityIndex([
    { id: 1, code: 'FC', name: 'FC' },
    { id: 2, code: 'NFC', name: 'NFC' },
    { id: 3, code: 'NPISHS', name: 'NPISHS' },
    { id: 4, code: 'ROW', name: 'ROW' },
    { id: 5, code: 'GG', name: 'GG' },
    { id: 6, code: 'HH', name: 'HH' },
    { id: 7, code: 'TOTAL', name: 'TOTAL' },
    { id: 8, code: 'TOTAL EKN', name: 'TOTAL EKN' },
    { id: 9, code: 'NFC PRIVATE', name: 'NFC PRIVATE' },
    { id: 10, code: 'NFC PUBLIC', name: 'NFC PUBLIC' }
  ])
  const cases = [
    ['KORPORASI FINANSIAL (FINANCIAL CORPORATIONS)', 1],
    ['KORPORASI NONFINANSIAL (NONFINANCIAL CORPORATIONS)', 2],
    ['LEMBAGA NON PROFIT YANG MELAYANI RUMAH TANGGA (NONPROFIT INSTITUTIONS SERVING HOUSEHOLDS)', 3],
    ['LUAR NEGERI (REST OF THE WORLD)', 4],
    ['PEMERINTAH UMUM (GENERAL GOVERNMENT)', 5],
    ['RUMAH TANGGA (HOUSEHOLDS)', 6],
    ['TOTAL', 7],
    ['TOTAL EKONOMI (TOTAL ECONOMY)', 8]
  ]

  for (const [officialName, expectedId] of cases) {
    assert.equal(resolveSectorIdentity(index, officialName).sector_id, expectedId)
  }
  assert.equal(resolveSectorIdentity(index, '  korporasi   nonfinansial (nonfinancial corporations) ').sector_id, 2)
  assert.equal(resolveSectorIdentity(index, 'NFC PRIVATE').sector_id, 9)
  assert.equal(resolveSectorIdentity(index, 'NFC PUBLIC').sector_id, 10)
})

test('official aliases deduplicate against an existing alias to the same sector', () => {
  const index = createSectorIdentityIndex([{
    id: 3,
    code: 'NPISHS',
    name: 'NPISHS',
    source_code: 'Lembaga Non Profit Yang Melayani Rumah Tangga (Nonprofit Institutions Serving Households)'
  }])

  const result = resolveSectorIdentity(index, 'LEMBAGA NON PROFIT YANG MELAYANI RUMAH TANGGA (NONPROFIT INSTITUTIONS SERVING HOUSEHOLDS)')
  assert.equal(result.status, 'existing')
  assert.equal(result.sector_id, 3)
})

test('official aliases block when their target master code is missing', () => {
  const index = createSectorIdentityIndex([{ id: 1, code: 'FC', name: 'FC' }])
  const result = resolveSectorIdentity(index, 'RUMAH TANGGA (HOUSEHOLDS)')

  assert.equal(result.status, 'conflict')
  assert.equal(result.official_code, 'HH')
})

test('sector identity reports ambiguous canonical or alias matches as conflicts', () => {
  const index = createSectorIdentityIndex([
    { id: 1, code: 'NFC', name: 'Nonfinancial Corporations' },
    { id: 2, code: 'OTHER', name: 'NFC', source_code: 'NFC' }
  ])

  const result = resolveSectorIdentity(index, ' nfc ')
  assert.equal(result.status, 'conflict')
  assert.deepEqual(result.sectors.map(sector => sector.id).sort(), [1, 2])
})

test('newly inserted sectors are immediately recognized by the same identity index', () => {
  const index = createSectorIdentityIndex()
  addSectorToIdentityIndex(index, { id: 4, code: 'NFC PRIVATE 2', name: 'NFC PRIVATE 2' })

  assert.equal(resolveSectorIdentity(index, 'nfc   private 2').sector_id, 4)
})

test('sector preview summary groups case and whitespace variants and retains candidate records', () => {
  const summary = createSectorPreviewSummary()
  addSectorPreviewRecord(summary, {
    source_sector_code: 'NFC PRIVATE 2',
    sector_status: 'new_sector_candidate',
    kode: 'P6',
    rincian: 'Investasi',
    nilai: '150000'
  })
  addSectorPreviewRecord(summary, {
    source_sector_code: 'nfc   private 2',
    sector_status: 'new_sector_candidate',
    kode: 'P7',
    rincian: 'Simpanan',
    nilai: '200000'
  })

  const result = finalizeSectorPreviewSummary(summary)
  assert.equal(result.new_sector_count, 1)
  assert.equal(result.new[0].record_count, 2)
  assert.deepEqual(result.new[0].records.map(record => record.kode), ['P6', 'P7'])
})