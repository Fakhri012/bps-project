const Module = require('node:module')
const crypto = require('node:crypto')
const test = require('node:test')
const assert = require('node:assert/strict')

const controllerPath = require.resolve('../src/controllers/dataManagementController')
const poolPath = require.resolve('../src/config/postgres')
const cachePath = require.resolve('../services/dashboardCacheService')

function moduleWithExports(filename, exports) {
  const mockedModule = new Module(filename)
  mockedModule.filename = filename
  mockedModule.loaded = true
  mockedModule.exports = exports
  return mockedModule
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
}

async function withMockedController(pool, refresh, callback) {
  const previousPool = require.cache[poolPath]
  const previousCache = require.cache[cachePath]
  const previousController = require.cache[controllerPath]

  require.cache[poolPath] = moduleWithExports(poolPath, pool)
  require.cache[cachePath] = moduleWithExports(cachePath, {
    refreshDashboardCacheAfterDataChange: refresh
  })
  delete require.cache[controllerPath]

  try {
    await callback(require(controllerPath))
  } finally {
    if (previousController) require.cache[controllerPath] = previousController
    else delete require.cache[controllerPath]
    if (previousPool) require.cache[poolPath] = previousPool
    else delete require.cache[poolPath]
    if (previousCache) require.cache[cachePath] = previousCache
    else delete require.cache[cachePath]
  }
}

function createConfirmClient({
  invalidRows = 0,
  expire = false,
  failInsert = false,
  datasetKey = 'tahunan',
  periodType = 'annual',
  quarter = null,
  baseVersionId = null,
  baseVersionActivatedAt = null,
  duplicateGroups = 0,
  sourceSectorCodes = [],
  existingSectors = []
} = {}) {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const calls = []
  const callsWithParams = []
  let insertedSectorId = 100

  const client = {
    released: false,
    async query(sql, params = []) {
      const statement = String(sql).replace(/\s+/g, ' ').trim()
      calls.push(statement)
      callsWithParams.push({ statement, params })
      if (statement === 'BEGIN' || statement === 'COMMIT' || statement === 'ROLLBACK') {
        return { rowCount: 0, rows: [] }
      }
      if (statement.includes('FROM data_import_batches') && statement.includes('FOR UPDATE')) {
        return {
          rowCount: 1,
          rows: [{
            id: 8,
            dataset_key: datasetKey,
            period_type: periodType,
            year: 2026,
            quarter,
            action_type: 'new_period',
            status: 'previewed',
            valid_rows: invalidRows ? 0 : 1,
            invalid_rows: invalidRows,
            total_rows: 1,
            preview_token_hash: tokenHash,
            preview_expires_at: expire
              ? new Date(Date.now() - 1000).toISOString()
              : new Date(Date.now() + 60_000).toISOString()
          }]
        }
      }
      if (statement.includes("SELECT DISTINCT normalized_data->>'source_sector_code'")) {
        return { rowCount: sourceSectorCodes.length, rows: sourceSectorCodes.map(source_sector_code => ({ source_sector_code })) }
      }
      if (statement.includes('FROM sectors s')) {
        return { rowCount: existingSectors.length, rows: existingSectors }
      }
      if (statement.startsWith('INSERT INTO sectors')) {
        const [code, name] = params
        return { rowCount: 1, rows: [{ id: insertedSectorId++, code, name }] }
      }
      if (statement.includes('INSERT INTO characteristic_data')) {
        if (failInsert) throw new Error('injected insertion failure')
        return { rowCount: 1, rows: [{ id: 91 }] }
      }
      if (statement.includes('INSERT INTO ratio_data')) {
        if (failInsert) throw new Error('injected insertion failure')
        return { rowCount: 1, rows: [{ id: 92 }] }
      }
      if (statement.includes('FROM staging_excel_rows')) {
        if (statement.includes('duplicate_keys')) {
          return { rowCount: 1, rows: [{ duplicate_groups: duplicateGroups }] }
        }
        if (statement.startsWith('UPDATE staging_excel_rows')) {
          return { rowCount: 1, rows: [] }
        }
        return {
          rowCount: 1,
          rows: [{ total: 1, valid: invalidRows ? 0 : 1, warning: 0, invalid: invalidRows, malformed: 0 }]
        }
      }
      if (statement.includes("event_type = 'import_previewed'")) {
        return {
          rowCount: 1,
          rows: [{ event_data: { import_mode: 'replace_period', base_version_id: baseVersionId, base_version_activated_at: baseVersionActivatedAt } }]
        }
      }
      if (statement.includes('FROM data_period_versions') && statement.includes('ORDER BY version_number')) {
        return { rowCount: 0, rows: [] }
      }
      if (statement.includes('INSERT INTO data_period_versions')) {
        return { rowCount: 1, rows: [{ id: 42, version_number: 1 }] }
      }
      return { rowCount: 1, rows: [] }
    },
    release() {
      this.released = true
    }
  }

  return { token, calls, callsWithParams, client }
}

