'use strict'

const path = require('node:path')
const fs = require('node:fs')
const dotenv = require('dotenv')
const { Client } = require('pg')
const test = require('node:test')
const assert = require('node:assert/strict')

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const { registerSectorsForBatch } = require('../src/controllers/dataManagementController')
const testDatabase = 'bps_sector_feature_test'

test('migration 007 adds official names as aliases to existing master sectors', {
  skip: process.env.RUN_SECTOR_POSTGRES_TESTS !== '1'
}, async () => {
  assert.notEqual(testDatabase, process.env.DB_NAME || 'bps_dashboard')
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: testDatabase,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
  })

  await client.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sectors (
        id BIGSERIAL PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        sector_type VARCHAR(20) NOT NULL DEFAULT 'sector'
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sector_aliases (
        id BIGSERIAL PRIMARY KEY,
        source_code VARCHAR(200) NOT NULL UNIQUE,
        sector_id BIGINT NOT NULL REFERENCES sectors(id)
      )
    `)
    for (const code of ['FC', 'NFC', 'NPISHS', 'ROW', 'GG', 'HH', 'TOTAL', 'TOTAL EKN']) {
      await client.query(
        'INSERT INTO sectors (code, name, sector_type) VALUES ($1, $1, $2) ON CONFLICT (code) DO NOTHING',
        [code, code.startsWith('TOTAL') ? 'aggregate' : 'sector']
      )
    }

    const migration = fs.readFileSync(
      path.resolve(__dirname, '../database/migrations/007_official_sector_name_aliases.sql'),
      'utf8'
    )
    await client.query(migration)

    const result = await client.query(`
      SELECT aliases.source_code, sectors.code AS target_code
      FROM sector_aliases aliases
      JOIN sectors ON sectors.id = aliases.sector_id
      WHERE aliases.source_code IN (
        'KORPORASI FINANSIAL (FINANCIAL CORPORATIONS)',
        'KORPORASI NONFINANSIAL (NONFINANCIAL CORPORATIONS)',
        'LEMBAGA NON PROFIT YANG MELAYANI RUMAH TANGGA (NONPROFIT INSTITUTIONS SERVING HOUSEHOLDS)',
        'LUAR NEGERI (REST OF THE WORLD)',
        'PEMERINTAH UMUM (GENERAL GOVERNMENT)',
        'RUMAH TANGGA (HOUSEHOLDS)',
        'TOTAL',
        'TOTAL EKONOMI (TOTAL ECONOMY)'
      )
      ORDER BY target_code
    `)
    assert.equal(result.rowCount, 8)
    assert.ok(result.rows.some(row => row.source_code.length > 80 && row.target_code === 'NPISHS'))
    assert.deepEqual(result.rows.map(row => row.target_code), [
      'FC', 'GG', 'HH', 'NFC', 'NPISHS', 'ROW', 'TOTAL', 'TOTAL EKN'
    ])
  } finally {
    await client.end()
  }
})

test('PostgreSQL sector registration is atomic and resolves normalized identities', {
  skip: process.env.RUN_SECTOR_POSTGRES_TESTS !== '1'
}, async () => {
  assert.notEqual(testDatabase, process.env.DB_NAME || 'bps_dashboard')
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: testDatabase,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
  })

  await client.connect()
  try {
    await client.query(`
      CREATE TEMP TABLE sectors (
        id BIGSERIAL PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        sector_type VARCHAR(20) NOT NULL DEFAULT 'sector',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE TEMP TABLE sector_aliases (
        id BIGSERIAL PRIMARY KEY,
        source_code VARCHAR(80) NOT NULL UNIQUE,
        sector_id BIGINT NOT NULL REFERENCES sectors(id)
      )
    `)
    await client.query(`
      CREATE TEMP TABLE staging_excel_rows (
        id BIGSERIAL PRIMARY KEY,
        batch_id BIGINT NOT NULL,
        source_row_number INTEGER NOT NULL,
        normalized_data JSONB NOT NULL,
        validation_status VARCHAR(20) NOT NULL
      )
    `)

    await client.query('BEGIN')
    const existing = await client.query(
      "INSERT INTO sectors (code, name) VALUES ('CB', 'Central Bank') RETURNING id"
    )
    await client.query(
      'INSERT INTO sector_aliases (source_code, sector_id) VALUES ($1, $2)',
      ['CB 2', existing.rows[0].id]
    )
    const staged = [
      { source_sector_code: 'NFC PRIVATE 2', sector_status: 'new_sector_candidate', new_sector_candidate: true, sector_id: null },
      { source_sector_code: 'nfc   private 2', sector_status: 'new_sector_candidate', new_sector_candidate: true, sector_id: null },
      { source_sector_code: 'CB 2', sector_status: 'existing', new_sector_candidate: false, sector_id: existing.rows[0].id }
    ]
    for (const [index, normalizedData] of staged.entries()) {
      await client.query(
        'INSERT INTO staging_excel_rows (batch_id, source_row_number, normalized_data, validation_status) VALUES (10, $1, $2, \'valid\')',
        [index + 2, JSON.stringify(normalizedData)]
      )
    }

    const created = await registerSectorsForBatch(client, 10)
    assert.equal(created.length, 1)
    assert.equal(created[0].code, 'NFC PRIVATE 2')

    const stagedResult = await client.query(`
      SELECT normalized_data->>'source_sector_code' AS source_sector_code,
             normalized_data->>'sector_id' AS sector_id,
             normalized_data->>'new_sector_candidate' AS candidate
      FROM staging_excel_rows
      WHERE batch_id = 10
      ORDER BY source_row_number
    `)
    assert.equal(stagedResult.rows[0].sector_id, String(created[0].id))
    assert.equal(stagedResult.rows[1].sector_id, String(created[0].id))
    assert.equal(stagedResult.rows[2].sector_id, String(existing.rows[0].id))
    assert.ok(stagedResult.rows.every(row => row.candidate === 'false'))
    const aliasCount = await client.query('SELECT COUNT(*)::INTEGER AS count FROM sector_aliases')
    assert.equal(aliasCount.rows[0].count, 1)
    await client.query('COMMIT')

    await client.query('BEGIN')
    await client.query(`
      INSERT INTO staging_excel_rows (batch_id, source_row_number, normalized_data, validation_status)
      VALUES (11, 2, $1, 'valid')
    `, [JSON.stringify({
      source_sector_code: 'ROLLBACK SECTOR',
      sector_status: 'new_sector_candidate',
      new_sector_candidate: true,
      sector_id: null
    })])
    await registerSectorsForBatch(client, 11)
    await client.query('ROLLBACK')
    const rolledBack = await client.query("SELECT COUNT(*)::INTEGER AS count FROM sectors WHERE code = 'ROLLBACK SECTOR'")
    assert.equal(rolledBack.rows[0].count, 0)
  } finally {
    await client.end()
  }
})

test('PostgreSQL numeric mapping preserves NULL, zero, precision, and negative values', {
  skip: process.env.RUN_SECTOR_POSTGRES_TESTS !== '1'
}, async () => {
  assert.notEqual(testDatabase, process.env.DB_NAME || 'bps_dashboard')
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: testDatabase,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
  })

  await client.connect()
  try {
    await client.query('CREATE TEMP TABLE numeric_value_test (nilai NUMERIC(38,18), value_status VARCHAR(30))')
    await client.query('BEGIN')
    for (const [value, status] of [
      [null, 'empty'],
      ['0', 'valid'],
      ['184.39306605199400', 'valid'],
      ['-150.25', 'valid']
    ]) {
      await client.query('INSERT INTO numeric_value_test (nilai, value_status) VALUES ($1, $2)', [value, status])
    }

    const result = await client.query('SELECT nilai::TEXT AS nilai, value_status FROM numeric_value_test ORDER BY ctid')
    assert.deepEqual(result.rows, [
      { nilai: null, value_status: 'empty' },
      { nilai: '0.000000000000000000', value_status: 'valid' },
      { nilai: '184.393066051994000000', value_status: 'valid' },
      { nilai: '-150.250000000000000000', value_status: 'valid' }
    ])
    await client.query('ROLLBACK')
  } finally {
    await client.end()
  }
})