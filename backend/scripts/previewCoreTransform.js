
require('dotenv').config();

const pool = require('../src/config/postgres');

const BATCH_ID = 1;
const PAGE_SIZE = 2000;

const SOURCES = [
    'tahunan',
    'triwulanan_1',
    'triwulanan_2',
    'analisis_rasio',
    'banding_makro'
];

function cleanCode(value) {
    return String(value ?? '')
        .normalize('NFKC')
        .replace(/\u00A0/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

function getField(row, field) {
    const key = Object.keys(row).find(
        item => cleanCode(item) === cleanCode(field)
    );

    return key ? row[key] : undefined;
}

function parsePeriod(value) {
    const period = String(value ?? '').trim();

    const match = period.match(
        /^(\d{4})(?:\/Q([1-4]))?$/i
    );

    if (!match) return null;

    const year = Number(match[1]);
    const quarter = match[2]
        ? Number(match[2])
        : null;

    if (year < 1900 || year > 2200) return null;

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
    if (value === null || value === undefined) {
        return { status: 'empty', value: null };
    }

    if (typeof value === 'number') {
        return Number.isFinite(value)
            ? { status: 'valid', value: String(value) }
            : { status: 'invalid', value: null };
    }

    let text = String(value)
        .trim()
        .replace(/\u00A0/g, '')
        .replace(/\s/g, '')
        .replace(/[−–—]/g, '-');

    if (!text || ['-', '--', 'N/A', 'NA'].includes(text.toUpperCase())) {
        return { status: 'empty', value: null };
    }

    const hasDot = text.includes('.');
    const hasComma = text.includes(',');

    if (hasDot && hasComma) {
        // Separator terakhir dianggap sebagai pemisah desimal.
        if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
            text = text.replace(/\./g, '').replace(',', '.');
        } else {
            text = text.replace(/,/g, '');
        }
    } else if (hasComma) {
        if (text.includes(',')) {
            text = text.replace(',', '.');
        }
    } else if (hasDot) {
        // Format seperti 1.234 ambigu:
        // bisa berarti 1,234 atau 1234.
        if (/^-?\d{1,3}\.\d{3}$/.test(text)) {
            return {
                status: 'ambiguous',
                value: null,
                original: value
            };
        }

        // Format ribuan dengan beberapa titik.
        if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(text)) {
            text = text.replace(/\./g, '');
        }
    }

    if (!/^[+-]?\d+(\.\d+)?$/.test(text)) {
        return {
            status: 'invalid',
            value: null,
            original: value
        };
    }

    return {
        status: 'valid',
        value: text
    };
}