test('confirm import activates a new version, consumes the token, and refreshes cache', async () => {
  const fixture = createConfirmClient()
  let refreshed = 0
  const pool = { connect: async () => fixture.client }

  await withMockedController(pool, async () => {
    refreshed++
    return { refreshedAt: new Date().toISOString(), total: { tahunan: 1, triwulanan: 1 } }
  }, async controller => {
    const response = responseRecorder()
    await controller.confirmImportBatch({
      params: { batchId: '8' },
      body: { confirm: true, preview_token: fixture.token, reason: 'Reviewed' }
    }, response)

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.version_id, 42)
    assert.equal(response.body.data.action_type, 'new_period')
    assert.equal(response.body.data.dashboard_refresh.status, 'refreshed')
    assert.equal(refreshed, 1)
    assert.ok(fixture.calls.includes('COMMIT'))
    assert.ok(fixture.calls.some(sql => sql.startsWith('INSERT INTO characteristic_data')))
    assert.ok(fixture.calls.some(sql => sql.includes('preview_token_hash = NULL')))
    assert.equal(fixture.client.released, true)
  })
})

test('invalid staging rolls back without activating a version or refreshing cache', async () => {
  const fixture = createConfirmClient({ invalidRows: 1 })
  let refreshed = 0
  const pool = { connect: async () => fixture.client }

  await withMockedController(pool, async () => {
    refreshed++
    return {}
  }, async controller => {
    const response = responseRecorder()
    await controller.confirmImportBatch({
      params: { batchId: '8' },
      body: { confirm: true, preview_token: fixture.token }
    }, response)

    assert.equal(response.statusCode, 409)
    assert.equal(refreshed, 0)
    assert.ok(fixture.calls.includes('ROLLBACK'))
    assert.equal(fixture.calls.some(sql => sql.startsWith('INSERT INTO data_period_versions')), false)
    assert.equal(fixture.client.released, true)
  })
})

test('expired preview is marked expired and committed before returning HTTP 410', async () => {
  const fixture = createConfirmClient({ expire: true })
  const pool = { connect: async () => fixture.client }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.confirmImportBatch({
      params: { batchId: '8' },
      body: { confirm: true, preview_token: fixture.token }
    }, response)

    assert.equal(response.statusCode, 410)
    assert.ok(fixture.calls.some(sql => sql.includes("status = 'expired'")))
    assert.ok(fixture.calls.includes('COMMIT'))
    assert.equal(fixture.calls.includes('ROLLBACK'), false)
  })
})

test('import batch detail includes its created data version', async () => {
  const pool = {
    async query(sql) {
      const statement = String(sql).replace(/\s+/g, ' ').trim()
      if (statement.includes('FROM data_import_batches')) {
        return { rowCount: 1, rows: [{ id: 8, status: 'confirmed', original_filename: 'latest.xlsx' }] }
      }
      if (statement.includes('FROM data_period_versions')) {
        return {
          rowCount: 1,
          rows: [{ id: 42, dataset_key: 'tahunan', period_type: 'annual', year: 2026, version_number: 1, status: 'active', import_batch_id: 8, row_count: 100 }]
        }
      }
      if (statement.includes('GROUP BY validation_status')) return { rowCount: 0, rows: [] }
      if (statement.includes('SELECT COUNT(*)')) return { rowCount: 1, rows: [{ total: 0 }] }
      return { rowCount: 0, rows: [] }
    }
  }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.getImportBatchDetail({ params: { batchId: '8' }, query: {} }, response)

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.version.id, 42)
    assert.equal(response.body.data.version.import_batch_id, 8)
  })
})

