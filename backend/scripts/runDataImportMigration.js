
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const pool = require('../src/config/postgres');

const MIGRATION_FILE = path.join(
    __dirname,
    '../database/migrations/005_create_excel_import_versioning.sql'
);

const REQUIRED_TABLES = [
    'characteristic_data',
    'ratio_data',
    'macro_transactions',
    'staging_google_sheets_rows',
    'sectors'
];

const REQUIRED_NEW_TABLES = [
    'data_import_batches',
    'staging_excel_rows',
    'data_period_versions',
    'data_change_events'
];

/*
|--------------------------------------------------------------------------
| HELPER: CORE DATA COUNTS
|--------------------------------------------------------------------------
*/

async function getCoreCounts(client) {
    const result = await client.query(`
        SELECT
            (SELECT COUNT(*) FROM characteristic_data)::BIGINT
                AS characteristic,
            (SELECT COUNT(*) FROM ratio_data)::BIGINT
                AS ratio,
            (SELECT COUNT(*) FROM macro_transactions)::BIGINT
                AS macro
    `);

    return {
        characteristic: Number(result.rows[0].characteristic),
        ratio: Number(result.rows[0].ratio),
        macro: Number(result.rows[0].macro)
    };
}

/*
|--------------------------------------------------------------------------
| HELPER: REQUIRED TABLE CHECK
|--------------------------------------------------------------------------
*/

async function verifyTables(client, tables) {
    const result = await client.query(
        `
        SELECT
            table_name,
            to_regclass('public.' || table_name) AS relation
        FROM unnest($1::TEXT[]) AS t(table_name)
        `,
        [tables]
    );

    const missing = result.rows
        .filter(row => row.relation === null)
        .map(row => row.table_name);

    if (missing.length > 0) {
        throw new Error(
            `Tabel tidak ditemukan: ${missing.join(', ')}`
        );
    }
}

/*
|--------------------------------------------------------------------------
| HELPER: CHECK MIGRATION NOT APPLIED
|--------------------------------------------------------------------------
*/

async function verifyMigrationNotApplied(client) {
    const result = await client.query(`
        SELECT
            to_regclass('public.data_import_batches')
                AS import_batches,
            to_regclass('public.staging_excel_rows')
                AS excel_staging,
            to_regclass('public.data_period_versions')
                AS period_versions,
            to_regclass('public.data_change_events')
                AS change_events
    `);

    const existing = Object.entries(result.rows[0])
        .filter(([, value]) => value !== null)
        .map(([key]) => key);

    if (existing.length > 0) {
        throw new Error(
            'Sebagian tabel versioning sudah tersedia. ' +
            'Migration tidak dijalankan ulang secara otomatis. ' +
            `Tabel ditemukan: ${existing.join(', ')}`
        );
    }
}

/*
|--------------------------------------------------------------------------
| HELPER: STRIP TRANSACTION STATEMENTS
|--------------------------------------------------------------------------
|
| Transaksi dikelola oleh script ini.
| BEGIN dan COMMIT dari file SQL harus dihapus terlebih dahulu.
|
| Hanya statement BEGIN/COMMIT yang berdiri sendiri pada satu baris
| yang akan dihapus. BEGIN di dalam DO $$ ... $$ tetap dipertahankan.
|--------------------------------------------------------------------------
*/

function prepareMigrationSQL(sql) {
    const beginPattern =
        /^[ \t]*BEGIN[ \t]*;[ \t]*(?:--[^\r\n]*)?$/gim;

    const commitPattern =
        /^[ \t]*COMMIT[ \t]*;[ \t]*(?:--[^\r\n]*)?$/gim;

    const beginMatches = sql.match(beginPattern) || [];
    const commitMatches = sql.match(commitPattern) || [];

    if (beginMatches.length !== 1) {
        throw new Error(
            `Migration harus memiliki tepat satu BEGIN; ` +
            `ditemukan ${beginMatches.length}.`
        );
    }

    if (commitMatches.length !== 1) {
        throw new Error(
            `Migration harus memiliki tepat satu COMMIT; ` +
            `ditemukan ${commitMatches.length}.`
        );
    }

    return sql
        .replace(beginPattern, '')
        .replace(commitPattern, '');
}

