
require('dotenv').config();

const pool = require('../src/config/postgres');

const BATCH_ID = Number(process.env.SOURCE_BATCH_ID || 1);
const PAGE_SIZE = 500;
const INSERT_CHUNK_SIZE = 200;

const SOURCES = [
    {
        key: 'tahunan',
        target: 'characteristic_data',
        type: 'characteristic'
    },
    {
        key: 'triwulanan_1',
        target: 'characteristic_data',
        type: 'characteristic'
    },
    {
        key: 'triwulanan_2',
        target: 'characteristic_data',
        type: 'characteristic'
    },
    {
        key: 'analisis_rasio',
        target: 'ratio_data',
        type: 'ratio'
    },
    {
        key: 'banding_makro',
        target: 'macro_transactions',
        type: 'macro'
    }
];

function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFKC')
        .replace(/\u00A0/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

function getField(row, name) {
    const key = Object.keys(row).find(
        item => normalizeText(item) === normalizeText(name)
    );

    return key !== undefined ? row[key] : undefined;
}

function rawText(value) {
    if (value === undefined || value === null) {
        return null;
    }

    return String(value);
}

function parsePeriod(value) {
    const period = String(value ?? '').trim();

    const match = period.match(
        /^(\d{4})(?:\/Q([1-4]))?$/i
    );

    if (!match) {
        throw new Error(`Format periode tidak valid: ${period}`);
    }

    const year = Number(match[1]);

    const quarter = match[2]
        ? Number(match[2])
        : null;

    if (year < 1900 || year > 2200) {
        throw new Error(`Tahun di luar rentang: ${year}`);
    }

    return {
        period,
        year,
        quarter,
        periodType: quarter === null
            ? 'annual'
            : 'quarterly'
    };
}

function parseNumeric(value) {
    if (value === undefined || value === null) {
        return {
            value: null,
            raw: null,
            status: 'empty'
        };
    }

    const original = String(value);
    let text = original.trim();

    if (!text || ['-', '--', 'N/A', 'NA'].includes(text.toUpperCase())) {
        return {
            value: null,
            raw: original,
            status: 'empty'
        };
    }

    // Jangan menghitung ulang atau mengambil formula.
    // Simpan pesan error dari nilai yang tersedia.
    if (/^#(DIV\/0!|REF!|N\/A|VALUE!|NAME\?|NUM!|NULL!|ERROR!)/i.test(text)) {
        return {
            value: null,
            raw: original,
            status: 'source_error'
        };
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            return {
                value: null,
                raw: original,
                status: 'non_numeric'
            };
        }

        return {
            value: String(value),
            raw: original,
            status: 'valid'
        };
    }

    text = text
        .replace(/\u00A0/g, '')
        .replace(/\s/g, '')
        .replace(/[−–—]/g, '-');

    const hasComma = text.includes(',');
    const hasDot = text.includes('.');

    if (hasComma && hasDot) {
        // Pemisah terakhir dianggap sebagai desimal.
        if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
            // Format Indonesia: 11.494,63
            text = text.replace(/\./g, '').replace(',', '.');
        } else {
            // Format internasional: 11,494.63
            text = text.replace(/,/g, '');
        }
    } else if (hasComma) {
        // Koma tunggal dianggap sebagai desimal.
        text = text.replace(',', '.');
    } else if (hasDot) {
        if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(text)) {
            text = text.replace(/\./g, '');
        } else if (/^-?\d{1,3}\.\d{3}$/.test(text)) {
            // Tidak menebak apakah titik ribuan atau desimal.
            return {
                value: null,
                raw: original,
                status: 'ambiguous'
            };
        }
    }

    if (!/^[+-]?\d+(\.\d+)?$/.test(text)) {
        return {
            value: null,
            raw: original,
            status: 'non_numeric'
        };
    }

    return {
        value: text,
        raw: original,
        status: 'valid'
    };
}