test('pending batch detail includes value comparison against its captured baseline', async () => {
  const previousRow = {
    sektor: 'CB', sector_id: 7, source_sector_code: 'CB', year: 2024,
    quarter: null, period: '2024', sisi: 'ASET', jenis_neraca: 'NERACA',
    kode: 'P6', rincian: 'Investasi', neraca_rincian: null,
    konsep: 'KONSEP A', nilai: '150000', nilai_raw: '150000', value_status: 'valid'
  }
  const pool = {
    async query(sql) {
      const statement = String(sql).replace(/\s+/g, ' ').trim()
      if (statement.includes('FROM data_import_batches')) {
        return { rowCount: 1, rows: [{ id: 501, dataset_key: 'tahunan', period_type: 'annual', year: 2024, quarter: null, status: 'previewed', total_rows: 1 }] }
      }
      if (statement.includes('FROM data_period_versions') && statement.includes('import_batch_id')) {
        return { rowCount: 0, rows: [] }
      }
      if (statement.includes('SELECT COUNT(*)::INTEGER AS total')) return { rowCount: 1, rows: [{ total: 1 }] }
      if (statement.includes('GROUP BY validation_status')) return { rowCount: 1, rows: [{ validation_status: 'valid', total: 1 }] }
      if (statement.includes("event_type = 'import_previewed'")) {
        return { rowCount: 1, rows: [{ event_data: { base_version_id: 40, base_version_activated_at: '2026-01-01T00:00:00.000Z' } }] }
      }
      if (statement.includes('FROM data_period_versions') && statement.includes('WHERE id = $1')) {
        return { rowCount: 1, rows: [{ id: 40, version_number: 1 }] }
      }
      if (statement.includes('FROM characteristic_data data')) return { rowCount: 1, rows: [previousRow] }
      if (statement.includes('SELECT normalized_data')) {
        return { rowCount: 1, rows: [{ normalized_data: {
          source_key: 'tahunan', period_type: 'annual', year: 2024, quarter: null,
          period: '2024', source_sector_code: 'CB', sector_id: 7, sisi: 'ASET',
          jenis_neraca: 'NERACA', kode: 'P6', rincian: 'Investasi',
          neraca_rincian: null, konsep: 'KONSEP A', nilai: '175000',
          nilai_raw: '175000', value_status: 'valid',
          business_key: ['characteristic', 'tahunan', 'id:7', 2024, null, 'ASET', 'NERACA', 'P6', 'INVESTASI', '']
        } }] }
      }
      return { rowCount: 0, rows: [] }
    }
  }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.getImportBatchDetail({ params: { batchId: '501' }, query: {} }, response)

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.comparison.previous_version_number, 1)
    assert.equal(response.body.data.comparison.current_version_number, 'Usulan')
    assert.equal(response.body.data.comparison.changes[0].change_type, 'increased')
    assert.equal(response.body.data.comparison.changes[0].delta, '25000')
  })
})

