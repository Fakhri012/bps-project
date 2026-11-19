const crypto = require('crypto')
const pool = require('../config/postgres')
const {
  refreshDashboardCacheAfterDataChange
} = require('../../services/dashboardCacheService')
const { getDataBusinessKey, normalizeBusinessKeyText } = require('../utils/dataBusinessKeys')
const {
  addSectorToIdentityIndex,
  addSectorPreviewRecord,
  createSectorIdentityIndex,
  createSectorPreviewSummary,
  finalizeSectorPreviewSummary,
  normalizeSectorIdentity,
  normalizeSectorLabel,
  resolveSectorIdentity
} = require('../utils/sectorIdentity')

const datasetLabels = {
  tahunan: 'Karakteristik Tahunan',
  triwulanan_1: 'Karakteristik Triwulanan 1',
  triwulanan_2: 'Karakteristik Triwulanan 2',
  analisis_rasio: 'Analisis Rasio',
  banding_makro: 'Banding Makro'
}

const batchStatuses = new Set([
  'uploaded',
  'previewed',
  'processing',
  'confirmed',
  'cancelled',
  'failed',
  'expired'
])

const versionStatuses = new Set([
  'active',
  'superseded',
  'deleted'
])

function parseId(value) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function parsePage(value, fallback = 1) {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : fallback
}

function parseLimit(value, fallback = 25) {
  const limit = Number(value)
  return Number.isInteger(limit) && limit > 0
    ? Math.min(limit, 100)
    : fallback
}

function sendError(res, error, context, fallbackMessage) {
  if (error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message
    })
  }

  console.error(`${context}:`, error)
  return res.status(500).json({
    success: false,
    message: fallbackMessage
  })
}

function validationError(status, message) {
  return Object.assign(new Error(message), { status })
}

async function refreshDashboardAfterCommit() {
  try {
    const result = await refreshDashboardCacheAfterDataChange()
    return {
      status: 'refreshed',
      refreshed_at: result.refreshedAt,
      totals: result.total
    }
  } catch (error) {
    console.error('Perubahan tersimpan, refresh cache gagal:', error)
    return { status: 'pending' }
  }
}

function sendRefreshResult(res, operation, refresh, data) {
  const refreshPending = refresh.status === 'pending'
  return res.status(refreshPending ? 202 : 200).json({
    success: true,
    message: refreshPending
      ? `${operation} tersimpan. Refresh cache dashboard perlu diulang.`
      : `${operation} berhasil.`,
    data: {
      ...data,
      dashboard_refresh: refresh
    }
  })
}

async function getManagementSummary(req, res) {
  try {
    const result = await pool.query(`
      WITH dataset_keys AS (
        SELECT dataset_key FROM data_period_versions
        UNION
        SELECT dataset_key FROM data_import_batches
      ), version_stats AS (
        SELECT
          dataset_key,
          COUNT(*)::INTEGER AS total_versions,
          COUNT(*) FILTER (WHERE status = 'active')::INTEGER AS active_periods,
          MAX(activated_at) AS last_activated_at
        FROM data_period_versions
        GROUP BY dataset_key
      ), batch_stats AS (
        SELECT
          dataset_key,
          COUNT(*)::INTEGER AS total_batches,
          COUNT(*) FILTER (WHERE status = 'confirmed')::INTEGER AS confirmed_batches,
          COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER AS rejected_batches,
          COUNT(*) FILTER (WHERE status = 'failed')::INTEGER AS failed_batches,
          COUNT(*) FILTER (
            WHERE status IN ('uploaded', 'previewed', 'processing')
          )::INTEGER AS pending_batches,
          MAX(created_at) AS last_batch_at
        FROM data_import_batches
        GROUP BY dataset_key
      )
      SELECT
        keys.dataset_key,
        COALESCE(versions.total_versions, 0) AS total_versions,
        COALESCE(versions.active_periods, 0) AS active_periods,
        COALESCE(batches.total_batches, 0) AS total_batches,
        COALESCE(batches.confirmed_batches, 0) AS confirmed_batches,
        COALESCE(batches.rejected_batches, 0) AS rejected_batches,
        COALESCE(batches.failed_batches, 0) AS failed_batches,
        COALESCE(batches.pending_batches, 0) AS pending_batches,
        latest.period_type AS latest_period_type,
        latest.year AS latest_year,
        latest.quarter AS latest_quarter,
        latest.version_number AS latest_version_number,
        latest.activated_at AS latest_activated_at,
        GREATEST(versions.last_activated_at, batches.last_batch_at) AS updated_at
      FROM dataset_keys keys
      LEFT JOIN version_stats versions USING (dataset_key)
      LEFT JOIN batch_stats batches USING (dataset_key)
      LEFT JOIN LATERAL (
        SELECT period_type, year, quarter, version_number, activated_at
        FROM data_period_versions
        WHERE dataset_key = keys.dataset_key
          AND status = 'active'
        ORDER BY year DESC, quarter DESC NULLS LAST, activated_at DESC NULLS LAST
        LIMIT 1
      ) latest ON TRUE
      ORDER BY keys.dataset_key
    `)

    const datasets = result.rows.map(row => ({
      ...row,
      label: datasetLabels[row.dataset_key] || row.dataset_key,
      latest_period: row.latest_year === null
        ? null
        : row.latest_period_type === 'quarterly'
          ? `${row.latest_year}/Q${row.latest_quarter}`
          : String(row.latest_year),
      import_available: ['tahunan', 'triwulanan_1', 'triwulanan_2', 'analisis_rasio'].includes(row.dataset_key)
    }))

    const totals = datasets.reduce((summary, dataset) => {
      summary.datasets++
      summary.active_periods += Number(dataset.active_periods)
      summary.versions += Number(dataset.total_versions)
      summary.imports += Number(dataset.total_batches)
      summary.imported += Number(dataset.confirmed_batches)
      summary.rejected += Number(dataset.rejected_batches)
      summary.failed += Number(dataset.failed_batches)
      summary.pending_confirmation += Number(dataset.pending_batches)
      if (dataset.updated_at && (!summary.updated_at || dataset.updated_at > summary.updated_at)) {
        summary.updated_at = dataset.updated_at
      }
      return summary
    }, {
      datasets: 0,
      active_periods: 0,
      versions: 0,
      imports: 0,
      imported: 0,
      rejected: 0,
      failed: 0,
      pending_confirmation: 0,
      updated_at: null
    })

    return res.json({
      success: true,
      message: 'Ringkasan manajemen data berhasil diambil.',
      data: {
        totals,
        datasets,
        import_capabilities: [
          { dataset_key: 'tahunan', period_type: 'annual', available: true },
          { dataset_key: 'triwulanan_1', period_type: 'quarterly', available: true },
          { dataset_key: 'triwulanan_2', period_type: 'quarterly', available: true },
          { dataset_key: 'analisis_rasio', period_type: 'annual', available: true },
          { dataset_key: 'analisis_rasio', period_type: 'quarterly', available: true },
          { dataset_key: 'banding_makro', period_type: 'annual', available: false }
        ]
      }
    })
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil ringkasan manajemen data', 'Gagal mengambil ringkasan manajemen data.')
  }
}