/*
|--------------------------------------------------------------------------
| HELPER: VERIFY CORE COUNTS
|--------------------------------------------------------------------------
*/

async function verifyCoreCounts(client, beforeCounts) {
    const afterCounts = await getCoreCounts(client);

    for (const key of Object.keys(beforeCounts)) {
        if (beforeCounts[key] !== afterCounts[key]) {
            throw new Error(
                `Jumlah ${key} berubah: ` +
                `sebelum ${beforeCounts[key]}, ` +
                `sesudah ${afterCounts[key]}.`
            );
        }
    }

    return afterCounts;
}

/*
|--------------------------------------------------------------------------
| HELPER: VERIFY DATA REFERENCES
|--------------------------------------------------------------------------
*/

async function verifyDataReferences(client) {
    const checks = [
        {
            name: 'characteristic_data',
            sql: `
                SELECT
                    COUNT(*) FILTER (
                        WHERE d.period_version_id IS NULL
                           OR d.source_order IS NULL
                           OR v.id IS NULL
                           OR v.status <> 'active'
                           OR (
                               d.staging_row_id IS NULL
                               AND d.excel_staging_row_id IS NULL
                           )
                           OR (
                               d.staging_row_id IS NOT NULL
                               AND d.excel_staging_row_id IS NOT NULL
                           )
                    )::BIGINT AS invalid_rows
                FROM characteristic_data d
                LEFT JOIN data_period_versions v
                    ON v.id = d.period_version_id
                   AND v.dataset_key = d.source_key
                   AND v.period_type = d.period_type
                   AND v.year = d.year
                   AND v.quarter IS NOT DISTINCT FROM d.quarter
            `
        },
        {
            name: 'ratio_data',
            sql: `
                SELECT
                    COUNT(*) FILTER (
                        WHERE d.period_version_id IS NULL
                           OR d.source_order IS NULL
                           OR v.id IS NULL
                           OR v.status <> 'active'
                           OR (
                               d.staging_row_id IS NULL
                               AND d.excel_staging_row_id IS NULL
                           )
                           OR (
                               d.staging_row_id IS NOT NULL
                               AND d.excel_staging_row_id IS NOT NULL
                           )
                    )::BIGINT AS invalid_rows
                FROM ratio_data d
                LEFT JOIN data_period_versions v
                    ON v.id = d.period_version_id
                   AND v.dataset_key = 'analisis_rasio'
                   AND v.period_type = d.period_type
                   AND v.year = d.year
                   AND v.quarter IS NOT DISTINCT FROM d.quarter
            `
        },
        {
            name: 'macro_transactions',
            sql: `
                SELECT
                    COUNT(*) FILTER (
                        WHERE d.period_version_id IS NULL
                           OR d.source_order IS NULL
                           OR v.id IS NULL
                           OR v.status <> 'active'
                           OR (
                               d.staging_row_id IS NULL
                               AND d.excel_staging_row_id IS NULL
                           )
                           OR (
                               d.staging_row_id IS NOT NULL
                               AND d.excel_staging_row_id IS NOT NULL
                           )
                    )::BIGINT AS invalid_rows
                FROM macro_transactions d
                LEFT JOIN data_period_versions v
                    ON v.id = d.period_version_id
                   AND v.dataset_key = 'banding_makro'
                   AND v.period_type = CASE
                       WHEN d.quarter IS NULL THEN 'annual'
                       ELSE 'quarterly'
                   END
                   AND v.year = d.year
                   AND v.quarter IS NOT DISTINCT FROM d.quarter
            `
        }
    ];

    for (const check of checks) {
        const result = await client.query(check.sql);

        const invalidRows = Number(
            result.rows[0].invalid_rows
        );

        console.log(
            `${check.name}: ${invalidRows} baris tidak valid`
        );

        if (invalidRows !== 0) {
            throw new Error(
                `Validasi relasi ${check.name} gagal. ` +
                `Ditemukan ${invalidRows} baris tidak valid.`
            );
        }
    }
}