async function main() {
    console.log('======================================');
    console.log('PREVIEW TRANSFORMASI DATA BPS');
    console.log('======================================');

    const aliasesResult = await pool.query(`
        SELECT
            source_code,
            sector_id
        FROM sector_aliases
    `);

    const sectorAliases = new Map(
        aliasesResult.rows.map(row => [
            cleanCode(row.source_code),
            Number(row.sector_id)
        ])
    );

    const summary = {};
    const unknownSectors = [];
    const invalidPeriods = [];
    const invalidNumbers = [];
    const ambiguousNumbers = [];
    const stringSamples = [];
    const headerRows = [];

    for (const source of SOURCES) {
        console.log(`\nMemeriksa sumber: ${source}`);

        const stats = {
            total: 0,
            valid: 0,
            nullValues: 0,
            headerRows: 0,
            valueTypes: {},
            periodTypes: {
                annual: 0,
                quarterly: 0
            }
        };

        let lastId = 0;

        while (true) {
            const result = await pool.query(
                `
                SELECT id, raw_data
                FROM staging_google_sheets_rows
                WHERE batch_id = $1
                  AND source_key = $2
                  AND id > $3
                ORDER BY id
                LIMIT $4
                `,
                [BATCH_ID, source, lastId, PAGE_SIZE]
            );

            if (result.rows.length === 0) break;

            for (const record of result.rows) {
                const row = record.raw_data;

                stats.total++;

                const sourceSector = getField(row, 'SEKTOR');

                // Header berulang pada data triwulanan.
                if (cleanCode(sourceSector) === 'SEKTOR') {
                    stats.headerRows++;
                    headerRows.push({
                        source,
                        stagingId: record.id
                    });
                    continue;
                }

                let periodValue;
                let numericValue;

                if (source === 'banding_makro') {
                    periodValue = getField(row, 'TAHUN');
                    numericValue = getField(row, 'TRANSAKSI');
                } else {
                    periodValue = getField(row, 'TAHUN');
                    numericValue = getField(row, 'NILAI');

                    const sector = cleanCode(sourceSector);

                    if (!sectorAliases.has(sector)) {
                        if (unknownSectors.length < 30) {
                            unknownSectors.push({
                                source,
                                stagingId: record.id,
                                sector: sourceSector
                            });
                        }
                    }
                }

                const period = parsePeriod(periodValue);

                if (!period && invalidPeriods.length < 30) {
                    invalidPeriods.push({
                        source,
                        stagingId: record.id,
                        period: periodValue
                    });
                }

                if (period) {
                    stats.periodTypes[period.periodType]++;
                }

                const parsed = parseNumeric(numericValue);

                stats.valueTypes[typeof numericValue] =
                    (stats.valueTypes[typeof numericValue] || 0) + 1;

                if (parsed.status === 'empty') {
                    stats.nullValues++;
                }

                if (parsed.status === 'ambiguous' &&
                    ambiguousNumbers.length < 30) {
                    ambiguousNumbers.push({
                        source,
                        stagingId: record.id,
                        original: parsed.original
                    });
                }

                if (parsed.status === 'invalid' &&
                    invalidNumbers.length < 30) {
                    invalidNumbers.push({
                        source,
                        stagingId: record.id,
                        original: parsed.original ?? numericValue
                    });
                }

                if (
                    typeof numericValue === 'string' &&
                    numericValue.trim() &&
                    stringSamples.length < 30
                ) {
                    stringSamples.push({
                        source,
                        stagingId: record.id,
                        value: numericValue,
                        parsed: parsed.value,
                        status: parsed.status
                    });
                }

                if (period &&
                    (source === 'banding_makro' ||
                     sectorAliases.has(cleanCode(sourceSector))) &&
                    parsed.status !== 'invalid' &&
                    parsed.status !== 'ambiguous') {
                    stats.valid++;
                }
            }

            lastId = result.rows[result.rows.length - 1].id;
        }

        summary[source] = stats;

        console.log({
            total: stats.total,
            valid: stats.valid,
            nullValues: stats.nullValues,
            headerRows: stats.headerRows,
            periodTypes: stats.periodTypes
        });
    }

    console.log('\n======================================');
    console.log('LAPORAN PREFLIGHT');
    console.log('======================================');

    console.log('\n1. Ringkasan sumber:');
    console.table(
        Object.entries(summary).map(([source, stats]) => ({
            source,
            total: stats.total,
            valid: stats.valid,
            nullValues: stats.nullValues,
            headerRows: stats.headerRows
        }))
    );

    console.log('\n2. Header berulang:');
    console.table(headerRows);

    console.log('\n3. Sektor belum terpetakan:');
    console.table(unknownSectors);

    console.log('\n4. Periode tidak valid:');
    console.table(invalidPeriods);

    console.log('\n5. Angka ambigu:');
    console.table(ambiguousNumbers);

    console.log('\n6. Nilai angka tidak valid:');
    console.table(invalidNumbers);

    console.log('\n7. Contoh nilai string:');
    console.table(stringSamples);

    console.log('\n======================================');
    console.log('PREFLIGHT SELESAI');
    console.log('Tidak ada data yang diubah.');
    console.log('======================================');
}

main()
    .catch(error => {
        console.error('PREFLIGHT FAILED:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