async function listImportBatches(req, res) {
  const page = parsePage(req.query.page)
  const limit = parseLimit(req.query.limit)
  const datasetKey = String(req.query.dataset_key || '').trim() || null
  const status = String(req.query.status || '').trim() || null
  const search = String(req.query.search || '').trim().slice(0, 120) || null
  const year = req.query.year === undefined || req.query.year === ''
    ? null
    : Number(req.query.year)

  if (status && !batchStatuses.has(status)) {
    return res.status(400).json({ success: false, message: 'Status batch tidak valid.' })
  }
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2200)) {
    return res.status(400).json({ success: false, message: 'Tahun tidak valid.' })
  }

  try {
    const filters = [datasetKey, status, year, search]
    const [countResult, rowsResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM data_import_batches
        WHERE ($1::VARCHAR IS NULL OR dataset_key = $1)
          AND ($2::VARCHAR IS NULL OR status = $2)
          AND ($3::SMALLINT IS NULL OR year = $3)
          AND ($4::TEXT IS NULL OR CONCAT_WS(' ', dataset_key, original_filename, notes, error_message, year::TEXT) ILIKE '%' || $4 || '%')
      `, filters),
      pool.query(`
        SELECT
          id, workbook_group_id, dataset_key, period_type, year, quarter, action_type, status,
          original_filename, file_size_bytes, total_rows, valid_rows, invalid_rows,
          notes, error_message, created_at, confirmed_at, finished_at,
          preview_expires_at
        FROM data_import_batches
        WHERE ($1::VARCHAR IS NULL OR dataset_key = $1)
          AND ($2::VARCHAR IS NULL OR status = $2)
          AND ($3::SMALLINT IS NULL OR year = $3)
          AND ($4::TEXT IS NULL OR CONCAT_WS(' ', dataset_key, original_filename, notes, error_message, year::TEXT) ILIKE '%' || $4 || '%')
        ORDER BY created_at DESC, id DESC
        LIMIT $5 OFFSET $6
      `, [...filters, limit, (page - 1) * limit])
    ])

    const total = countResult.rows[0].total
    return res.json({
      success: true,
      message: 'Riwayat import berhasil diambil.',
      data: rowsResult.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil riwayat import', 'Gagal mengambil riwayat import.')
  }
}

async function getImportBatchDetail(req, res) {
  const batchId = parseId(req.params.batchId)
  if (!batchId) {
    return res.status(400).json({ success: false, message: 'Batch ID tidak valid.' })
  }

  const page = parsePage(req.query.page)
  const limit = parseLimit(req.query.limit)
  const status = String(req.query.validation_status || '').trim() || null
  const search = String(req.query.search || '').trim() || null
  const allowedStatuses = new Set(['pending', 'valid', 'invalid', 'warning'])

  if (status && !allowedStatuses.has(status)) {
    return res.status(400).json({ success: false, message: 'Status validasi tidak valid.' })
  }

  try {
    const batchResult = await pool.query(`
      SELECT
        id, workbook_group_id, dataset_key, period_type, year, quarter, action_type, status,
        original_filename, file_size_bytes, total_rows, valid_rows, invalid_rows,
        notes, error_message, created_at, confirmed_at, finished_at, preview_expires_at
      FROM data_import_batches
      WHERE id = $1
    `, [batchId])

    if (batchResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Batch tidak ditemukan.' })
    }

    const versionResult = await pool.query(`
      SELECT id, dataset_key, period_type, year, quarter, version_number,
             status, import_batch_id, row_count, change_reason
      FROM data_period_versions
      WHERE import_batch_id = $1
      ORDER BY version_number DESC
      LIMIT 1
    `, [batchId])

    const filters = [batchId, status, search]
    const [countResult, rowsResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM staging_excel_rows
        WHERE batch_id = $1
          AND ($2::VARCHAR IS NULL OR validation_status = $2)
          AND ($3::TEXT IS NULL OR raw_data::TEXT ILIKE '%' || $3 || '%')
      `, filters),
      pool.query(`
        SELECT id, worksheet_name, source_row_number, raw_data,
               normalized_data, validation_status, validation_errors, created_at
        FROM staging_excel_rows
        WHERE batch_id = $1
          AND ($2::VARCHAR IS NULL OR validation_status = $2)
          AND ($3::TEXT IS NULL OR raw_data::TEXT ILIKE '%' || $3 || '%')
        ORDER BY source_row_number
        LIMIT $4 OFFSET $5
      `, [...filters, limit, (page - 1) * limit])
    ])

    const total = countResult.rows[0].total
    const statusResult = await pool.query(`
      SELECT validation_status, COUNT(*)::INTEGER AS total
      FROM staging_excel_rows
      WHERE batch_id = $1
      GROUP BY validation_status
    `, [batchId])
    const sectorRowsResult = await pool.query(`
      SELECT
        normalized_data->>'source_sector_code' AS source_sector_code,
        normalized_data->>'sector_status' AS sector_status,
        normalized_data->>'new_sector_candidate' AS new_sector_candidate,
        normalized_data->'sector_conflicts' AS sector_conflicts,
        normalized_data->>'sisi' AS sisi,
        normalized_data->>'jenis_neraca' AS jenis_neraca,
        normalized_data->>'jenis_rasio' AS jenis_rasio,
        normalized_data->>'kode' AS kode,
        normalized_data->>'rincian' AS rincian,
        normalized_data->>'nilai' AS nilai,
        normalized_data->>'nilai_raw' AS nilai_raw
      FROM staging_excel_rows
      WHERE batch_id = $1
        AND normalized_data IS NOT NULL
      ORDER BY source_row_number
    `, [batchId])
    const sectorSummary = createSectorPreviewSummary()
    for (const row of sectorRowsResult.rows) {
      addSectorPreviewRecord(sectorSummary, row)
    }

    let comparison = null
    const batch = batchResult.rows[0]
    if (batch.status === 'previewed') {
      const previewEventResult = await pool.query(`
        SELECT event_data
        FROM data_change_events
        WHERE batch_id = $1
          AND event_type = 'import_previewed'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `, [batchId])
      const eventData = previewEventResult.rows[0]?.event_data
      if (eventData && Object.prototype.hasOwnProperty.call(eventData, 'base_version_id')) {
        const baseVersionId = eventData.base_version_id === null
          ? null
          : Number(eventData.base_version_id)
        const [previousVersionResult, currentRowsResult] = await Promise.all([
          baseVersionId === null
            ? Promise.resolve({ rows: [] })
            : pool.query(`
                SELECT id, version_number
                FROM data_period_versions
                WHERE id = $1
              `, [baseVersionId]),
          pool.query(`
            SELECT normalized_data
            FROM staging_excel_rows
            WHERE batch_id = $1
              AND validation_status IN ('valid', 'warning')
            ORDER BY source_row_number
          `, [batchId])
        ])
        const previousVersion = previousVersionResult.rows[0] || null
        const previousRowsResult = previousVersion
          ? await pool.query(versionRowsQuery(batch.dataset_key), [previousVersion.id])
          : { rows: [] }
        const diff = compareVersionRows(
          batch.dataset_key,
          previousRowsResult.rows,
          currentRowsResult.rows.map(row => row.normalized_data)
        )
        comparison = paginateComparison(
          diff,
          parsePage(req.query.comparison_page),
          parseLimit(req.query.comparison_limit, 25),
          previousVersion?.version_number ?? null,
          'Usulan'
        )
      }
    }

    return res.json({
      success: true,
      message: 'Detail batch berhasil diambil.',
      data: {
        batch: batchResult.rows[0],
        version: versionResult.rows[0] || null,
        import_mode: 'replace_period',
        comparison,
        validation_counts: Object.fromEntries(
          statusResult.rows.map(row => [row.validation_status, row.total])
        ),
        sector_summary: finalizeSectorPreviewSummary(sectorSummary),
        rows: rowsResult.rows,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
      }
    })
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil detail batch', 'Gagal mengambil detail batch.')
  }
}

