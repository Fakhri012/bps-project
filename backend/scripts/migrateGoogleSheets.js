
require('dotenv').config();

const pool = require('../src/config/postgres');

const {
    getMigrationSourceData
} = require('../services/googleSheetsService');

const BATCH_SIZE = 500;

const SOURCE_CONFIG = [
    {
        key: 'tahunan',
        sheetName: 'Karakteristik & Pivot Tahunan'
    },
    {
        key: 'triwulanan_1',
        sheetName: 'Karakteristik & Pivot Triwulanan'
    },
    {
        key: 'triwulanan_2',
        sheetName: 'Karakteristik & Pivot Triwulan 2'
    },
    {
        key: 'analisis_rasio',
        sheetName: 'Analisis Rasio'
    },
    {
        key: 'banding_makro',
        sheetName: 'Banding Makro'
    }
];

async function insertSourceRows(client, batchId, source) {
    const { key, sheetName, rows } = source;

    let inserted = 0;

    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
        const chunk = rows.slice(start, start + BATCH_SIZE);
        const values = [];

        const placeholders = chunk.map((row, index) => {
            const base = index * 5;

            values.push(
                batchId,
                key,
                sheetName,
                start + index + 1,
                JSON.stringify(row)
            );

            return `(
                $${base + 1},
                $${base + 2},
                $${base + 3},
                $${base + 4},
                $${base + 5}::jsonb
            )`;
        });

        await client.query(
            `
            INSERT INTO staging_google_sheets_rows (
                batch_id,
                source_key,
                source_sheet_name,
                source_record_index,
                raw_data
            )
            VALUES ${placeholders.join(',')}
            `,
            values
        );

        inserted += chunk.length;

        console.log(
            `[${key}] ${inserted}/${rows.length} baris dimasukkan`
        );
    }

    return inserted;
}

async function main() {
    let batchId = null;
    let client = null;
    let transactionStarted = false;

    try {
        console.log('======================================');
        console.log('GOOGLE SHEETS TO POSTGRESQL MIGRATION');
        console.log('======================================');

        // 1. Ambil seluruh data dari lima Google Sheets
        console.log('\nMengambil data Google Sheets...');

        const data = await getMigrationSourceData();

        // 2. Siapkan daftar sumber data
        const sources = SOURCE_CONFIG.map(source => ({
            ...source,
            rows: data[
                source.key === 'triwulanan_1'
                    ? 'triwulanan1'
                    : source.key === 'triwulanan_2'
                        ? 'triwulanan2'
                        : source.key === 'analisis_rasio'
                            ? 'analisisRasio'
                            : source.key === 'banding_makro'
                                ? 'bandingMakro'
                                : 'tahunan'
            ] || []
        }));

        const sourceCounts = Object.fromEntries(
            sources.map(source => [
                source.key,
                source.rows.length
            ])
        );

        const totalRows = Object.values(sourceCounts)
            .reduce((sum, count) => sum + count, 0);

        console.log('\nRingkasan data sumber:');

        for (const source of sources) {
            console.log(
                `${source.sheetName}: ${source.rows.length} baris`
            );
        }

        console.log(`TOTAL: ${totalRows} baris`);

        // 3. Buat riwayat batch
        const batchResult = await pool.query(
            `
            INSERT INTO migration_batches (
                batch_type,
                status,
                source_row_counts,
                total_rows,
                notes
            )
            VALUES (
                'google_sheets',
                'processing',
                $1::jsonb,
                $2,
                'Import seluruh lima sumber Google Sheets ke staging'
            )
            RETURNING id
            `,
            [
                JSON.stringify(sourceCounts),
                totalRows
            ]
        );

        batchId = batchResult.rows[0].id;

        console.log(`\nMigration Batch ID: ${batchId}`);

        // 4. Mulai transaksi
        client = await pool.connect();

        await client.query('BEGIN');
        transactionStarted = true;

        // 5. Masukkan seluruh baris secara batch
        let totalInserted = 0;

        for (const source of sources) {
            console.log(`\nMemproses: ${source.sheetName}`);

            const inserted = await insertSourceRows(
                client,
                batchId,
                source
            );

            totalInserted += inserted;
        }

        // 6. Validasi jumlah data dalam database
        const validation = await client.query(
            `
            SELECT
                source_key,
                COUNT(*)::INTEGER AS total
            FROM staging_google_sheets_rows
            WHERE batch_id = $1
            GROUP BY source_key
            `,
            [batchId]
        );

        const actualCounts = Object.fromEntries(
            validation.rows.map(row => [
                row.source_key,
                Number(row.total)
            ])
        );

        for (const source of sources) {
            const expected = source.rows.length;
            const actual = actualCounts[source.key] || 0;

            if (expected !== actual) {
                throw new Error(
                    `Validasi gagal untuk ${source.key}: ` +
                    `Expected ${expected}, actual ${actual}`
                );
            }
        }

        if (totalInserted !== totalRows) {
            throw new Error(
                `Total insert tidak sesuai: ${totalInserted}/${totalRows}`
            );
        }

        // 7. Tandai batch selesai
        await client.query(
            `
            UPDATE migration_batches
            SET
                status = 'completed',
                finished_at = NOW(),
                notes = $2
            WHERE id = $1
            `,
            [
                batchId,
                `Berhasil mengimpor ${totalInserted} baris ke staging`
            ]
        );

        await client.query('COMMIT');
        transactionStarted = false;

        console.log('\n======================================');
        console.log('MIGRATION COMPLETED SUCCESSFULLY');
        console.log('======================================');

        console.log('Batch ID:', batchId);
        console.log('Total data:', totalInserted);

        for (const source of sources) {
            console.log(
                `${source.key}: ${actualCounts[source.key] || 0}`
            );
        }

    } catch (error) {
        if (client && transactionStarted) {
            await client.query('ROLLBACK');
            transactionStarted = false;
        }

        if (batchId !== null) {
            try {
                await pool.query(
                    `
                    UPDATE migration_batches
                    SET
                        status = 'failed',
                        finished_at = NOW(),
                        notes = $2
                    WHERE id = $1
                    `,
                    [batchId, error.message]
                );
            } catch (updateError) {
                console.error(
                    'Gagal memperbarui status batch:',
                    updateError.message
                );
            }
        }

        console.error('\nMIGRATION FAILED:');
        console.error(error);

        process.exitCode = 1;

    } finally {
        if (client) client.release();
        await pool.end();
    }
}

main();