test('version detail compares values by characteristic identity instead of row position', async () => {
  const previousRows = [
    { sektor: 'CB', sector_id: 7, source_sector_code: 'CB', year: 2024, quarter: null, period: '2024', sisi: 'ASET', jenis_neraca: 'NERACA', kode: '01', rincian: 'Kas', neraca_rincian: null, konsep: 'KONSEP A', nilai: '100', nilai_raw: '100', value_status: 'valid' },
    { sektor: 'CB', sector_id: 7, source_sector_code: 'CB', year: 2024, quarter: null, period: '2024', sisi: 'ASET', jenis_neraca: 'NERACA', kode: '02', rincian: 'Piutang', neraca_rincian: null, konsep: 'KONSEP A', nilai: '25', nilai_raw: '25', value_status: 'valid' },
    { sektor: 'CB', sector_id: 7, source_sector_code: 'CB', year: 2024, quarter: null, period: '2024', sisi: 'ASET', jenis_neraca: 'NERACA', kode: '03', rincian: 'Deposito nol', neraca_rincian: null, konsep: 'KONSEP A', nilai: '0', nilai_raw: '0', value_status: 'valid' },
    { sektor: 'CB', sector_id: 7, source_sector_code: 'CB', year: 2024, quarter: null, period: '2024', sisi: 'ASET', jenis_neraca: 'NERACA', kode: '04', rincian: 'Kosong', neraca_rincian: null, konsep: 'KONSEP A', nilai: null, nilai_raw: null, value_status: 'empty' },
    { sektor: 'CB', sector_id: 7, source_sector_code: 'CB', year: 2024, quarter: null, period: '2024', sisi: 'ASET', jenis_neraca: 'NERACA', kode: '05', rincian: 'Dikurangi', neraca_rincian: null, konsep: 'KONSEP A', nilai: '10', nilai_raw: '10', value_status: 'valid' },
    { sektor: 'CB', sector_id: 7, source_sector_code: 'CB', year: 2024, quarter: null, period: '2024', sisi: 'ASET', jenis_neraca: 'NERACA', kode: '06', rincian: 'Negatif', neraca_rincian: null, konsep: 'KONSEP A', nilai: '-5', nilai_raw: '-5', value_status: 'valid' },
    { sektor: 'CB', sector_id: 7, source_sector_code: 'CB', year: 2024, quarter: null, period: '2024', sisi: 'ASET', jenis_neraca: 'NERACA', kode: '08', rincian: 'Presisi', neraca_rincian: null, konsep: 'KONSEP A', nilai: '0.123456789012345678', nilai_raw: '0.123456789012345678', value_status: 'valid' }
  ]
  const currentRows = [
    { ...previousRows[1] },
    { ...previousRows[0], nilai: '125', nilai_raw: '125' },
    { ...previousRows[2], nilai: '1', nilai_raw: '1' },
    { ...previousRows[3], nilai: '2', nilai_raw: '2', value_status: 'valid' },
    { ...previousRows[4], nilai: null, nilai_raw: null, value_status: 'empty' },
    { ...previousRows[5], konsep: 'KONSEP B', nilai: '-7', nilai_raw: '-7' },
    { sektor: 'CB', sector_id: 7, source_sector_code: 'CB', year: 2024, quarter: null, period: '2024', sisi: 'ASET', jenis_neraca: 'NERACA', kode: '08', rincian: 'Presisi', neraca_rincian: null, konsep: 'KONSEP A', nilai: '0.123456789012345679', nilai_raw: '0.123456789012345679', value_status: 'valid' },
    { sektor: 'CB', sector_id: 7, source_sector_code: 'CB', year: 2024, quarter: null, period: '2024', sisi: 'ASET', jenis_neraca: 'NERACA', kode: '07', rincian: 'Baru', neraca_rincian: null, konsep: 'KONSEP A', nilai: '10', nilai_raw: '10', value_status: 'valid' }
  ]
  const pool = {
    async query(sql, params) {
      const statement = String(sql).replace(/\s+/g, ' ').trim()
      if (statement.includes('FROM data_period_versions versions')) {
        return {
          rowCount: 1,
          rows: [{ id: 42, dataset_key: 'tahunan', period_type: 'annual', year: 2024, quarter: null, version_number: 2, status: 'active', previous_version_id: 41, row_count: 8 }]
        }
      }
      if (statement.includes('SELECT id, version_number') && statement.includes('FROM data_period_versions')) {
        return {
          rowCount: 1,
          rows: [{ id: 41, version_number: 1, status: 'superseded', row_count: 7 }]
        }
      }
      if (statement.includes('FROM characteristic_data data')) {
        return { rowCount: params[0] === 41 ? previousRows.length : currentRows.length, rows: params[0] === 41 ? previousRows : currentRows }
      }
      if (statement.includes('FROM characteristic_data') && statement.includes('LIMIT 20')) {
        return { rowCount: 0, rows: [] }
      }
      return { rowCount: 0, rows: [] }
    }
  }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.getVersionDetail({ params: { versionId: '42' }, query: {} }, response)

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body.data.comparison.counts, {
      unchanged: 1,
      revised: 6,
      increased: 3,
      decreased: 1,
      newly_filled: 1,
      newly_emptied: 1,
      updated: 0,
      metadata_updated: 1,
      added: 1,
      removed: 0
    })
    assert.equal(response.body.data.comparison.changes[0].change_type, 'increased')
    assert.equal(response.body.data.comparison.changes[0].identity.kode, '01')
    assert.equal(response.body.data.comparison.changes[0].previous_values[0].value, '100')
    assert.equal(response.body.data.comparison.changes[0].current_values[0].value, '125')
    assert.equal(response.body.data.comparison.changes[0].delta, '25')
    assert.equal(response.body.data.comparison.changes[0].percentage_change, '25')
    const changes = response.body.data.comparison.changes
    assert.equal(changes.find(change => change.identity.kode === '03').percentage_change, null)
    assert.equal(changes.find(change => change.identity.kode === '04').change_type, 'newly_filled')
    assert.equal(changes.find(change => change.identity.kode === '05').change_type, 'newly_emptied')
    assert.equal(changes.find(change => change.identity.kode === '06').change_type, 'decreased')
    assert.equal(changes.find(change => change.identity.kode === '06').percentage_change, '-40')
    assert.equal(changes.find(change => change.identity.kode === '08').delta, '0.000000000000000001')
    assert.deepEqual(changes.find(change => change.identity.kode === '06').metadata_changes, [
      { field: 'konsep', previous_value: 'KONSEP A', current_value: 'KONSEP B' }
    ])
  })
})

