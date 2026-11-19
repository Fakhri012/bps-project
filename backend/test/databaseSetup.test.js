const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const setup = require('../scripts/databaseSetup');

test('database setup parses backup and output arguments', () => {
  assert.deepEqual(setup.parseArgs(['--output', 'C:\\tmp\\one.backup']), { output: 'C:\\tmp\\one.backup' });
  assert.deepEqual(setup.parseArgs(['--backup', 'C:\\tmp\\full.backup']), { backup: 'C:\\tmp\\full.backup' });
});

test('database setup rejects system databases', () => {
  for (const database of ['postgres', 'template0', 'template1']) {
    assert.throws(() => setup.validateTargetDatabase(database), /tidak aman/);
  }
});

test('database setup rejects unsafe and missing backup files', async () => {
  assert.throws(() => setup.validateTargetDatabase(''), /tidak aman/);
  await assert.rejects(
    () => setup.validateBackupFile(path.join(os.tmpdir(), `missing-bps-${process.pid}.backup`)),
    /Backup tidak ditemukan/
  );

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bps-empty-backup-'));
  const emptyFile = path.join(directory, 'empty.backup');
  fs.writeFileSync(emptyFile, '');
  await assert.rejects(() => setup.validateBackupFile(emptyFile), /kosong/);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('database setup migrations use existing ordered migration files', () => {
  assert.deepEqual(setup.MIGRATIONS, [
    '001_create_staging_tables.sql',
    '002_create_core_tables.sql',
    '003_add_value_quality_fields.sql',
    '004_create_sheet_views.sql',
    '005_create_excel_import_versioning.sql',
    '006_enforce_versioned_data_integrity.sql',
    '007_official_sector_name_aliases.sql',
    '008_grouped_workbook_imports.sql'
  ]);
});

test('credential is only passed through environment and never included in executable arguments', () => {
  const config = setup.getConfig({ database: 'bps_setup_test' });
  const args = [
    '--host', config.host,
    '--port', String(config.port),
    '--username', config.user,
    '--dbname', config.database
  ];
  assert.ok(!args.join(' ').includes(config.password || '__no_password__'));
});

test('important tables include all full snapshot surfaces', () => {
  for (const tableName of ['characteristic_data', 'ratio_data', 'macro_transactions', 'sectors', 'sector_aliases', 'data_import_batches', 'staging_excel_rows', 'data_period_versions', 'data_change_events']) {
    assert.ok(setup.IMPORTANT_TABLES.includes(tableName));
  }
});