function getSectorId(value, sectorMap) {
    const sourceCode = normalizeText(value);
    const sectorId = sectorMap.get(sourceCode);

    if (!sectorId) {
        throw new Error(
            `Kode sektor belum terdaftar: "${value}"`
        );
    }

    return sectorId;
}

function getCharacteristicRecord(record, sectorMap) {
    const row = record.raw_data;

    const sourceSector = getField(row, 'SEKTOR');

    // Mengecualikan satu header berulang.
    if (normalizeText(sourceSector) === 'SEKTOR') {
        return null;
    }

    const period = parsePeriod(getField(row, 'TAHUN'));
    const parsedValue = parseNumeric(getField(row, 'NILAI'));

    return [
        normalizeText(record.source_key).toLowerCase(),
        period.periodType,
        period.period,
        period.year,
        period.quarter,
        rawText(sourceSector),
        getSectorId(sourceSector, sectorMap),
        rawText(getField(row, 'SISI')),
        rawText(getField(row, 'JENIS NERACA')),
        rawText(getField(row, 'KODE')),
        rawText(getField(row, 'RINCIAN')),
        rawText(getField(row, 'NERACA - RINCIAN')),
        parsedValue.value,
        rawText(getField(row, 'KONSEP')),
        record.id,
        parsedValue.raw,
        parsedValue.status
    ];
}

function getRatioRecord(record, sectorMap) {
    const row = record.raw_data;

    const sourceSector = getField(row, 'SEKTOR');
    const period = parsePeriod(getField(row, 'TAHUN'));
    const parsedValue = parseNumeric(getField(row, 'NILAI'));

    return [
        period.periodType,
        period.period,
        period.year,
        period.quarter,
        rawText(sourceSector),
        getSectorId(sourceSector, sectorMap),
        rawText(getField(row, 'JENIS RASIO')),
        rawText(getField(row, 'KODE')),
        rawText(getField(row, 'RINCIAN')),
        parsedValue.value,
        record.id,
        parsedValue.raw,
        parsedValue.status
    ];
}

function getMacroRecord(record) {
    const row = record.raw_data;

    const period = parsePeriod(getField(row, 'TAHUN'));

    const parsedValue = parseNumeric(
        getField(row, 'TRANSAKSI')
    );

    return [
        period.period,
        period.year,
        period.quarter,
        parsedValue.value,
        record.id,
        parsedValue.raw,
        parsedValue.status
    ];
}

async function upsertRows(client, table, columns, rows) {
    for (
        let start = 0;
        start < rows.length;
        start += INSERT_CHUNK_SIZE
    ) {
        const chunk = rows.slice(
            start,
            start + INSERT_CHUNK_SIZE
        );

        const values = [];

        const placeholders = chunk.map(row => {
            const rowPlaceholders = row.map(value => {
                values.push(value);
                return `$${values.length}`;
            });

            return `(${rowPlaceholders.join(', ')})`;
        });

        const updateColumns = columns.filter(
            column => column !== 'staging_row_id'
        );

        const sql = `
            INSERT INTO ${table} (${columns.join(', ')})
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (staging_row_id)
            DO UPDATE SET
                ${updateColumns.map(
                    column => `${column} = EXCLUDED.${column}`
                ).join(', ')}
        `;

        await client.query(sql, values);
    }
}

async function fetchStagingPage(
    client,
    sourceKey,
    lastId
) {
    return client.query(
        `
        SELECT id, source_key, raw_data
        FROM staging_google_sheets_rows
        WHERE batch_id = $1
          AND source_key = $2
          AND id > $3
        ORDER BY id
        LIMIT $4
        `,
        [BATCH_ID, sourceKey, lastId, PAGE_SIZE]
    );
}

/*
|--------------------------------------------------------------------------
| DATA VERSIONING
|--------------------------------------------------------------------------
*/

function getPeriodVersionKey(
    datasetKey,
    periodType,
    year,
    quarter
) {
    return [
        datasetKey,
        periodType,
        year,
        quarter === null || quarter === undefined
            ? 'annual'
            : quarter
    ].join('|');
}