test('cancelling a preview removes staging rows and records the cancellation', async () => {
  const calls = []
  const client = {
    released: false,
    async query(sql) {
      const statement = String(sql).replace(/\s+/g, ' ').trim()
      calls.push(statement)
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)) return { rowCount: 0, rows: [] }
      if (statement.includes('FROM data_import_batches') && statement.includes('FOR UPDATE')) {
        return { rowCount: 1, rows: [{ id: 8, dataset_key: 'tahunan', period_type: 'annual', year: 2026, quarter: null, status: 'previewed' }] }
      }
      if (statement.includes('FROM data_period_versions')) return { rowCount: 0, rows: [] }
      if (statement.startsWith('DELETE FROM staging_excel_rows')) return { rowCount: 2, rows: [] }
      return { rowCount: 1, rows: [] }
    },
    release() { this.released = true }
  }

  await withMockedController({ connect: async () => client }, async () => {
    throw new Error('Preview cancellation must not refresh dashboard data')
  }, async controller => {
    const response = responseRecorder()
    await controller.cancelImportBatch({ params: { batchId: '8' }, body: { reason: 'Wrong workbook' } }, response)

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.status, 'cancelled')
    assert.equal(response.body.data.removed_rows, 2)
    assert.ok(calls.some(sql => sql.startsWith('DELETE FROM staging_excel_rows')))
    assert.ok(calls.some(sql => sql.includes("event_type, dataset_key") && sql.includes("'import_cancelled'")))
    assert.ok(calls.some(sql => sql.includes("'removed_staging_rows', $7::INTEGER")))
    assert.ok(calls.includes('COMMIT'))
    assert.equal(calls.includes('ROLLBACK'), false)
    assert.equal(client.released, true)
  })
})

test('confirmed batches cannot be cancelled or have staging rows removed', async () => {
  const calls = []
  const client = {
    released: false,
    async query(sql) {
      const statement = String(sql).replace(/\s+/g, ' ').trim()
      calls.push(statement)
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)) return { rowCount: 0, rows: [] }
      if (statement.includes('FROM data_import_batches') && statement.includes('FOR UPDATE')) {
        return { rowCount: 1, rows: [{ id: 8, status: 'confirmed' }] }
      }
      return { rowCount: 0, rows: [] }
    },
    release() { this.released = true }
  }

  await withMockedController({ connect: async () => client }, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.cancelImportBatch({ params: { batchId: '8' }, body: { reason: 'Batch sudah dikonfirmasi' } }, response)

    assert.equal(response.statusCode, 409)
    assert.equal(calls.some(sql => sql.startsWith('DELETE FROM staging_excel_rows')), false)
    assert.ok(calls.includes('ROLLBACK'))
    assert.equal(client.released, true)
  })
})

test('invalid batch id and missing explicit consent are rejected before database access', async () => {
  let connected = false
  const pool = { connect: async () => { connected = true; throw new Error('should not connect') } }

  await withMockedController(pool, async () => ({}), async controller => {
    const invalidIdResponse = responseRecorder()
    await controller.confirmImportBatch({
      params: { batchId: 'not-an-id' },
      body: { confirm: true }
    }, invalidIdResponse)
    assert.equal(invalidIdResponse.statusCode, 400)

    const consentResponse = responseRecorder()
    await controller.confirmImportBatch({
      params: { batchId: '8' },
      body: { confirm: false }
    }, consentResponse)
    assert.equal(consentResponse.statusCode, 400)
    assert.equal(connected, false)
  })
})

