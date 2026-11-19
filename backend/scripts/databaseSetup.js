#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { Pool } = require('pg');

const MIGRATIONS = [
  '001_create_staging_tables.sql',
  '002_create_core_tables.sql',
  '003_add_value_quality_fields.sql',
  '004_create_sheet_views.sql',
  '005_create_excel_import_versioning.sql',
  '006_enforce_versioned_data_integrity.sql',
  '007_official_sector_name_aliases.sql',
  '008_grouped_workbook_imports.sql'
];

const IMPORTANT_TABLES = [
  'characteristic_data',
  'ratio_data',
  'macro_transactions',
  'sectors',
  'sector_aliases',
  'data_import_batches',
  'staging_excel_rows',
  'data_period_versions',
  'data_change_events'
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--output') args.output = argv[i + 1];
    if (argv[i] === '--backup') args.backup = argv[i + 1];
    if (argv[i] === '--database') args.database = argv[i + 1];
  }
  return args;
}

function quoteIdentifier(identifier) {
  if (!/^[_a-zA-Z][-_a-zA-Z0-9]*$/.test(identifier)) {
    throw new Error('Nama database mengandung karakter tidak valid.');
  }
  return `"${identifier.replace(/"/g, '""')}"`;
}

function getConfig(args = {}) {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: args.database || process.env.DB_NAME || 'bps_dashboard',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
  };
}

function validateTargetDatabase(database) {
  if (!database || ['postgres', 'template0', 'template1'].includes(database.toLowerCase())) {
    throw new Error(`Database target tidak aman: "${database}". Gunakan database aplikasi terpisah.`);
  }
}

function findPostgresExecutable(name) {
  const versionDir = 'C:\\Program Files\\PostgreSQL\\17\\bin';
  const candidates = [
    path.join(versionDir, `${name}.exe`),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'PostgreSQL', '17', 'bin', `${name}.exe`),
    path.join(process.cwd(), 'node_modules', '.bin', `${name}.exe`)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  const pathEntries = (process.env.PATH || '').split(path.delimiter);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, process.platform === 'win32' ? `${name}.exe` : name);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`${name} tidak ditemukan. Instal PostgreSQL 17 atau tambahkan bin PostgreSQL ke PATH.`);
}

function runProcess(executable, args, env = process.env, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd || process.cwd(),
      env,
      windowsHide: true,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
    });
    let stdout = '';
    let stderr = '';
    if (options.capture) {
      child.stdout.on('data', chunk => { stdout += chunk.toString(); });
      child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    }
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) return resolve({ code, stdout, stderr });
      const error = new Error(stderr.trim() || `Perintah gagal dengan exit code ${code}.`);
      error.code = code;
      reject(error);
    });
  });
}

async function createPool(config, database = config.database) {
  return new Pool({ ...config, database, connectionTimeoutMillis: 5000 });
}

async function ensureDatabase(config) {
  validateTargetDatabase(config.database);
  const maintenance = await createPool(config, 'postgres');
  try {
    await maintenance.query('SELECT 1');
    const result = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.database]);
    if (result.rowCount > 0) return { created: false };
    await maintenance.query(`CREATE DATABASE ${quoteIdentifier(config.database)} ENCODING 'UTF8'`);
    return { created: true };
  } finally {
    await maintenance.end();
  }
}

async function inspectDatabase(config) {
  const pool = await createPool(config);
  try {
    const result = await pool.query(`
      SELECT c.relname AS table_name,
             (SELECT COUNT(*) FROM pg_class pc WHERE pc.oid = c.oid) AS exists
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname
    `);
    return { tableNames: result.rows.map(row => row.table_name) };
  } finally {
    await pool.end();
  }
}

async function inspectData(config) {
  const pool = await createPool(config);
  try {
    const tableResult = await pool.query(`
      SELECT c.relname AS table_name
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname
    `);
    const tableNames = tableResult.rows.map(row => row.table_name);
    let dataRows = 0;
    for (const tableName of tableNames) {
      const result = await pool.query(`SELECT COUNT(*)::BIGINT AS count FROM ${quoteIdentifier(tableName)}`);
      dataRows += Number(result.rows[0].count);
    }
    return { tableNames, dataRows };
  } finally {
    await pool.end();
  }
}

