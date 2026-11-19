'use strict'

const OFFICIAL_SECTOR_ALIASES = new Map([
  ['KORPORASI FINANSIAL (FINANCIAL CORPORATIONS)', 'FC'],
  ['KORPORASI NONFINANSIAL (NONFINANCIAL CORPORATIONS)', 'NFC'],
  ['LEMBAGA NON PROFIT YANG MELAYANI RUMAH TANGGA (NONPROFIT INSTITUTIONS SERVING HOUSEHOLDS)', 'NPISHS'],
  ['LUAR NEGERI (REST OF THE WORLD)', 'ROW'],
  ['PEMERINTAH UMUM (GENERAL GOVERNMENT)', 'GG'],
  ['RUMAH TANGGA (HOUSEHOLDS)', 'HH'],
  ['TOTAL', 'TOTAL'],
  ['TOTAL EKONOMI (TOTAL ECONOMY)', 'TOTAL EKN']
])

function normalizeSectorIdentity(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function normalizeSectorLabel(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function addIdentity(index, value, sectorId) {
  const identity = normalizeSectorIdentity(value)
  if (!identity) return

  const ids = index.get(identity) || new Set()
  ids.add(Number(sectorId))
  index.set(identity, ids)
}

function createSectorIdentityIndex(rows = []) {
  const index = {
    sectors: new Map(),
    canonical: new Map(),
    aliases: new Map()
  }

  for (const row of rows) {
    const sectorId = Number(row.id ?? row.sector_id)
    if (!Number.isSafeInteger(sectorId) || sectorId <= 0) continue

    const sector = index.sectors.get(sectorId) || {
      id: sectorId,
      code: row.code ?? row.canonical_code ?? null,
      name: row.name ?? null
    }
    index.sectors.set(sectorId, sector)
    addIdentity(index.canonical, row.code ?? row.canonical_code, sectorId)
    addIdentity(index.canonical, row.name, sectorId)
    addIdentity(index.aliases, row.source_code, sectorId)
  }

  return index
}

function addSectorToIdentityIndex(index, sector) {
  const sectorId = Number(sector.id)
  index.sectors.set(sectorId, {
    id: sectorId,
    code: sector.code,
    name: sector.name
  })
  addIdentity(index.canonical, sector.code, sectorId)
  addIdentity(index.canonical, sector.name, sectorId)
}

function resolveSectorIdentity(index, value) {
  const identity = normalizeSectorIdentity(value)
  const matches = new Set([
    ...(index.canonical.get(identity) || []),
    ...(index.aliases.get(identity) || [])
  ])
  const officialCode = OFFICIAL_SECTOR_ALIASES.get(identity)
  if (officialCode) {
    const targetIds = index.canonical.get(normalizeSectorIdentity(officialCode)) || new Set()
    if (targetIds.size === 0) {
      return { status: 'conflict', identity, official_code: officialCode, sectors: [] }
    }
    for (const sectorId of targetIds) matches.add(sectorId)
  }

  if (matches.size === 0) {
    return { status: 'new_sector_candidate', identity }
  }

  if (matches.size > 1) {
    return {
      status: 'conflict',
      identity,
      sectors: [...matches].map(id => index.sectors.get(id)).filter(Boolean)
    }
  }

  const sectorId = [...matches][0]
  return {
    status: 'existing',
    identity,
    sector_id: sectorId,
    sector: index.sectors.get(sectorId)
  }
}

function createSectorPreviewSummary() {
  return {
    existing: new Map(),
    new: new Map(),
    conflicts: new Map()
  }
}

function addSectorPreviewRecord(summary, row) {
  const identity = normalizeSectorIdentity(row.source_sector_code)
  if (!identity) return

  const status = row.sector_status || (row.new_sector_candidate ? 'new_sector_candidate' : 'existing')
  const groupName = status === 'new_sector_candidate'
    ? 'new'
    : status === 'conflict' ? 'conflicts' : 'existing'
  const groups = summary[groupName]
  const group = groups.get(identity) || {
    sector_code: normalizeSectorLabel(row.source_sector_code),
    status,
    record_count: 0,
    records: [],
    conflicts_with: row.sector_conflicts || []
  }

  group.record_count++
  if (groupName === 'new') {
    group.records.push({
      sisi: row.sisi ?? null,
      jenis_neraca: row.jenis_neraca ?? null,
      jenis_rasio: row.jenis_rasio ?? null,
      kode: row.kode ?? null,
      rincian: row.rincian ?? null,
      nilai: row.nilai ?? null,
      nilai_raw: row.nilai_raw ?? null
    })
  }
  groups.set(identity, group)
}

function finalizeSectorPreviewSummary(summary) {
  const existing = [...summary.existing.values()]
  const newSectors = [...summary.new.values()]
  const conflicts = [...summary.conflicts.values()]
  return {
    existing,
    new: newSectors,
    conflicts,
    new_sector_count: newSectors.length,
    conflict_count: conflicts.length
  }
}

module.exports = {
  addSectorToIdentityIndex,
  addSectorPreviewRecord,
  createSectorIdentityIndex,
  createSectorPreviewSummary,
  finalizeSectorPreviewSummary,
  OFFICIAL_SECTOR_ALIASES,
  normalizeSectorIdentity,
  normalizeSectorLabel,
  resolveSectorIdentity
}