test('restoring a deleted version switches active version transactionally and refreshes cache', async () => {
  const calls = []
  const client = {
    released: false,
    async query(sql) {
      const statement = String(sql).replace(/\s+/g, ' ').trim()
      calls.push(statement)
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)) return { rowCount: 0, rows: [] }
      if (statement.includes('FROM data_period_versions') && statement.includes('WHERE id = $1 FOR UPDATE')) {
        return { rowCount: 1, rows: [{ id: 12, dataset_key: 'tahunan', period_type: 'annual', year: 2026, quarter: null, version_number: 1, status: 'deleted', import_batch_id: 8 }] }
      }
      if (statement.includes("AND status = 'active'") && statement.includes('FOR UPDATE')) {
        return { rowCount: 1, rows: [{ id: 13 }] }
      }
      return { rowCount: 1, rows: [] }
    },
    release() { this.released = true }
  }
  const pool = { connect: async () => client }
  let refreshed = 0

  await withMockedController(pool, async () => {
    refreshed++
    return { refreshedAt: new Date().toISOString(), total: { tahunan: 0, triwulanan: 0 } }
  }, async controller => {
    const response = responseRecorder()
    await controller.restoreVersion({ params: { versionId: '12' }, body: { reason: 'Restore prior period' } }, response)
    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.previous_version_id, 13)
    assert.ok(calls.some(sql => sql.includes("SET status = 'superseded'")))
    assert.ok(calls.some(sql => sql.includes("SET status = 'active'")))
    assert.ok(calls.some(sql => sql.includes("'version_restored'")))
    assert.ok(calls.includes('COMMIT'))
    assert.equal(refreshed, 1)
    assert.equal(client.released, true)
  })
})

test('soft delete preserves rows and records a period_deleted event', async () => {
  const calls = []
  const client = {
    released: false,
    async query(sql) {
      const statement = String(sql).replace(/\s+/g, ' ').trim()
      calls.push(statement)
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(statement)) return { rowCount: 0, rows: [] }
      if (statement.includes('FROM data_period_versions') && statement.includes('WHERE id = $1 FOR UPDATE')) {
        return { rowCount: 1, rows: [{ id: 12, dataset_key: 'tahunan', period_type: 'annual', year: 2026, quarter: null, version_number: 2, status: 'active', import_batch_id: 8 }] }
      }
      return { rowCount: 1, rows: [] }
    },
    release() { this.released = true }
  }
  const pool = { connect: async () => client }
  let refreshed = 0

  await withMockedController(pool, async () => {
    refreshed++
    return { refreshedAt: new Date().toISOString(), total: { tahunan: 0, triwulanan: 0 } }
  }, async controller => {
    const response = responseRecorder()
    await controller.softDeleteVersion({ params: { versionId: '12' }, body: { reason: 'Correction required' } }, response)
    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.status, 'deleted')
    assert.ok(calls.some(sql => sql.includes("SET status = 'deleted'")))
    assert.ok(calls.some(sql => sql.includes("'period_deleted'")))
    assert.equal(calls.some(sql => /^DELETE\b/i.test(sql)), false)
    assert.ok(calls.includes('COMMIT'))
    assert.equal(refreshed, 1)
    assert.equal(client.released, true)
  })
})

test('version history sorts by update time before applying pagination', async () => {
  const queries = []
  const pool = {
    async query(sql, params) {
      queries.push({ sql: String(sql), params })
      return String(sql).includes('COUNT(*)')
        ? { rowCount: 1, rows: [{ total: 0 }] }
        : { rowCount: 0, rows: [] }
    }
  }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.listVersions({ query: { sort: 'newest', page: '1' } }, response)

    assert.equal(response.statusCode, 200)
    const rowsQuery = queries.find(query => query.sql.includes('ORDER BY'))
    assert.ok(rowsQuery.sql.includes('COALESCE(versions.deactivated_at, versions.activated_at, versions.created_at)'))
    assert.ok(rowsQuery.sql.includes('LIMIT $6 OFFSET $7'))
    assert.equal(rowsQuery.params[4], 'newest')
  })
})

test('version history rejects unsupported sort modes', async () => {
  let queried = false
  const pool = { query: async () => { queried = true; return { rows: [] } } }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.listVersions({ query: { sort: 'random' } }, response)

    assert.equal(response.statusCode, 400)
    assert.equal(queried, false)
  })
})

test('confirm import activates quarterly characteristic versions', async () => {
  const fixture = createConfirmClient({
    datasetKey: 'triwulanan_2',
    periodType: 'quarterly',
    quarter: 3
  })
  const pool = { connect: async () => fixture.client }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.confirmImportBatch({
      params: { batchId: '8' },
      body: { confirm: true, preview_token: fixture.token }
    }, response)

    assert.equal(response.statusCode, 200)
    assert.ok(fixture.calls.some(sql => sql.startsWith('INSERT INTO characteristic_data')))
    assert.ok(fixture.calls.some(sql => sql.includes("period_type = $2") && sql.includes('quarter IS NOT DISTINCT FROM $4')))
  })
})

