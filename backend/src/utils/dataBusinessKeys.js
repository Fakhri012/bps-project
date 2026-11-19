'use strict'

function normalizeBusinessKeyText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function getSectorBusinessKey(row) {
  if (row.sector_id !== null && row.sector_id !== undefined) {
    return `id:${row.sector_id}`
  }

  return `code:${normalizeBusinessKeyText(row.source_sector_code || row.sektor)}`
}

function getCharacteristicBusinessKey(datasetKey, row) {
  return [
    'characteristic',
    datasetKey,
    getSectorBusinessKey(row),
    Number(row.year),
    row.quarter === null || row.quarter === undefined ? null : Number(row.quarter),
    normalizeBusinessKeyText(row.sisi),
    normalizeBusinessKeyText(row.jenis_neraca),
    normalizeBusinessKeyText(row.kode),
    normalizeBusinessKeyText(row.rincian),
    normalizeBusinessKeyText(row.neraca_rincian)
  ]
}

function getRatioBusinessKey(row) {
  return [
    'ratio',
    getSectorBusinessKey(row),
    Number(row.year),
    row.quarter === null || row.quarter === undefined ? null : Number(row.quarter),
    normalizeBusinessKeyText(row.jenis_rasio),
    normalizeBusinessKeyText(row.kode),
    normalizeBusinessKeyText(row.rincian)
  ]
}

function getDataBusinessKey(datasetKey, row) {
  if (['tahunan', 'triwulanan_1', 'triwulanan_2'].includes(datasetKey)) {
    return getCharacteristicBusinessKey(datasetKey, row)
  }

  if (datasetKey === 'analisis_rasio') {
    return getRatioBusinessKey(row)
  }

  return ['macro', normalizeBusinessKeyText(row.period)]
}

module.exports = {
  getDataBusinessKey,
  normalizeBusinessKeyText
}