async function loadExistingVersionByStagingId(
    client,
    batchId
) {
    const result = await client.query(
        `
        SELECT
            target.staging_row_id::TEXT AS staging_row_id,
            target.period_version_id::TEXT AS period_version_id,
            version.status AS version_status,
            version.import_batch_id::TEXT AS import_batch_id
        FROM characteristic_data target
        JOIN staging_google_sheets_rows staging
            ON staging.id = target.staging_row_id
        JOIN data_period_versions version
            ON version.id = target.period_version_id
        WHERE staging.batch_id = $1

        UNION ALL

        SELECT
            target.staging_row_id::TEXT AS staging_row_id,
            target.period_version_id::TEXT AS period_version_id,
            version.status AS version_status,
            version.import_batch_id::TEXT AS import_batch_id
        FROM ratio_data target
        JOIN staging_google_sheets_rows staging
            ON staging.id = target.staging_row_id
        JOIN data_period_versions version
            ON version.id = target.period_version_id
        WHERE staging.batch_id = $1

        UNION ALL

        SELECT
            target.staging_row_id::TEXT AS staging_row_id,
            target.period_version_id::TEXT AS period_version_id,
            version.status AS version_status,
            version.import_batch_id::TEXT AS import_batch_id
        FROM macro_transactions target
        JOIN staging_google_sheets_rows staging
            ON staging.id = target.staging_row_id
        JOIN data_period_versions version
            ON version.id = target.period_version_id
        WHERE staging.batch_id = $1
        `,
        [batchId]
    );

    return new Map(
        result.rows.map(row => [
            String(row.staging_row_id),
            {
                id: row.period_version_id,
                status: row.version_status,
                importBatchId: row.import_batch_id
            }
        ])
    );
}

async function getOrCreateActivePeriodVersion(
    client,
    versionCache,
    datasetKey,
    periodType,
    year,
    quarter
) {
    const cacheKey = getPeriodVersionKey(
        datasetKey,
        periodType,
        year,
        quarter
    );

    if (versionCache.has(cacheKey)) {
        return versionCache.get(cacheKey);
    }

    // Serialisasi pembuatan versi untuk periode yang sama.
    await client.query(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [cacheKey]
    );

    const activeResult = await client.query(
        `
        SELECT id, import_batch_id
        FROM data_period_versions
        WHERE dataset_key = $1
          AND period_type = $2
          AND year = $3
          AND quarter IS NOT DISTINCT FROM $4
          AND status = 'active'
        FOR UPDATE
        `,
        [datasetKey, periodType, year, quarter]
    );

    if (activeResult.rows.length > 0) {
        const activeVersion = activeResult.rows[0];

        // Jangan mencampur transformasi Google Sheets ke snapshot Excel.
        if (activeVersion.import_batch_id !== null) {
            throw new Error(
                `Periode ${datasetKey} ${year}${quarter ? `/Q${quarter}` : ''} ` +
                'sudah dikelola oleh import Excel. Transformasi Google Sheets ditolak.'
            );
        }

        versionCache.set(cacheKey, activeVersion.id);

        return activeVersion.id;
    }

    const historyResult = await client.query(
        `
        SELECT id, status
        FROM data_period_versions
        WHERE dataset_key = $1
          AND period_type = $2
          AND year = $3
          AND quarter IS NOT DISTINCT FROM $4
        ORDER BY version_number DESC
        LIMIT 1
        FOR UPDATE
        `,
        [datasetKey, periodType, year, quarter]
    );

    if (historyResult.rows.length > 0) {
        throw new Error(
            `Periode ${datasetKey} ${year}${quarter ? `/Q${quarter}` : ''} ` +
            `memiliki histori versi (${historyResult.rows[0].status}) tetapi tidak memiliki versi aktif. ` +
            'Aktivasi kembali harus dilakukan melalui fitur pemulihan.'
        );
    }

    const insertResult = await client.query(
        `
        INSERT INTO data_period_versions (
            dataset_key,
            period_type,
            year,
            quarter,
            version_number,
            status,
            row_count,
            change_reason,
            activated_at
        )
        VALUES (
            $1, $2, $3, $4, 1, 'active', 0,
            'Dibuat dari transformasi Google Sheets',
            NOW()
        )
        RETURNING id
        `,
        [datasetKey, periodType, year, quarter]
    );

    const versionId = insertResult.rows[0].id;

    versionCache.set(cacheKey, versionId);

    return versionId;
}