/*
|--------------------------------------------------------------------------
| HELPER: VERIFY ACTIVE VERSIONS
|--------------------------------------------------------------------------
*/

async function verifyActiveVersions(client) {
    const result = await client.query(`
        SELECT COUNT(*)::INTEGER AS duplicate_groups
        FROM (
            SELECT
                dataset_key,
                period_type,
                year,
                quarter
            FROM data_period_versions
            WHERE status = 'active'
            GROUP BY
                dataset_key,
                period_type,
                year,
                quarter
            HAVING COUNT(*) > 1
        ) duplicates
    `);

    const duplicateGroups = Number(
        result.rows[0].duplicate_groups
    );

    if (duplicateGroups !== 0) {
        throw new Error(
            `Ditemukan ${duplicateGroups} periode dengan ` +
            'lebih dari satu versi aktif.'
        );
    }

    console.log('Versi aktif: tidak ada duplikasi.');
}

/*
|--------------------------------------------------------------------------
| HELPER: VERIFY VERSION ROW COUNTS
|--------------------------------------------------------------------------
*/

async function verifyVersionRowCounts(client, coreCounts) {
    const result = await client.query(`
        SELECT
            COALESCE(
                SUM(row_count) FILTER (
                    WHERE dataset_key IN (
                        'tahunan',
                        'triwulanan_1',
                        'triwulanan_2'
                    )
                ),
                0
            )::BIGINT AS characteristic,

            COALESCE(
                SUM(row_count) FILTER (
                    WHERE dataset_key = 'analisis_rasio'
                ),
                0
            )::BIGINT AS ratio,

            COALESCE(
                SUM(row_count) FILTER (
                    WHERE dataset_key = 'banding_makro'
                ),
                0
            )::BIGINT AS macro

        FROM data_period_versions
        WHERE status = 'active'
    `);

    const versionCounts = {
        characteristic: Number(result.rows[0].characteristic),
        ratio: Number(result.rows[0].ratio),
        macro: Number(result.rows[0].macro)
    };

    for (const key of Object.keys(coreCounts)) {
        if (versionCounts[key] !== coreCounts[key]) {
            throw new Error(
                `Jumlah baris versi ${key} tidak cocok. ` +
                `Data utama: ${coreCounts[key]}, ` +
                `jumlah versi: ${versionCounts[key]}.`
            );
        }
    }

    console.log('Jumlah baris versi cocok dengan data utama.');

    return versionCounts;
}

/*
|--------------------------------------------------------------------------
| HELPER: MIGRATION SUMMARY
|--------------------------------------------------------------------------
*/

async function printMigrationSummary(client, coreCounts) {
    const result = await client.query(`
        SELECT
            dataset_key,
            period_type,
            COUNT(*)::INTEGER AS total_periods,
            SUM(row_count)::BIGINT AS total_rows
        FROM data_period_versions
        WHERE status = 'active'
        GROUP BY
            dataset_key,
            period_type
        ORDER BY
            dataset_key,
            period_type
    `);

    console.log('\n====================================');
    console.log('MIGRATION SUMMARY');
    console.log('====================================');

    console.table(result.rows);

    console.log('\nData utama:');

    console.table([{
        characteristic: coreCounts.characteristic,
        ratio: coreCounts.ratio,
        macro: coreCounts.macro,
        total:
            coreCounts.characteristic +
            coreCounts.ratio +
            coreCounts.macro
    }]);
}

/*
|--------------------------------------------------------------------------
| MAIN
|--------------------------------------------------------------------------
*/