test('confirm import inserts ratio rows into ratio_data', async () => {
  const fixture = createConfirmClient({ datasetKey: 'analisis_rasio' })
  const pool = { connect: async () => fixture.client }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.confirmImportBatch({
      params: { batchId: '8' },
      body: { confirm: true, preview_token: fixture.token }
    }, response)

    assert.equal(response.statusCode, 200)
    assert.ok(fixture.calls.some(sql => sql.startsWith('INSERT INTO ratio_data')))
    assert.equal(fixture.calls.some(sql => sql.startsWith('INSERT INTO characteristic_data')), false)
  })
})

test('confirm import accepts quarterly Analisis Rasio periods', async () => {
  const fixture = createConfirmClient({
    datasetKey: 'analisis_rasio',
    periodType: 'quarterly',
    quarter: 2
  })
  const pool = { connect: async () => fixture.client }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.confirmImportBatch({
      params: { batchId: '8' },
      body: { confirm: true, preview_token: fixture.token }
    }, response)

    assert.equal(response.statusCode, 200)
    assert.ok(fixture.calls.some(sql => sql.startsWith('INSERT INTO ratio_data')))
  })
})

test('confirm import blocks duplicate business keys', async () => {
  const fixture = createConfirmClient({ duplicateGroups: 1 })
  const pool = { connect: async () => fixture.client }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.confirmImportBatch({
      params: { batchId: '8' },
      body: { confirm: true, preview_token: fixture.token }
    }, response)

    assert.equal(response.statusCode, 409)
    assert.equal(fixture.calls.some(sql => sql.startsWith('INSERT INTO data_period_versions')), false)
  })
})

test('confirm import rejects a comparison based on a stale active version', async () => {
  const fixture = createConfirmClient({ baseVersionId: 99 })
  const pool = { connect: async () => fixture.client }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.confirmImportBatch({
      params: { batchId: '8' },
      body: { confirm: true, preview_token: fixture.token }
    }, response)

    assert.equal(response.statusCode, 409)
    assert.equal(fixture.calls.some(sql => sql.startsWith('INSERT INTO data_period_versions')), false)
  })
})

test('cancellation requires a rejection reason before database access', async () => {
  let connected = false
  const pool = { connect: async () => { connected = true; throw new Error('should not connect') } }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.cancelImportBatch({ params: { batchId: '8' }, body: { reason: '  ' } }, response)

    assert.equal(response.statusCode, 400)
    assert.equal(connected, false)
  })
})

test('approval reuses an existing canonical sector without creating an alias or duplicate', async () => {
  const fixture = createConfirmClient({
    sourceSectorCodes: ['cb'],
    existingSectors: [{ id: 1, code: 'CB', name: 'CB', source_code: 'CB 2' }]
  })
  const pool = { connect: async () => fixture.client }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.confirmImportBatch({
      params: { batchId: '8' },
      body: { confirm: true, preview_token: fixture.token }
    }, response)

    assert.equal(response.statusCode, 200)
    assert.equal(fixture.calls.filter(sql => sql.startsWith('INSERT INTO sectors')).length, 0)
    const stagingUpdate = fixture.callsWithParams.find(query => query.statement.startsWith('UPDATE staging_excel_rows'))
    assert.equal(stagingUpdate.params[2], 1)
  })
})

test('approval registers normalized new-sector variants once and assigns the sector id to staging', async () => {
  const fixture = createConfirmClient({
    sourceSectorCodes: ['NFC PRIVATE 2', 'nfc   private 2'],
    existingSectors: [{ id: 1, code: 'CB', name: 'CB', source_code: 'CB' }]
  })
  const pool = { connect: async () => fixture.client }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.confirmImportBatch({
      params: { batchId: '8' },
      body: { confirm: true, preview_token: fixture.token }
    }, response)

    assert.equal(response.statusCode, 200)
    assert.equal(fixture.calls.filter(sql => sql.startsWith('INSERT INTO sectors')).length, 1)
    assert.equal(fixture.calls.filter(sql => sql.includes("hashtext('sectors')")).length, 1)
    const updates = fixture.callsWithParams.filter(query => query.statement.startsWith('UPDATE staging_excel_rows'))
    assert.equal(updates.length, 2)
    assert.ok(updates.every(query => query.params[2] === 100))
    assert.deepEqual(response.body.data.new_sectors.map(sector => sector.code), ['NFC PRIVATE 2'])
    const audit = fixture.callsWithParams.find(query => query.statement.startsWith('INSERT INTO data_change_events'))
    assert.match(audit.params[9], /NFC PRIVATE 2/)
    assert.ok(fixture.calls.indexOf('COMMIT') > fixture.calls.findIndex(sql => sql.startsWith('INSERT INTO sectors')))
  })
})