async function cancelImportBatch(req, res) {
  const batchId = parseId(req.params.batchId)
  if (!batchId) {
    return res.status(400).json({ success: false, message: 'Batch ID tidak valid.' })
  }
  const reason = String(req.body?.reason || '').trim().slice(0, 1000)
  if (!reason) {
    return res.status(400).json({ success: false, message: 'Alasan penolakan atau pembatalan wajib diisi.' })
  }

  let client
  let transactionStarted = false
  try {
    client = await pool.connect()
    await client.query('BEGIN')
    transactionStarted = true

    const batchResult = await client.query(`
      SELECT id, dataset_key, period_type, year, quarter, status
      FROM data_import_batches
      WHERE id = $1
      FOR UPDATE
    `, [batchId])
    if (batchResult.rowCount === 0) throw validationError(404, 'Batch tidak ditemukan.')

    const batch = batchResult.rows[0]
    if (!['previewed', 'expired', 'failed'].includes(batch.status)) {
      throw validationError(409, 'Hanya preview yang belum dikonfirmasi yang dapat dihapus.')
    }

    const versionResult = await client.query(`
      SELECT id
      FROM data_period_versions
      WHERE import_batch_id = $1
      FOR UPDATE
    `, [batchId])
    if (versionResult.rowCount > 0) {
      throw validationError(409, 'Batch ini sudah memiliki versi data. Hapus versi melalui Riwayat Versi.')
    }

    const removedRows = await client.query(
      'DELETE FROM staging_excel_rows WHERE batch_id = $1',
      [batchId]
    )
    await client.query(`
      UPDATE data_import_batches
      SET status = 'cancelled', preview_token_hash = NULL,
          preview_expires_at = NULL, finished_at = NOW(), notes = $2
      WHERE id = $1
    `, [batchId, reason])

    await client.query(`
      INSERT INTO data_change_events (
        event_type, dataset_key, period_type, year, quarter,
        batch_id, reason, event_data
      )
      VALUES (
        'import_cancelled', $1, $2, $3, $4, $5, $6,
        jsonb_build_object('actor', 'local-user', 'removed_staging_rows', $7::INTEGER)
      )
    `, [
      batch.dataset_key,
      batch.period_type,
      batch.year,
      batch.quarter,
      batchId,
      reason,
      removedRows.rowCount
    ])

    await client.query('COMMIT')
    transactionStarted = false
    client.release()
    client = null

    return res.json({
      success: true,
      message: 'Preview import dihapus dan batch ditandai dibatalkan.',
      data: { batch_id: batchId, status: 'cancelled', removed_rows: removedRows.rowCount }
    })
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        console.error('Pembatalan import rollback gagal:', rollbackError)
      }
    }
    return sendError(res, error, 'Gagal membatalkan import', 'Gagal membatalkan import.')
  } finally {
    if (client) client.release()
  }
}

function validatePreviewToken(token, storedHash) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return false
  if (typeof storedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(storedHash)) return false

  const supplied = crypto.createHash('sha256').update(token).digest()
  const stored = Buffer.from(storedHash, 'hex')
  return stored.length === supplied.length && crypto.timingSafeEqual(stored, supplied)
}

async function registerSectorsForBatch(client, batchId) {
  const sourceResult = await client.query(`
    SELECT DISTINCT normalized_data->>'source_sector_code' AS source_sector_code
    FROM staging_excel_rows
    WHERE batch_id = $1
      AND validation_status IN ('valid', 'warning')
      AND COALESCE(normalized_data->>'source_sector_code', '') <> ''
    ORDER BY source_sector_code
  `, [batchId])
  const sourceCodes = sourceResult.rows
    .map(row => row.source_sector_code)
    .filter(sourceCode => normalizeSectorIdentity(sourceCode))
  const identities = [...new Set(sourceCodes.map(normalizeSectorIdentity))].sort()

  for (const identity of identities) {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('sectors'), hashtext($1))",
      [identity]
    )
  }

  const sectorResult = await client.query(`
    SELECT s.id, s.code, s.name, a.source_code
    FROM sectors s
    LEFT JOIN sector_aliases a ON a.sector_id = s.id
    ORDER BY s.id
    FOR UPDATE OF s
  `)
  const sectorIndex = createSectorIdentityIndex(sectorResult.rows)
  const resolvedSectorIds = new Map()
  const createdSectors = []

  for (const sourceCode of sourceCodes) {
    const identity = normalizeSectorIdentity(sourceCode)
    let resolution = resolveSectorIdentity(sectorIndex, sourceCode)

    if (resolution.status === 'conflict') {
      throw validationError(
        409,
        `Identitas sektor "${sourceCode}" berubah atau berkonflik sejak preview. Periksa master sektor dan buat preview baru.`
      )
    }

    if (resolution.status === 'new_sector_candidate') {
      const code = identity
      const name = normalizeSectorLabel(sourceCode)
      if (code.length > 50 || name.length > 150) {
        throw validationError(409, `Sektor "${sourceCode}" melebihi panjang kolom master. Buat preview baru setelah memperbaiki nama sektor.`)
      }

      const insertResult = await client.query(`
        INSERT INTO sectors (code, name, sector_type)
        VALUES ($1, $2, 'sector')
        RETURNING id, code, name
      `, [code, name])
      const insertedSector = insertResult.rows[0]
      if (!insertedSector) {
        throw new Error(`Master sektor "${sourceCode}" tidak berhasil dibuat.`)
      }

      addSectorToIdentityIndex(sectorIndex, insertedSector)
      createdSectors.push(insertedSector)
      resolution = resolveSectorIdentity(sectorIndex, sourceCode)
    }

    resolvedSectorIds.set(sourceCode, resolution.sector_id)
  }

  for (const [sourceCode, sectorId] of resolvedSectorIds) {
    await client.query(`
      UPDATE staging_excel_rows
      SET normalized_data = jsonb_set(
        jsonb_set(
          jsonb_set(normalized_data, '{sector_id}', to_jsonb($3::BIGINT), true),
          '{new_sector_candidate}', 'false'::jsonb, true
        ),
        '{sector_status}', to_jsonb('existing'::TEXT), true
      )
      WHERE batch_id = $1
        AND normalized_data->>'source_sector_code' = $2
        AND validation_status IN ('valid', 'warning')
    `, [batchId, sourceCode, sectorId])
  }

  return createdSectors
}