async function appendVersionMetadata(
    client,
    versionCache,
    existingVersionByStagingId,
    touchedVersionIds,
    source,
    record,
    mapped
) {
    let datasetKey;
    let periodType;
    let year;
    let quarter;

    if (source.type === 'characteristic') {
        datasetKey = mapped[0];
        periodType = mapped[1];
        year = mapped[3];
        quarter = mapped[4];
    } else if (source.type === 'ratio') {
        datasetKey = 'analisis_rasio';
        periodType = mapped[0];
        year = mapped[2];
        quarter = mapped[3];
    } else {
        datasetKey = 'banding_makro';
        periodType = mapped[2] === null
            ? 'annual'
            : 'quarterly';
        year = mapped[1];
        quarter = mapped[2];
    }

    // Transformasi ulang hanya boleh memperbarui versi Google Sheets
    // yang masih aktif.
    const existingVersion = existingVersionByStagingId.get(
        String(record.id)
    );

    let versionId;

    if (existingVersion) {
        if (existingVersion.status !== 'active') {
            throw new Error(
                `Baris staging ${record.id} terhubung ke versi ` +
                `${existingVersion.status}. Transformasi ulang ditolak ` +
                'agar histori revisi atau penghapusan tidak tertimpa.'
            );
        }

        if (existingVersion.importBatchId !== null) {
            throw new Error(
                `Baris staging ${record.id} terhubung ke versi hasil import Excel. ` +
                'Transformasi Google Sheets ditolak agar sumber data tidak tercampur.'
            );
        }

        versionId = existingVersion.id;
    } else {
        versionId = await getOrCreateActivePeriodVersion(
            client,
            versionCache,
            datasetKey,
            periodType,
            year,
            quarter
        );
    }

    // Metadata ditambahkan di belakang agar indeks value_status
    // tetap sama seperti script sebelumnya.
    mapped.push(versionId, record.id);

    touchedVersionIds.add(String(versionId));

    return mapped;
}

async function refreshTouchedVersionRowCounts(
    client,
    versionIds
) {
    if (versionIds.size === 0) return;

    await client.query(
        `
        UPDATE data_period_versions version
        SET row_count = CASE
            WHEN version.dataset_key IN (
                'tahunan',
                'triwulanan_1',
                'triwulanan_2'
            ) THEN (
                SELECT COUNT(*)
                FROM characteristic_data data
                WHERE data.period_version_id = version.id
            )

            WHEN version.dataset_key = 'analisis_rasio' THEN (
                SELECT COUNT(*)
                FROM ratio_data data
                WHERE data.period_version_id = version.id
            )

            WHEN version.dataset_key = 'banding_makro' THEN (
                SELECT COUNT(*)
                FROM macro_transactions data
                WHERE data.period_version_id = version.id
            )

            ELSE version.row_count
        END
        WHERE version.id = ANY($1::BIGINT[])
        `,
        [Array.from(versionIds)]
    );
}

/*
|--------------------------------------------------------------------------
| MAIN TRANSFORMATION
|--------------------------------------------------------------------------
*/