test('approval failure after creating a sector rolls back the sector and import transaction', async () => {
  const fixture = createConfirmClient({
    failInsert: true,
    sourceSectorCodes: ['NEW SECTOR']
  })
  const pool = { connect: async () => fixture.client }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.confirmImportBatch({
      params: { batchId: '8' },
      body: { confirm: true, preview_token: fixture.token }
    }, response)

    assert.equal(response.statusCode, 500)
    assert.ok(fixture.calls.some(sql => sql.startsWith('INSERT INTO sectors')))
    assert.ok(fixture.calls.includes('ROLLBACK'))
    assert.equal(fixture.calls.includes('COMMIT'), false)
  })
})

test('new sector preview rows compare as added without fabricated previous values', async () => {
  const previousRow = {
    sektor: 'CB', sector_id: 1, source_sector_code: 'CB', year: 2026,
    quarter: null, period: '2026', sisi: 'PENGGUNAAN', jenis_neraca: 'NERACA PRODUKSI',
    kode: 'P6', rincian: 'Investasi', neraca_rincian: null,
    nilai: '100', nilai_raw: '100', value_status: 'valid'
  }
  const candidateRow = {
    source_key: 'tahunan', period_type: 'annual', year: 2026, quarter: null,
    period: '2026', source_sector_code: 'NFC PRIVATE 2', sector_id: null,
    sector_status: 'new_sector_candidate', new_sector_candidate: true,
    sisi: 'PENGGUNAAN', jenis_neraca: 'NERACA PRODUKSI', kode: 'P6',
    rincian: 'Investasi', nilai: '150000', nilai_raw: '150000', value_status: 'valid',
    business_key: ['characteristic', 'tahunan', 'code:NFC PRIVATE 2', 2026, null, 'PENGGUNAAN', 'NERACA PRODUKSI', 'P6', 'INVESTASI', '']
  }
  const pool = {
    async query(sql, params = []) {
      const statement = String(sql).replace(/\s+/g, ' ').trim()
      if (statement.includes('FROM data_import_batches')) {
        return { rowCount: 1, rows: [{ id: 501, dataset_key: 'tahunan', period_type: 'annual', year: 2026, quarter: null, status: 'previewed', total_rows: 1 }] }
      }
      if (statement.includes('FROM data_period_versions') && statement.includes('import_batch_id')) {
        return { rowCount: 0, rows: [] }
      }
      if (statement.includes('SELECT COUNT(*)::INTEGER AS total')) return { rowCount: 1, rows: [{ total: 1 }] }
      if (statement.includes('GROUP BY validation_status')) return { rowCount: 1, rows: [{ validation_status: 'valid', total: 1 }] }
      if (statement.includes("normalized_data->>'source_sector_code' AS source_sector_code")) {
        return { rowCount: 1, rows: [{ ...candidateRow, sector_conflicts: [] }] }
      }
      if (statement.includes("event_type = 'import_previewed'")) {
        return { rowCount: 1, rows: [{ event_data: { base_version_id: 40, import_mode: 'replace_period' } }] }
      }
      if (statement.includes('SELECT id, version_number') && statement.includes('FROM data_period_versions')) {
        return { rowCount: 1, rows: [{ id: 40, version_number: 1 }] }
      }
      if (statement.includes('FROM characteristic_data data')) return { rowCount: 1, rows: [previousRow] }
      if (statement.includes('SELECT normalized_data FROM staging_excel_rows')) {
        return { rowCount: 1, rows: [{ normalized_data: candidateRow }] }
      }
      return { rowCount: 0, rows: [] }
    }
  }

  await withMockedController(pool, async () => ({}), async controller => {
    const response = responseRecorder()
    await controller.getImportBatchDetail({ params: { batchId: '501' }, query: {} }, response)

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.sector_summary.new_sector_count, 1)
    const added = response.body.data.comparison.changes.find(change => change.change_type === 'added')
    assert.ok(added)
    assert.equal(added.identity.sektor, 'NFC PRIVATE 2')
    assert.deepEqual(added.previous_values, [])
    assert.equal(added.current_values[0].value, '150000')
  })
})