async function main() {
    let client;
    let transactionStarted = false;

    try {
        console.log('====================================');
        console.log('EXCEL IMPORT VERSIONING MIGRATION');
        console.log('====================================');

        // -------------------------------------------------
        // 1. CHECK MIGRATION FILE
        // -------------------------------------------------

        if (!fs.existsSync(MIGRATION_FILE)) {
            throw new Error(
                'File Migration 005 tidak ditemukan: ' +
                MIGRATION_FILE
            );
        }

        const sql = fs.readFileSync(
            MIGRATION_FILE,
            'utf8'
        );

        const migrationBody = prepareMigrationSQL(sql);

        console.log('Migration file ditemukan.');
        console.log('Struktur transaksi SQL valid.');

        // -------------------------------------------------
        // 2. CONNECT POSTGRESQL
        // -------------------------------------------------

        client = await pool.connect();

        console.log('PostgreSQL connection established.');

        // -------------------------------------------------
        // 3. PRE-MIGRATION CHECKS
        // -------------------------------------------------

        await verifyTables(client, REQUIRED_TABLES);

        await verifyMigrationNotApplied(client);

        const beforeCounts = await getCoreCounts(client);

        console.log('\nJumlah data sebelum migration:');

        console.table([beforeCounts]);

        console.log(
            'Total:',
            beforeCounts.characteristic +
            beforeCounts.ratio +
            beforeCounts.macro
        );

        // -------------------------------------------------
        // 4. BEGIN TRANSACTION
        // -------------------------------------------------

        await client.query('BEGIN');

        transactionStarted = true;

        console.log('\nTransaksi dimulai.');

        // -------------------------------------------------
        // 5. EXECUTE MIGRATION
        // -------------------------------------------------

        console.log('\nMenjalankan Migration 005...');

        await client.query(migrationBody);

        console.log('SQL Migration 005 selesai.');

        // -------------------------------------------------
        // 6. VERIFY NEW TABLES
        // -------------------------------------------------

        await verifyTables(
            client,
            REQUIRED_NEW_TABLES
        );

        console.log('Seluruh tabel versioning tersedia.');

        // -------------------------------------------------
        // 7. VERIFY CORE DATA COUNTS
        // -------------------------------------------------

        const afterCounts = await verifyCoreCounts(
            client,
            beforeCounts
        );

        console.log('\nJumlah data sesudah migration:');

        console.table([afterCounts]);

        // -------------------------------------------------
        // 8. VERIFY PERIOD REFERENCES
        // -------------------------------------------------

        await verifyDataReferences(client);

        // -------------------------------------------------
        // 9. VERIFY ACTIVE VERSIONS
        // -------------------------------------------------

        await verifyActiveVersions(client);

        // -------------------------------------------------
        // 10. VERIFY VERSION ROW COUNTS
        // -------------------------------------------------

        await verifyVersionRowCounts(
            client,
            afterCounts
        );

        // -------------------------------------------------
        // 11. PRINT SUMMARY
        // -------------------------------------------------

        await printMigrationSummary(
            client,
            afterCounts
        );

        // -------------------------------------------------
        // 12. COMMIT
        // -------------------------------------------------

        await client.query('COMMIT');

        transactionStarted = false;

        console.log('\n====================================');
        console.log('MIGRATION 005 SUCCESSFUL');
        console.log('====================================');

        console.log(
            'Semua data lama tetap tersedia.'
        );

        console.log(
            'Seluruh data utama telah memiliki versi aktif.'
        );

        console.log(
            'Tidak ada perubahan jumlah baris data utama.'
        );

    } catch (error) {
        console.error('\n====================================');
        console.error('MIGRATION 005 FAILED');
        console.error('====================================');

        console.error(error.message);

        if (client && transactionStarted) {
            try {
                await client.query('ROLLBACK');

                transactionStarted = false;

                console.log(
                    'Migration berhasil di-rollback.'
                );

            } catch (rollbackError) {
                console.error(
                    'Rollback gagal:',
                    rollbackError.message
                );
            }
        }

        process.exitCode = 1;

    } finally {
        if (client) {
            client.release();
        }

        await pool.end();
    }
}

main().catch(error => {
    console.error('Fatal migration error:', error);
    process.exitCode = 1;
});