async function runMigrations(config) {
  const pool = await createPool(config);
  const migrationDir = path.resolve(__dirname, '../database/migrations');
  try {
    for (const filename of MIGRATIONS) {
      const sqlPath = path.join(migrationDir, filename);
      if (!fs.existsSync(sqlPath)) throw new Error(`Migration tidak ditemukan: ${filename}`);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log(`Menjalankan migration ${filename}...`);
      await pool.query(sql);
    }
  } finally {
    await pool.end();
  }
}

async function validateArchive(backupPath) {
  const executable = findPostgresExecutable('pg_restore');
  const result = await runProcess(executable, ['--list', backupPath], process.env, { capture: true });
  const lines = result.stdout.split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) throw new Error('Archive PostgreSQL tidak memiliki objek database.');
  return { executable, objectCount: lines.length };
}

async function validateBackupFile(backupPath) {
  if (!fs.existsSync(backupPath)) throw new Error(`Backup tidak ditemukan: ${backupPath}`);
  const stat = fs.statSync(backupPath);
  if (!stat.isFile() || stat.size === 0) throw new Error(`File backup kosong atau bukan file: ${backupPath}`);
  return stat;
}

async function restoreBackup(config, backupPath) {
  await validateBackupFile(backupPath);
  await validateArchive(backupPath);
  const state = await inspectData(config);
  if (state.tableNames.length > 0 || state.dataRows > 0) {
    throw new Error('Restore dihentikan: database target sudah memiliki tabel atau data. Buat database kosong dan ulangi restore.');
  }

  const pgRestore = findPostgresExecutable('pg_restore');
  const env = { ...process.env };
  if (config.password) env.PGPASSWORD = config.password;
  await runProcess(pgRestore, [
    '--host', config.host,
    '--port', String(config.port),
    '--username', config.user,
    '--dbname', config.database,
    '--no-owner',
    '--no-acl',
    '--exit-on-error',
    backupPath
  ], env);
}

async function validateRestoredDatabase(config) {
  const pool = await createPool(config);
  try {
    const missing = [];
    for (const tableName of IMPORTANT_TABLES) {
      const result = await pool.query("SELECT to_regclass($1) AS present", [`public.${tableName}`]);
      if (!result.rows[0].present) missing.push(tableName);
    }
    if (missing.length) throw new Error(`Restore tidak lengkap; tabel penting hilang: ${missing.join(', ')}`);

    const counts = {};
    for (const tableName of ['characteristic_data', 'ratio_data', 'data_period_versions', 'sectors', 'sector_aliases']) {
      const result = await pool.query(`SELECT COUNT(*)::BIGINT AS count FROM ${quoteIdentifier(tableName)}`);
      counts[tableName] = Number(result.rows[0].count);
    }

    const activeResult = await pool.query("SELECT COUNT(*)::BIGINT AS count FROM data_period_versions WHERE status = 'active'");
    counts.active_versions = Number(activeResult.rows[0].count);

    const aliasResult = await pool.query("SELECT COUNT(*)::BIGINT AS count FROM sector_aliases WHERE source_code = 'TOTAL EKONOMI (TOTAL ECONOMY)' ");
    counts.official_migration_007_alias = Number(aliasResult.rows[0].count);

      const sequenceResult = await pool.query("SELECT COUNT(*)::BIGINT AS count FROM pg_sequences WHERE schemaname = 'public'");
    counts.public_sequences = Number(sequenceResult.rows[0].count);

    if (counts.public_sequences > 0) {
      const usableSequence = await pool.query(`
        SELECT COUNT(*)::BIGINT AS count
        FROM pg_sequences
        WHERE schemaname = 'public'
          AND has_sequence_privilege(quote_ident(schemaname) || '.' || quote_ident(sequencename), 'USAGE')
      `);
      counts.usable_public_sequences = Number(usableSequence.rows[0].count);
    }

    if (counts.characteristic_data === 0 && counts.ratio_data === 0 && counts.data_period_versions === 0) {
      throw new Error('Restore menghasilkan database tanpa snapshot transaksi dan versi; archive tidak dianggap berhasil.');
    }

    return counts;
  } finally {
    await pool.end();
  }
}