async function main() {
    let client;
    let transformBatchId;
    let transactionStarted = false;

    const stats = {
        characteristic: 0,
        ratio: 0,
        macro: 0,
        skippedHeaders: 0,

        valueStatuses: {
            valid: 0,
            empty: 0,
            non_numeric: 0,
            source_error: 0,
            ambiguous: 0
        }
    };

    try {
        if (!Number.isInteger(BATCH_ID) || BATCH_ID <= 0) {
            throw new Error(
                `SOURCE_BATCH_ID tidak valid: ${process.env.SOURCE_BATCH_ID}`
            );
        }

        console.log('====================================');
        console.log('STAGING TO CORE TRANSFORMATION');
        console.log('====================================');

        // Pastikan batch sumber sudah berhasil.
        const sourceBatch = await pool.query(
            `
            SELECT id, status
            FROM migration_batches
            WHERE id = $1
            `,
            [BATCH_ID]
        );

        if (
            sourceBatch.rows.length === 0 ||
            sourceBatch.rows[0].status !== 'completed'
        ) {
            throw new Error(
                `Batch sumber ${BATCH_ID} belum completed`
            );
        }

        // Hitung sumber sebelum transformasi.
        const sourceCountsResult = await pool.query(
            `
            SELECT
                source_key,
                COUNT(*)::INTEGER AS total
            FROM staging_google_sheets_rows
            WHERE batch_id = $1
            GROUP BY source_key
            `,
            [BATCH_ID]
        );

        const sourceCounts = Object.fromEntries(
            sourceCountsResult.rows.map(row => [
                row.source_key,
                Number(row.total)
            ])
        );

        // Catat batch transformasi.
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
                'staging_to_core',
                'processing',
                $1::jsonb,
                0,
                'Transformasi staging ke tabel utama PostgreSQL'
            )
            RETURNING id
            `,
            [JSON.stringify(sourceCounts)]
        );

        transformBatchId = batchResult.rows[0].id;

        console.log('Source Batch ID:', BATCH_ID);
        console.log('Transform Batch ID:', transformBatchId);

        client = await pool.connect();

        await client.query('BEGIN');
        transactionStarted = true;

        // Ambil mapping sektor dari PostgreSQL.
        const aliasResult = await client.query(`
            SELECT source_code, sector_id
            FROM sector_aliases
        `);

        const sectorMap = new Map(
            aliasResult.rows.map(row => [
                normalizeText(row.source_code),
                Number(row.sector_id)
            ])
        );

        // Daftar kolom target.
        const characteristicColumns = [
            'source_key',
            'period_type',
            'period',
            'year',
            'quarter',
            'source_sector_code',
            'sector_id',
            'sisi',
            'jenis_neraca',
            'kode',
            'rincian',
            'neraca_rincian',
            'nilai',
            'konsep',
            'staging_row_id',
            'nilai_raw',
            'value_status',
            'period_version_id',
            'source_order'
        ];

        const ratioColumns = [
            'period_type',
            'period',
            'year',
            'quarter',
            'source_sector_code',
            'sector_id',
            'jenis_rasio',
            'kode',
            'rincian',
            'nilai',
            'staging_row_id',
            'nilai_raw',
            'value_status',
            'period_version_id',
            'source_order'
        ];

        const macroColumns = [
            'period',
            'year',
            'quarter',
            'transaksi',
            'staging_row_id',
            'transaksi_raw',
            'value_status',
            'period_version_id',
            'source_order'
        ];

        // Muat hubungan staging lama dengan versi yang sudah ada.
        const existingVersionByStagingId =
            await loadExistingVersionByStagingId(
                client,
                BATCH_ID
            );

        const versionCache = new Map();
        const touchedVersionIds = new Set();

        for (const source of SOURCES) {
            console.log(`\nMemproses ${source.key}...`);

            let lastId = 0;
            let sourceProcessed = 0;

            while (true) {
                const page = await fetchStagingPage(
                    client,
                    source.key,
                    lastId
                );

                if (page.rows.length === 0) break;

                const targetRows = [];

                for (const record of page.rows) {
                    let mapped;

                    if (source.type === 'characteristic') {
                        mapped = getCharacteristicRecord(
                            record,
                            sectorMap
                        );

                        if (mapped === null) {
                            stats.skippedHeaders++;
                            continue;
                        }

                        stats.characteristic++;
                        stats.valueStatuses[mapped[16]]++;

                    } else if (source.type === 'ratio') {
                        mapped = getRatioRecord(
                            record,
                            sectorMap
                        );

                        stats.ratio++;
                        stats.valueStatuses[mapped[12]]++;

                    } else {
                        mapped = getMacroRecord(record);

                        stats.macro++;
                        stats.valueStatuses[mapped[6]]++;
                    }

                    await appendVersionMetadata(
                        client,
                        versionCache,
                        existingVersionByStagingId,
                        touchedVersionIds,
                        source,
                        record,
                        mapped
                    );

                    targetRows.push(mapped);
                }

                if (source.type === 'characteristic') {
                    await upsertRows(
                        client,
                        'characteristic_data',
                        characteristicColumns,
                        targetRows
                    );

                } else if (source.type === 'ratio') {
                    await upsertRows(
                        client,
                        'ratio_data',
                        ratioColumns,
                        targetRows
                    );

                } else {
                    await upsertRows(
                        client,
                        'macro_transactions',
                        macroColumns,
                        targetRows
                    );
                }

                sourceProcessed += page.rows.length;

                lastId = Number(
                    page.rows[page.rows.length - 1].id
                );

                console.log(
                    `${source.key}: ${sourceProcessed}/${sourceCounts[source.key]}`
                );
            }
        }

        // Sinkronkan jumlah baris pada versi yang disentuh.
        await refreshTouchedVersionRowCounts(
            client,
            touchedVersionIds
        );

        // Validasi hasil transformasi berdasarkan referensi staging.
        const checks = [
            {
                table: 'characteristic_data',
                expected: stats.characteristic
            },
            {
                table: 'ratio_data',
                expected: stats.ratio
            },
            {
                table: 'macro_transactions',
                expected: stats.macro
            }
        ];

        for (const check of checks) {
            const result = await client.query(
                `
                SELECT COUNT(*)::INTEGER AS total
                FROM ${check.table} target
                JOIN staging_google_sheets_rows staging
                  ON staging.id = target.staging_row_id
                WHERE staging.batch_id = $1
                `,
                [BATCH_ID]
            );

            const actual = Number(result.rows[0].total);

            if (actual !== check.expected) {
                throw new Error(
                    `Validasi ${check.table} gagal: ` +
                    `expected ${check.expected}, actual ${actual}`
                );
            }

            console.log(
                `VALIDATED ${check.table}: ${actual} rows`
            );
        }

        const totalTransformed =
            stats.characteristic +
            stats.ratio +
            stats.macro;

        // Selesaikan catatan batch dalam transaksi yang sama.
        await client.query(
            `
            UPDATE migration_batches
            SET
                status = 'completed',
                total_rows = $2,
                finished_at = NOW(),
                notes = $3
            WHERE id = $1
            `,
            [
                transformBatchId,
                totalTransformed,
                JSON.stringify({
                    source_batch_id: BATCH_ID,
                    transformed: {
                        characteristic: stats.characteristic,
                        ratio: stats.ratio,
                        macro: stats.macro
                    },
                    skipped_headers: stats.skippedHeaders,
                    value_statuses: stats.valueStatuses
                })
            ]
        );

        await client.query('COMMIT');
        transactionStarted = false;

        console.log('\n====================================');
        console.log('TRANSFORMATION SUCCESSFUL');
        console.log('====================================');

        console.log('Total characteristic:', stats.characteristic);
        console.log('Total ratio:', stats.ratio);
        console.log('Total macro:', stats.macro);
        console.log('Skipped headers:', stats.skippedHeaders);
        console.log('Total transformed:', totalTransformed);

        console.log('\nValue status:');
        console.table(stats.valueStatuses);

        console.log('Transform Batch ID:', transformBatchId);

    } catch (error) {
        if (client && transactionStarted) {
            await client.query('ROLLBACK');
            transactionStarted = false;
        }

        if (transformBatchId) {
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
                    [transformBatchId, error.message]
                );

            } catch (updateError) {
                console.error(
                    'Gagal memperbarui status batch:',
                    updateError.message
                );
            }
        }

        console.error('\nTRANSFORMATION FAILED:');
        console.error(error);

        process.exitCode = 1;

    } finally {
        if (client) client.release();

        await pool.end();
    }
}

main();