async function confirmImportBatch(req, res) {
  const batchId = parseId(req.params.batchId)
  if (!batchId) {
    return res.status(400).json({ success: false, message: 'Batch ID tidak valid.' })
  }
  if (req.body?.confirm !== true) {
    return res.status(400).json({ success: false, message: 'Persetujuan eksplisit diperlukan.' })
  }

  const previewToken = req.body.preview_token
  let client
  let transactionStarted = false

  try {
    client = await pool.connect()
    await client.query('BEGIN')
    transactionStarted = true

    const batchResult = await client.query(`
      SELECT id, workbook_group_id, dataset_key, period_type, year, quarter, action_type, status,
             valid_rows, invalid_rows, total_rows, preview_token_hash,
             preview_expires_at
      FROM data_import_batches
      WHERE id = $1
      FOR UPDATE
    `, [batchId])

    if (batchResult.rowCount === 0) throw validationError(404, 'Batch tidak ditemukan.')
    const batch = batchResult.rows[0]
    if (batch.status !== 'previewed') {
      throw validationError(409, 'Batch tidak lagi menunggu konfirmasi.')
    }
    if (!batch.preview_expires_at || new Date(batch.preview_expires_at).getTime() <= Date.now()) {
      await client.query(`
        UPDATE data_import_batches
        SET status = 'expired', finished_at = NOW(), preview_token_hash = NULL
        WHERE id = $1
      `, [batchId])
      await client.query('COMMIT')
      transactionStarted = false
      throw validationError(410, 'Preview token sudah kedaluwarsa.')
    }
    if (!validatePreviewToken(previewToken, batch.preview_token_hash)) {
      throw validationError(403, 'Preview token tidak valid.')
    }
    const supportedExcelDatasets = new Set([
      'tahunan',
      'triwulanan_1',
      'triwulanan_2',
      'analisis_rasio'
    ])
    if (!supportedExcelDatasets.has(batch.dataset_key)) {
      throw validationError(400, 'Dataset ini belum didukung oleh konfirmasi import Excel.')
    }
    const expectedPeriodType = batch.quarter === null ? 'annual' : 'quarterly'
    if (batch.period_type !== expectedPeriodType ||
        (batch.dataset_key === 'tahunan' && expectedPeriodType !== 'annual') ||
        (batch.dataset_key.startsWith('triwulanan_') && expectedPeriodType !== 'quarterly') ||
        (expectedPeriodType === 'annual' && batch.quarter !== null) ||
        (expectedPeriodType === 'quarterly' && (!Number.isInteger(Number(batch.quarter)) || Number(batch.quarter) < 1 || Number(batch.quarter) > 4))) {
      throw validationError(409, 'Periode batch tidak konsisten dengan dataset.')
    }
    if (Number(batch.invalid_rows) > 0 || Number(batch.valid_rows) === 0) {
      throw validationError(409, 'Import hanya dapat dikonfirmasi jika terdapat data dan tidak ada baris invalid.')
    }

    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), $2::INTEGER)',
      [batch.dataset_key, Number(batch.year)]
    )

    const previewEventResult = await client.query(`
      SELECT event_data
      FROM data_change_events
      WHERE batch_id = $1
        AND event_type = 'import_previewed'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `, [batchId])
    if (previewEventResult.rowCount === 0) {
      throw validationError(409, 'Snapshot pembanding preview tidak tersedia. Buat preview baru.')
    }
    const previewBaseline = previewEventResult.rows[0].event_data || {}
    if (previewBaseline.import_mode !== 'replace_period') {
      throw validationError(409, 'Mode import pada preview tidak valid. Buat preview Replace Period baru.')
    }

    const stagedStatsResult = await client.query(`
      SELECT
        COUNT(*)::INTEGER AS total,
        COUNT(*) FILTER (WHERE validation_status = 'valid')::INTEGER AS valid,
        COUNT(*) FILTER (WHERE validation_status = 'warning')::INTEGER AS warning,
        COUNT(*) FILTER (WHERE validation_status = 'invalid')::INTEGER AS invalid,
        COUNT(*) FILTER (
          WHERE normalized_data IS NULL
             OR normalized_data->>'source_key' IS DISTINCT FROM $2
             OR normalized_data->>'period_type' IS DISTINCT FROM $3
             OR normalized_data->>'year' IS DISTINCT FROM $4
             OR normalized_data->>'quarter' IS DISTINCT FROM $5
             OR (
               normalized_data->>'sector_id' IS NULL
               AND normalized_data->>'new_sector_candidate' IS DISTINCT FROM 'true'
             )
             OR (
               normalized_data->>'sector_id' IS NOT NULL
               AND normalized_data->>'new_sector_candidate' = 'true'
             )
             OR COALESCE(normalized_data->>'sector_status', '') NOT IN ('existing', 'new_sector_candidate')
             OR normalized_data->'business_key' IS NULL
             OR COALESCE(normalized_data->>'value_status', '') NOT IN ('valid', 'empty', 'non_numeric', 'source_error', 'ambiguous')
        )::INTEGER AS malformed
      FROM staging_excel_rows
      WHERE batch_id = $1
    `, [
      batchId,
      batch.dataset_key,
      batch.period_type,
      String(batch.year),
      batch.quarter === null ? null : String(batch.quarter)
    ])
    const stagedStats = stagedStatsResult.rows[0]

    if (
      Number(stagedStats.total) !== Number(batch.total_rows) ||
      Number(stagedStats.invalid) > 0 ||
      Number(stagedStats.valid) + Number(stagedStats.warning) !== Number(stagedStats.total) ||
      Number(stagedStats.malformed) > 0
    ) {
      throw validationError(409, 'Data staging tidak lagi cocok dengan preview valid yang disetujui.')
    }

    const duplicateKeyResult = await client.query(`
      SELECT COUNT(*)::INTEGER AS duplicate_groups
      FROM (
        SELECT normalized_data->'business_key' AS business_key
        FROM staging_excel_rows
        WHERE batch_id = $1
          AND normalized_data IS NOT NULL
        GROUP BY normalized_data->'business_key'
        HAVING COUNT(*) > 1
      ) duplicate_keys
    `, [batchId])
    if (Number(duplicateKeyResult.rows[0].duplicate_groups) > 0) {
      throw validationError(409, 'Business key duplikat terdeteksi. Approval diblokir agar comparison tidak ambigu.')
    }

    const periodVersionsResult = await client.query(`
      SELECT id, version_number, status, activated_at
      FROM data_period_versions
      WHERE dataset_key = $1
        AND period_type = $2
        AND year = $3
        AND quarter IS NOT DISTINCT FROM $4
      ORDER BY version_number DESC
      FOR UPDATE
    `, [batch.dataset_key, batch.period_type, batch.year, batch.quarter])
    const periodVersions = periodVersionsResult.rows
    const activeVersion = periodVersions.find(version => version.status === 'active') || null
    const expectedActiveId = previewBaseline.base_version_id === null || previewBaseline.base_version_id === undefined
      ? null
      : Number(previewBaseline.base_version_id)
    const expectedActivatedAt = previewBaseline.base_version_activated_at
      ? new Date(previewBaseline.base_version_activated_at).getTime()
      : null
    const actualActivatedAt = activeVersion?.activated_at
      ? new Date(activeVersion.activated_at).getTime()
      : null
    if (
      (activeVersion ? Number(activeVersion.id) : null) !== expectedActiveId ||
      actualActivatedAt !== expectedActivatedAt
    ) {
      throw validationError(409, 'Versi aktif berubah setelah comparison dibuat. Muat ulang data dan buat preview baru.')
    }
    const createdSectors = await registerSectorsForBatch(client, batchId)
    const previousVersionId = activeVersion?.id ?? null
    const versionNumber = periodVersions.length > 0
      ? Number(periodVersions[0].version_number) + 1
      : 1
    const actionType = periodVersions.length > 0 ? 'revision' : 'new_period'

    if (activeVersion) {
      await client.query(`
        UPDATE data_period_versions
        SET status = 'superseded', deactivated_at = NOW()
        WHERE id = $1
      `, [activeVersion.id])
    }

    const versionResult = await client.query(`
      INSERT INTO data_period_versions (
        dataset_key, period_type, year, quarter, version_number, status,
        import_batch_id, previous_version_id, row_count, change_reason, activated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, NOW())
      RETURNING id, version_number
    `, [
      batch.dataset_key,
      batch.period_type,
      batch.year,
      batch.quarter,
      versionNumber,
      batchId,
      previousVersionId,
      stagedStats.total,
      String(req.body.reason || 'Excel import confirmed by local-user').slice(0, 1000)
    ])
    const version = versionResult.rows[0]

    const inserted = batch.dataset_key === 'analisis_rasio'
      ? await client.query(`
        INSERT INTO ratio_data (
          period_type, period, year, quarter, source_sector_code, sector_id,
          jenis_rasio, kode, rincian, nilai, staging_row_id,
          excel_staging_row_id, nilai_raw, value_status, period_version_id,
          source_order
        )
        SELECT
          normalized.period_type, normalized.period, normalized.year,
          normalized.quarter, normalized.source_sector_code,
          normalized.sector_id, normalized.jenis_rasio, normalized.kode,
          normalized.rincian, normalized.nilai, NULL, staging.id,
          normalized.nilai_raw, normalized.value_status, $2,
          staging.source_row_number
        FROM staging_excel_rows staging
        CROSS JOIN LATERAL jsonb_to_record(staging.normalized_data) AS normalized(
          period_type VARCHAR(20), period VARCHAR(20), year SMALLINT,
          quarter SMALLINT, source_sector_code VARCHAR(80), sector_id BIGINT,
          jenis_rasio TEXT, kode VARCHAR(100), rincian TEXT,
          nilai NUMERIC(38,18), nilai_raw TEXT, value_status VARCHAR(30)
        )
        WHERE staging.batch_id = $1
          AND staging.validation_status IN ('valid', 'warning')
        RETURNING id
      `, [batchId, version.id])
      : await client.query(`
        INSERT INTO characteristic_data (
          source_key, period_type, period, year, quarter, source_sector_code,
          sector_id, sisi, jenis_neraca, kode, rincian, neraca_rincian, nilai,
          konsep, staging_row_id, excel_staging_row_id, nilai_raw, value_status,
          period_version_id, source_order
        )
        SELECT
          normalized.source_key, normalized.period_type, normalized.period,
          normalized.year, normalized.quarter, normalized.source_sector_code,
          normalized.sector_id, normalized.sisi, normalized.jenis_neraca,
          normalized.kode, normalized.rincian, normalized.neraca_rincian,
          normalized.nilai, normalized.konsep, NULL, staging.id,
          normalized.nilai_raw, normalized.value_status, $2,
          staging.source_row_number
        FROM staging_excel_rows staging
        CROSS JOIN LATERAL jsonb_to_record(staging.normalized_data) AS normalized(
          source_key VARCHAR(30), period_type VARCHAR(20), period VARCHAR(20),
          year SMALLINT, quarter SMALLINT, source_sector_code VARCHAR(80),
          sector_id BIGINT, sisi TEXT, jenis_neraca TEXT, kode VARCHAR(100),
          rincian TEXT, neraca_rincian TEXT, nilai NUMERIC(38,18),
          konsep TEXT, nilai_raw TEXT, value_status VARCHAR(30)
        )
        WHERE staging.batch_id = $1
          AND staging.validation_status IN ('valid', 'warning')
        RETURNING id
      `, [batchId, version.id])

    if (inserted.rowCount !== Number(stagedStats.total)) {
      throw new Error('Jumlah baris yang disimpan berbeda dari jumlah staging yang disetujui.')
    }

    await client.query(`
      UPDATE data_import_batches
      SET status = 'confirmed', action_type = $2, confirmed_at = NOW(),
          finished_at = NOW(), preview_token_hash = NULL, preview_expires_at = NULL
      WHERE id = $1
    `, [batchId, actionType])

    await client.query(`
      INSERT INTO data_change_events (
        event_type, dataset_key, period_type, year, quarter,
        batch_id, version_id, previous_version_id, reason, event_data
      )
      VALUES (
        'import_confirmed', $1, $2, $3, $4,
        $5, $6, $7, $8,
        jsonb_build_object(
          'activity', 'version_activated',
          'version_number', $9,
          'actor', 'local-user',
          'import_mode', 'replace_period',
          'sectors_created', $10::JSONB
        )
      )
    `, [
      batch.dataset_key,
      batch.period_type,
      batch.year,
      batch.quarter,
      batchId,
      version.id,
      previousVersionId,
      String(req.body.reason || 'Excel import confirmed').slice(0, 1000),
      version.version_number,
      JSON.stringify(createdSectors.map(({ id, code, name }) => ({ id, code, name })))
    ])

    await client.query('COMMIT')
    transactionStarted = false
    client.release()
    client = null

    const refresh = await refreshDashboardAfterCommit()
    return sendRefreshResult(res, 'Import', refresh, {
      batch_id: batchId,
      version_id: version.id,
      version_number: version.version_number,
      action_type: actionType,
      total_rows: Number(stagedStats.total),
      warning_rows: Number(stagedStats.warning),
      new_sectors: createdSectors.map(({ id, code, name }) => ({ id, code, name }))
    })
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        console.error('Confirm import rollback gagal:', rollbackError)
      }
    }
    return sendError(res, error, 'Gagal mengonfirmasi import', 'Gagal mengonfirmasi import.')
  } finally {
    if (client) client.release()
  }
}