async function backupDatabase(config, outputPath) {
  await validateTargetDatabase(config.database);
  const pgDump = findPostgresExecutable('pg_dump');
  const resolvedOutput = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  const env = { ...process.env };
  if (config.password) env.PGPASSWORD = config.password;

  try {
    await runProcess(pgDump, [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--host', config.host,
      '--port', String(config.port),
      '--username', config.user,
      '--file', resolvedOutput,
      config.database
    ], env);
  } catch (error) {
    if (fs.existsSync(resolvedOutput)) fs.rmSync(resolvedOutput, { force: true });
    throw error;
  }

  const stat = await validateBackupFile(resolvedOutput);
  await validateArchive(resolvedOutput);
  return { outputPath: resolvedOutput, sizeBytes: stat.size };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = process.argv[2] === 'backup' ? 'backup' : 'setup';
  const config = getConfig(args);

  if (mode === 'backup') {
    const outputPath = args.output || path.resolve(__dirname, '../database/backups/bps_dashboard_full.backup');
    console.log(`Memvalidasi koneksi PostgreSQL ${config.host}:${config.port}/${config.database}...`);
    const result = await backupDatabase(config, outputPath);
    console.log(`Backup selesai: ${result.outputPath}`);
    console.log(`Ukuran backup: ${result.sizeBytes} bytes`);
    console.log('Validasi pg_restore --list berhasil.');
    return;
  }

  console.log(`Memeriksa PostgreSQL ${config.host}:${config.port}...`);
  console.log(`Target database: ${config.database}`);

  if (args.backup) {
    const backupPath = path.resolve(args.backup);
    await validateBackupFile(backupPath);
    await validateArchive(backupPath);
    await ensureDatabase(config);
    await restoreBackup(config, backupPath);
    const counts = await validateRestoredDatabase(config);
    console.log('Restore full backup selesai dan tervalidasi.');
    console.log(`Tabel transaksi: characteristic_data=${counts.characteristic_data}, ratio_data=${counts.ratio_data}`);
    console.log(`Versi: data_period_versions=${counts.data_period_versions}, aktif=${counts.active_versions}`);
    console.log(`Sektor: sectors=${counts.sectors}, alias=${counts.sector_aliases}, migration_007_alias=${counts.official_migration_007_alias}`);
    console.log(`Sequence public: ${counts.public_sequences}`);
    return;
  }

  const ensureResult = await ensureDatabase(config);
  const state = await inspectData(config);
  if (state.tableNames.length > 0 || state.dataRows > 0) {
    throw new Error('Database sudah berisi tabel atau data. Setup fresh dihentikan tanpa overwrite; gunakan database baru atau restore full backup ke database kosong.');
  }
  await runMigrations(config);
  const finalState = await inspectDatabase(config);
  const missing = IMPORTANT_TABLES.filter(tableName => !finalState.tableNames.includes(tableName));
  if (missing.length) throw new Error(`Fresh setup tidak lengkap; tabel hilang: ${missing.join(', ')}`);

  console.log(ensureResult.created ? 'Database baru berhasil dibuat.' : 'Database target sudah tersedia.');
  console.log('Fresh setup selesai melalui migration existing 001-008.');
  console.log('PERINGATAN: database ini belum mengandung snapshot transaksi dari database developer.');
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Database setup gagal: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  MIGRATIONS,
  IMPORTANT_TABLES,
  parseArgs,
  getConfig,
  validateTargetDatabase,
  findPostgresExecutable,
  runProcess,
  ensureDatabase,
  inspectDatabase,
  inspectData,
  runMigrations,
  validateArchive,
  validateBackupFile,
  restoreBackup,
  validateRestoredDatabase,
  backupDatabase
};