async function listVersions(req, res) {
  const page = parsePage(req.query.page)
  const limit = parseLimit(req.query.limit)
  const datasetKey = String(req.query.dataset_key || '').trim() || null
  const status = String(req.query.status || '').trim() || null
  const search = String(req.query.search || '').trim().slice(0, 120) || null
  const year = req.query.year === undefined || req.query.year === '' ? null : Number(req.query.year)
  const sort = String(req.query.sort || 'newest').trim()

  if (status && !versionStatuses.has(status)) {
    return res.status(400).json({ success: false, message: 'Status versi tidak valid.' })
  }
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2200)) {
    return res.status(400).json({ success: false, message: 'Tahun tidak valid.' })
  }
  if (!['newest', 'oldest', 'period'].includes(sort)) {
    return res.status(400).json({ success: false, message: 'Urutan riwayat versi tidak valid.' })
  }

  try {
    const filters = [datasetKey, status, year, search]
    const [countResult, rowsResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM data_period_versions versions
        LEFT JOIN data_import_batches batches ON batches.id = versions.import_batch_id
        WHERE ($1::VARCHAR IS NULL OR versions.dataset_key = $1)
          AND ($2::VARCHAR IS NULL OR versions.status = $2)
          AND ($3::SMALLINT IS NULL OR versions.year = $3)
          AND ($4::TEXT IS NULL OR CONCAT_WS(' ', versions.dataset_key, versions.change_reason, batches.original_filename, versions.year::TEXT) ILIKE '%' || $4 || '%')
      `, filters),
      pool.query(`
        SELECT
          versions.id, versions.dataset_key, versions.period_type,
          versions.year, versions.quarter, versions.version_number,
          versions.status, versions.import_batch_id, versions.previous_version_id,
          versions.row_count, versions.change_reason, versions.created_at,
          versions.activated_at, versions.deactivated_at,
          COALESCE(versions.deactivated_at, versions.activated_at, versions.created_at) AS updated_at,
          batches.original_filename
        FROM data_period_versions versions
        LEFT JOIN data_import_batches batches ON batches.id = versions.import_batch_id
        WHERE ($1::VARCHAR IS NULL OR versions.dataset_key = $1)
          AND ($2::VARCHAR IS NULL OR versions.status = $2)
          AND ($3::SMALLINT IS NULL OR versions.year = $3)
          AND ($4::TEXT IS NULL OR CONCAT_WS(' ', versions.dataset_key, versions.change_reason, batches.original_filename, versions.year::TEXT) ILIKE '%' || $4 || '%')
        ORDER BY
          CASE WHEN $5 = 'period' THEN versions.year END DESC,
          CASE WHEN $5 = 'period' THEN versions.quarter END DESC NULLS LAST,
          CASE WHEN $5 = 'oldest' THEN COALESCE(versions.deactivated_at, versions.activated_at, versions.created_at) END ASC NULLS LAST,
          CASE WHEN $5 = 'newest' THEN COALESCE(versions.deactivated_at, versions.activated_at, versions.created_at) END DESC NULLS LAST,
          versions.year DESC, versions.quarter DESC NULLS LAST,
          versions.dataset_key, versions.version_number DESC
        LIMIT $6 OFFSET $7
      `, [...filters, sort, limit, (page - 1) * limit])
    ])

    const total = countResult.rows[0].total
    return res.json({
      success: true,
      message: 'Riwayat versi berhasil diambil.',
      data: rowsResult.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil riwayat versi', 'Gagal mengambil riwayat versi.')
  }
}

function versionRowsQuery(datasetKey) {
  if (['tahunan', 'triwulanan_1', 'triwulanan_2'].includes(datasetKey)) {
    return `
      SELECT
        COALESCE(sectors.code, data.source_sector_code) AS sektor,
        data.source_sector_code, data.sector_id, data.period,
        data.year, data.quarter, data.sisi, data.jenis_neraca,
        data.kode, data.rincian, data.neraca_rincian, data.konsep,
        data.nilai::TEXT AS nilai, data.nilai_raw, data.value_status
      FROM characteristic_data data
      LEFT JOIN sectors ON sectors.id = data.sector_id
      WHERE data.period_version_id = $1
    `
  }

  if (datasetKey === 'analisis_rasio') {
    return `
      SELECT
        COALESCE(sectors.code, data.source_sector_code) AS sektor,
        data.source_sector_code, data.sector_id, data.period,
        data.year, data.quarter, data.jenis_rasio, data.kode,
        data.rincian, data.nilai::TEXT AS nilai, data.nilai_raw,
        data.value_status
      FROM ratio_data data
      LEFT JOIN sectors ON sectors.id = data.sector_id
      WHERE data.period_version_id = $1
    `
  }

  return `
    SELECT period, year, quarter, transaksi::TEXT AS nilai,
           transaksi_raw AS nilai_raw, value_status
    FROM macro_transactions
    WHERE period_version_id = $1
  `
}

function buildVersionIdentity(datasetKey, row) {
  if (['tahunan', 'triwulanan_1', 'triwulanan_2'].includes(datasetKey)) {
    return {
      key: JSON.stringify(getDataBusinessKey(datasetKey, row)),
      identity: {
        sektor: row.sektor || row.source_sector_code,
        periode: row.period,
        sisi: row.sisi,
        jenis_neraca: row.jenis_neraca,
        kode: row.kode,
        rincian: row.rincian,
        neraca_rincian: row.neraca_rincian,
        konsep: row.konsep
      },
      metadata: { konsep: row.konsep ?? null }
    }
  }

  if (datasetKey === 'analisis_rasio') {
    return {
      key: JSON.stringify(getDataBusinessKey(datasetKey, row)),
      identity: {
        sektor: row.sektor || row.source_sector_code,
        periode: row.period,
        jenis_rasio: row.jenis_rasio,
        kode: row.kode,
        rincian: row.rincian
      },
      metadata: {}
    }
  }

  return {
    key: JSON.stringify(getDataBusinessKey(datasetKey, row)),
    identity: { periode: row.period },
    metadata: {}
  }
}

function parseDecimal(value) {
  if (value === null || value === undefined || value === '') return null
  const match = String(value).match(/^([+-]?)(\d+)(?:\.(\d+))?$/)
  if (!match) return null
  const fraction = match[3] || ''
  const sign = match[1] === '-' ? -1n : 1n
  return {
    coefficient: sign * BigInt(`${match[2]}${fraction}`),
    scale: fraction.length
  }
}

function formatDecimal(coefficient, scale) {
  const negative = coefficient < 0n
  const digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, '0')
  const integer = scale ? digits.slice(0, -scale) : digits
  const fraction = scale ? digits.slice(-scale).replace(/0+$/, '') : ''
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`
}

function compareNumericValues(previousValue, currentValue) {
  const previous = parseDecimal(previousValue)
  const current = parseDecimal(currentValue)
  if (!previous || !current) return null

  const scale = Math.max(previous.scale, current.scale)
  const previousCoefficient = previous.coefficient * (10n ** BigInt(scale - previous.scale))
  const currentCoefficient = current.coefficient * (10n ** BigInt(scale - current.scale))
  const delta = currentCoefficient - previousCoefficient
  let percentage = null
  let percentageBelowPrecision = false

  if (previousCoefficient !== 0n) {
    const percentageScale = 18
    const numerator = delta * (10n ** BigInt(percentageScale + 2))
    const denominator = previousCoefficient < 0n ? -previousCoefficient : previousCoefficient
    let percentageUnits = numerator / denominator
    const remainder = numerator % denominator
    if ((remainder < 0n ? -remainder : remainder) * 2n >= denominator) {
      percentageUnits += numerator < 0n ? -1n : 1n
    }
    percentage = formatDecimal(percentageUnits, percentageScale)
    percentageBelowPrecision = delta !== 0n && percentageUnits === 0n
  }

  return {
    comparison: currentCoefficient === previousCoefficient ? 0 : currentCoefficient > previousCoefficient ? 1 : -1,
    delta: formatDecimal(delta, scale),
    percentage_change: percentage,
    percentage_change_below_precision: percentageBelowPrecision
  }
}

function compareVersionRows(datasetKey, previousRows, currentRows) {
  function groupRows(rows) {
    const groups = new Map()
    for (const row of rows) {
      const { key, identity, metadata } = buildVersionIdentity(datasetKey, row)
      const group = groups.get(key) || { identity, metadata, values: [] }
      group.values.push({
        value: row.nilai ?? null,
        raw_value: row.nilai_raw ?? null,
        value_status: row.value_status ?? null
      })
      groups.set(key, group)
    }
    return groups
  }

  const previousGroups = groupRows(previousRows)
  const currentGroups = groupRows(currentRows)
  const keys = new Set([...previousGroups.keys(), ...currentGroups.keys()])
  const counts = {
    unchanged: 0,
    revised: 0,
    increased: 0,
    decreased: 0,
    newly_filled: 0,
    newly_emptied: 0,
    updated: 0,
    metadata_updated: 0,
    added: 0,
    removed: 0
  }
  const changes = []

  function orderedValues(group) {
    return group.values.sort((first, second) =>
      JSON.stringify([first.value, first.value_status, first.raw_value])
        .localeCompare(JSON.stringify([second.value, second.value_status, second.raw_value]))
    )
  }

  for (const key of keys) {
    const previous = previousGroups.get(key)
    const current = currentGroups.get(key)

    if (!previous) {
      counts.added++
      changes.push({
        change_type: 'added',
        identity: current.identity,
        previous_values: [],
        current_values: orderedValues(current),
        delta: null,
        percentage_change: null,
        metadata_changes: []
      })
      continue
    }

    if (!current) {
      counts.removed++
      changes.push({
        change_type: 'removed',
        identity: previous.identity,
        previous_values: orderedValues(previous),
        current_values: [],
        delta: null,
        percentage_change: null,
        metadata_changes: []
      })
      continue
    }

    const previousValues = orderedValues(previous)
    const currentValues = orderedValues(current)
    const metadataChanges = Object.keys(current.metadata).flatMap(field => {
      const oldValue = previous.metadata[field] ?? null
      const newValue = current.metadata[field] ?? null
      return normalizeBusinessKeyText(oldValue) === normalizeBusinessKeyText(newValue)
        ? []
        : [{ field, previous_value: oldValue, current_value: newValue }]
    })
    const valuePairs = Math.max(previousValues.length, currentValues.length)
    let changeType = null
    let delta = null
    let percentageChange = null
    let percentageChangeBelowPrecision = false

    for (let index = 0; index < valuePairs; index++) {
      const oldValue = previousValues[index]
      const newValue = currentValues[index]
      if (!oldValue || !newValue) {
        changeType = 'updated'
        continue
      }

      const oldIsNull = oldValue.value === null
      const newIsNull = newValue.value === null
      if (oldIsNull && newIsNull) {
        if (oldValue.value_status !== newValue.value_status) {
          metadataChanges.push({
            field: 'value_status',
            previous_value: oldValue.value_status,
            current_value: newValue.value_status
          })
        }
        continue
      }
      if (oldIsNull) {
        changeType = 'newly_filled'
        continue
      }
      if (newIsNull) {
        changeType = 'newly_emptied'
        continue
      }

      const numericChange = compareNumericValues(oldValue.value, newValue.value)
      if (!numericChange) {
        changeType = oldValue.value === newValue.value ? changeType : 'updated'
        continue
      }
      if (numericChange.comparison !== 0) {
        changeType = numericChange.comparison > 0 ? 'increased' : 'decreased'
        delta = numericChange.delta
        percentageChange = numericChange.percentage_change
        percentageChangeBelowPrecision = numericChange.percentage_change_below_precision
      }
    }

    if (changeType) {
      counts.revised++
      counts[changeType]++
    }
    if (metadataChanges.length) counts.metadata_updated++
    if (!changeType && !metadataChanges.length) counts.unchanged++
    if (!changeType && metadataChanges.length) changeType = 'metadata_updated'

    if (changeType || metadataChanges.length) {
      changes.push({
        change_type: changeType || 'metadata_updated',
        identity: current.identity,
        previous_values: previousValues,
        current_values: currentValues,
        delta,
        percentage_change: percentageChange,
        percentage_change_below_precision: percentageChangeBelowPrecision,
        metadata_changes: metadataChanges
      })
    }
  }

  const changeOrder = {
    increased: 0,
    decreased: 1,
    newly_filled: 2,
    newly_emptied: 3,
    updated: 4,
    metadata_updated: 5,
    added: 6,
    removed: 7
  }
  changes.sort((first, second) =>
    changeOrder[first.change_type] - changeOrder[second.change_type] ||
    JSON.stringify(first.identity).localeCompare(JSON.stringify(second.identity))
  )

  return {
    counts,
    changes,
    records: {
      previous: previousGroups.size,
      current: currentGroups.size
    }
  }
}

function paginateComparison(diff, page, limit, previousVersionNumber, currentVersionNumber) {
  const offset = (page - 1) * limit
  return {
    counts: diff.counts,
    records: diff.records,
    changes: diff.changes.slice(offset, offset + limit),
    pagination: {
      page,
      limit,
      total: diff.changes.length,
      total_pages: Math.ceil(diff.changes.length / limit)
    },
    previous_version_number: previousVersionNumber,
    current_version_number: currentVersionNumber
  }
}

async function getVersionDetail(req, res) {
  const versionId = parseId(req.params.versionId)
  if (!versionId) {
    return res.status(400).json({ success: false, message: 'Version ID tidak valid.' })
  }

  try {
    const versionResult = await pool.query(`
      SELECT
        versions.id, versions.dataset_key, versions.period_type,
        versions.year, versions.quarter, versions.version_number,
        versions.status, versions.import_batch_id, versions.previous_version_id,
        versions.row_count, versions.change_reason, versions.created_at,
        versions.activated_at, versions.deactivated_at,
        batches.original_filename
      FROM data_period_versions versions
      LEFT JOIN data_import_batches batches ON batches.id = versions.import_batch_id
      WHERE versions.id = $1
    `, [versionId])

    if (versionResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Versi tidak ditemukan.' })
    }

    const version = versionResult.rows[0]
    let rowsQuery
    if (['tahunan', 'triwulanan_1', 'triwulanan_2'].includes(version.dataset_key)) {
      rowsQuery = `
        SELECT source_sector_code AS sektor, period, sisi, jenis_neraca,
               kode, rincian, neraca_rincian, nilai::TEXT AS nilai,
               nilai_raw, value_status, konsep
        FROM characteristic_data
        WHERE period_version_id = $1
        ORDER BY source_order, id
        LIMIT 20
      `
    } else if (version.dataset_key === 'analisis_rasio') {
      rowsQuery = `
        SELECT source_sector_code AS sektor, period, jenis_rasio, kode,
               rincian, nilai::TEXT AS nilai, nilai_raw, value_status
        FROM ratio_data
        WHERE period_version_id = $1
        ORDER BY source_order, id
        LIMIT 20
      `
    } else {
      rowsQuery = `
        SELECT period, transaksi::TEXT AS transaksi, transaksi_raw, value_status
        FROM macro_transactions
        WHERE period_version_id = $1
        ORDER BY source_order, id
        LIMIT 20
      `
    }

    const previousVersionId = version.previous_version_id
    const [sampleResult, previousResult] = await Promise.all([
      pool.query(rowsQuery, [versionId]),
      previousVersionId
        ? pool.query(`
            SELECT id, version_number, status, row_count, change_reason,
                   created_at, activated_at, deactivated_at
            FROM data_period_versions
            WHERE id = $1
          `, [previousVersionId])
        : pool.query(`
            SELECT id, version_number, status, row_count, change_reason,
                   created_at, activated_at, deactivated_at
            FROM data_period_versions
            WHERE dataset_key = $1
              AND period_type = $2
              AND year = $3
              AND quarter IS NOT DISTINCT FROM $4
              AND version_number < $5
            ORDER BY version_number DESC
            LIMIT 1
          `, [version.dataset_key, version.period_type, version.year, version.quarter, version.version_number])
    ])

    const previousVersion = previousResult.rows[0] || null
    let comparison = null

    if (previousVersion) {
      const rowsQuery = versionRowsQuery(version.dataset_key)
      const [previousRowsResult, currentRowsResult] = await Promise.all([
        pool.query(rowsQuery, [previousVersion.id]),
        pool.query(rowsQuery, [versionId])
      ])
      const diff = compareVersionRows(
        version.dataset_key,
        previousRowsResult.rows,
        currentRowsResult.rows
      )
      const page = parsePage(req.query.comparison_page)
      const limit = parseLimit(req.query.comparison_limit, 25)
      comparison = {
        row_count_delta: Number(version.row_count) - Number(previousVersion.row_count),
        ...paginateComparison(diff, page, limit, previousVersion.version_number, version.version_number)
      }
    }

    return res.json({
      success: true,
      message: 'Detail versi berhasil diambil.',
      data: {
        version,
        previous_version: previousVersion,
        comparison,
        sample_rows: sampleResult.rows
      }
    })
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil detail versi', 'Gagal mengambil detail versi.')
  }
}

async function getAuditTrail(req, res) {
  const page = parsePage(req.query.page)
  const limit = parseLimit(req.query.limit)
  const datasetKey = String(req.query.dataset_key || '').trim() || null
  const eventType = String(req.query.event_type || '').trim() || null
  const search = String(req.query.search || '').trim().slice(0, 120) || null
  const year = req.query.year === undefined || req.query.year === '' ? null : Number(req.query.year)

  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2200)) {
    return res.status(400).json({ success: false, message: 'Tahun tidak valid.' })
  }

  try {
    const filters = [datasetKey, eventType, year, search]
    const [countResult, rowsResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::INTEGER AS total
        FROM data_change_events
        WHERE ($1::VARCHAR IS NULL OR dataset_key = $1)
          AND ($2::VARCHAR IS NULL OR event_type = $2)
          AND ($3::SMALLINT IS NULL OR year = $3)
          AND ($4::TEXT IS NULL OR CONCAT_WS(' ', reason, event_type, event_data::TEXT, year::TEXT) ILIKE '%' || $4 || '%')
      `, filters),
      pool.query(`
        SELECT id, event_type, dataset_key, period_type, year, quarter,
               batch_id, version_id, previous_version_id, reason, event_data, created_at
        FROM data_change_events
        WHERE ($1::VARCHAR IS NULL OR dataset_key = $1)
          AND ($2::VARCHAR IS NULL OR event_type = $2)
          AND ($3::SMALLINT IS NULL OR year = $3)
          AND ($4::TEXT IS NULL OR CONCAT_WS(' ', reason, event_type, event_data::TEXT, year::TEXT) ILIKE '%' || $4 || '%')
        ORDER BY created_at DESC, id DESC
        LIMIT $5 OFFSET $6
      `, [...filters, limit, (page - 1) * limit])
    ])

    const total = countResult.rows[0].total
    return res.json({
      success: true,
      message: 'Audit trail berhasil diambil.',
      data: rowsResult.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    return sendError(res, error, 'Gagal mengambil audit trail', 'Gagal mengambil audit trail.')
  }
}

async function retryDashboardCache(req, res) {
  const refresh = await refreshDashboardAfterCommit()
  return sendRefreshResult(res, 'Refresh cache dashboard', refresh, {})
}

async function restoreVersion(req, res) {
  const versionId = parseId(req.params.versionId)
  if (!versionId) {
    return res.status(400).json({ success: false, message: 'Version ID tidak valid.' })
  }

  let client
  let transactionStarted = false
  try {
    client = await pool.connect()
    await client.query('BEGIN')
    transactionStarted = true

    const targetResult = await client.query(`
      SELECT id, dataset_key, period_type, year, quarter, version_number, status
      FROM data_period_versions
      WHERE id = $1
      FOR UPDATE
    `, [versionId])
    if (targetResult.rowCount === 0) throw validationError(404, 'Versi tidak ditemukan.')
    const target = targetResult.rows[0]

    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), $2::INTEGER)',
      [target.dataset_key, Number(target.year)]
    )

    const activeResult = await client.query(`
      SELECT id
      FROM data_period_versions
      WHERE dataset_key = $1
        AND period_type = $2
        AND year = $3
        AND quarter IS NOT DISTINCT FROM $4
        AND status = 'active'
      FOR UPDATE
    `, [target.dataset_key, target.period_type, target.year, target.quarter])

    if (activeResult.rows[0]?.id === target.id) {
      throw validationError(409, 'Versi ini sudah aktif.')
    }

    const previousVersionId = activeResult.rows[0]?.id ?? null
    if (previousVersionId) {
      await client.query(`
        UPDATE data_period_versions
        SET status = 'superseded', deactivated_at = NOW()
        WHERE id = $1
      `, [previousVersionId])
    }

    await client.query(`
      UPDATE data_period_versions
      SET status = 'active', activated_at = NOW(), deactivated_at = NULL
      WHERE id = $1
    `, [versionId])

    await client.query(`
      INSERT INTO data_change_events (
        event_type, dataset_key, period_type, year, quarter,
        batch_id, version_id, previous_version_id, reason, event_data
      )
      SELECT
        'version_restored', dataset_key, period_type, year, quarter,
        import_batch_id, id, $2, $3,
        jsonb_build_object('actor', 'local-user', 'version_number', version_number)
      FROM data_period_versions
      WHERE id = $1
    `, [versionId, previousVersionId, String(req.body?.reason || 'Version restored by local-user').slice(0, 1000)])

    await client.query('COMMIT')
    transactionStarted = false
    client.release()
    client = null

    const refresh = await refreshDashboardAfterCommit()
    return sendRefreshResult(res, 'Restore versi', refresh, {
      version_id: versionId,
      previous_version_id: previousVersionId,
      status: 'active'
    })
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        console.error('Restore version rollback gagal:', rollbackError)
      }
    }
    return sendError(res, error, 'Gagal memulihkan versi', 'Gagal memulihkan versi.')
  } finally {
    if (client) client.release()
  }
}

async function softDeleteVersion(req, res) {
  const versionId = parseId(req.params.versionId)
  if (!versionId) {
    return res.status(400).json({ success: false, message: 'Version ID tidak valid.' })
  }

  let client
  let transactionStarted = false
  try {
    client = await pool.connect()
    await client.query('BEGIN')
    transactionStarted = true

    const versionResult = await client.query(`
      SELECT id, dataset_key, period_type, year, quarter, version_number,
             status, import_batch_id
      FROM data_period_versions
      WHERE id = $1
      FOR UPDATE
    `, [versionId])
    if (versionResult.rowCount === 0) throw validationError(404, 'Versi tidak ditemukan.')
    const version = versionResult.rows[0]
    if (version.status === 'deleted') throw validationError(409, 'Versi ini sudah dihapus secara soft delete.')

    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), $2::INTEGER)',
      [version.dataset_key, Number(version.year)]
    )

    const reason = String(req.body?.reason || 'Soft delete by local-user').slice(0, 1000)
    await client.query(`
      UPDATE data_period_versions
      SET status = 'deleted', deactivated_at = NOW(), change_reason = $2
      WHERE id = $1
    `, [versionId, reason])

    await client.query(`
      INSERT INTO data_change_events (
        event_type, dataset_key, period_type, year, quarter,
        batch_id, version_id, previous_version_id, reason, event_data
      )
      VALUES (
        'period_deleted', $1, $2, $3, $4, $5, $6, NULL, $7,
        jsonb_build_object('actor', 'local-user', 'version_number', $8, 'scope', 'version')
      )
    `, [
      version.dataset_key,
      version.period_type,
      version.year,
      version.quarter,
      version.import_batch_id,
      version.id,
      reason,
      version.version_number
    ])

    await client.query('COMMIT')
    transactionStarted = false
    client.release()
    client = null

    const refresh = await refreshDashboardAfterCommit()
    return sendRefreshResult(res, 'Soft delete versi', refresh, {
      version_id: versionId,
      status: 'deleted'
    })
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        console.error('Soft delete rollback gagal:', rollbackError)
      }
    }
    return sendError(res, error, 'Gagal menonaktifkan versi', 'Gagal menonaktifkan versi.')
  } finally {
    if (client) client.release()
  }
}

module.exports = {
  confirmImportBatch,
  cancelImportBatch,
  getAuditTrail,
  getImportBatchDetail,
  getManagementSummary,
  getVersionDetail,
  listImportBatches,
  listVersions,
  retryDashboardCache,
  registerSectorsForBatch,
  restoreVersion,
  softDeleteVersion,
  validatePreviewToken
}