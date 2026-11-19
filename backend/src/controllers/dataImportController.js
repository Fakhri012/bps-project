
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const pool = require('../config/postgres');
const { getDataBusinessKey } = require('../utils/dataBusinessKeys');
const {
    addSectorPreviewRecord,
    createSectorIdentityIndex,
    createSectorPreviewSummary,
    finalizeSectorPreviewSummary,
    normalizeSectorLabel,
    resolveSectorIdentity
} = require('../utils/sectorIdentity');

const ANNUAL_HEADERS = [
    'SEKTOR',
    'TAHUN',
    'SISI',
    'JENIS NERACA',
    'KODE',
    'RINCIAN',
    'NERACA - RINCIAN',
    'STATUS NILAI',
    'NILAI',
    'KONSEP'
];

const RATIO_HEADERS = [
    'SEKTOR',
    'TAHUN',
    'JENIS RASIO',
    'KODE',
    'RINCIAN',
    'NILAI'
];

const SUPPORTED_IMPORT_DATASETS = {
    tahunan: {
        key: 'tahunan',
        label: 'Karakteristik Tahunan',
        worksheetName: 'TAHUNAN',
        periodType: 'annual',
        headers: ANNUAL_HEADERS,
        requiresQuarter: false,
        allowedQuarters: null,
        sourceKey: 'tahunan'
    },
    triwulanan_1: {
        key: 'triwulanan_1',
        label: 'Karakteristik Triwulanan 1',
        worksheetName: 'TRIWULANAN',
        periodType: 'quarterly',
        headers: ANNUAL_HEADERS,
        requiresQuarter: true,
        allowedQuarters: [1, 2, 3, 4],
        sourceKey: 'triwulanan_1'
    },
    triwulanan_2: {
        key: 'triwulanan_2',
        label: 'Karakteristik Triwulanan 2',
        worksheetName: 'TRIWULANAN',
        periodType: 'quarterly',
        headers: ANNUAL_HEADERS,
        requiresQuarter: true,
        allowedQuarters: [1, 2, 3, 4],
        sourceKey: 'triwulanan_2'
    },
    analisis_rasio: {
        key: 'analisis_rasio',
        label: 'Analisis Rasio',
        worksheetName: 'RASIO',
        periodType: 'annual',
        headers: RATIO_HEADERS,
        requiresQuarter: false,
        allowQuarter: true,
        allowedQuarters: null,
        sourceKey: 'analisis_rasio'
    }
};

const WORKBOOK_SHEET_ALIASES = new Map([
    ['TAHUNAN', ['tahunan']],
    ['TRIWULANAN_1', ['triwulanan_1']],
    ['TRIWULANAN_2', ['triwulanan_2']],
    ['TRIWULANAN', ['triwulanan_1']],
    ['RASIO', ['analisis_rasio']],
    ['ANALISIS_RASIO', ['analisis_rasio']],
    ['ANALISIS_NERACA_RASIO', ['analisis_rasio']]
]);

function normalizeWorkbookSheetName(value) {
    return normalizeText(value).replace(/[\s-]+/g, '_').replace(/_+/g, '_');
}

function getWorkbookRowPeriod(value) {
    const text = getCellText(value);
    const year = parseYearFromValue(text);
    if (year === null) return null;
    const quarterMatch = text.match(/^\d{4}\/Q([1-4])$/i);
    const quarter = quarterMatch ? Number(quarterMatch[1]) : null;
    return {
        year,
        quarter,
        period_key: quarter === null ? String(year) : `${year}/Q${quarter}`
    };
}

function workbookHeaderMatches(worksheet, headers) {
    const headerRow = worksheet.getRow(3);
    if (!headerRow.hasValues) return false;
    const actual = headers.map((_, index) => getCellText(headerRow.getCell(index + 1).value).trim());
    let extraHeaderValue = false;
    headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        if (columnNumber > headers.length && !isBlankValue(cell.value)) extraHeaderValue = true;
    });
    return !extraHeaderValue && headers.every((header, index) => actual[index] === header);
}

async function detectWorkbookSheets(req, res) {
    if (!req.file?.path) {
        return res.status(400).json({ success: false, message: 'File Excel belum dipilih.' });
    }

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const sheets = workbook.worksheets.map(worksheet => {
            const normalizedName = normalizeWorkbookSheetName(worksheet.name);
            const candidateDatasets = WORKBOOK_SHEET_ALIASES.get(normalizedName) || null;
            let rowsFound = 0;
            const periods = new Map();
            const periodErrors = [];

            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (rowNumber < 4 || !row.values.some(value => !isBlankValue(value))) return;
                rowsFound++;
                const rowPeriod = getWorkbookRowPeriod(row.getCell(2).value);
                if (!rowPeriod) {
                    periodErrors.push({ row_number: rowNumber, message: 'TAHUN harus berupa YYYY atau YYYY/Q1-Q4.' });
                    return;
                }
                const period = periods.get(rowPeriod.period_key) || {
                    ...rowPeriod,
                    requires_quarter: rowPeriod.quarter === null &&
                        candidateDatasets?.every(key => SUPPORTED_IMPORT_DATASETS[key].requiresQuarter),
                    row_count: 0
                };
                period.row_count++;
                periods.set(rowPeriod.period_key, period);
            });

            if (normalizedName === 'MASTER_DATA') {
                return {
                    sheet_name: worksheet.name,
                    normalized_name: normalizedName,
                    status: 'ignored',
                    target_table: null,
                    rows_found: 0,
                    periods: [],
                    message: 'Sheet MASTER DATA adalah referensi dan tidak diimpor.'
                };
            }

            if (!rowsFound && !worksheet.getRow(3).hasValues) {
                return {
                    sheet_name: worksheet.name,
                    normalized_name: normalizedName,
                    status: 'empty',
                    target_table: null,
                    rows_found: 0,
                    periods: [],
                    message: 'Sheet kosong dan akan dilewati.'
                };
            }

            if (!candidateDatasets) {
                return {
                    sheet_name: worksheet.name,
                    normalized_name: normalizedName,
                    status: 'unknown',
                    target_table: null,
                    rows_found: rowsFound,
                    periods: [...periods.values()],
                    message: 'Nama sheet tidak dikenali; sheet tidak akan diimpor.'
                };
            }

            const expectedHeaders = candidateDatasets.map(key => SUPPORTED_IMPORT_DATASETS[key].headers);
            const matchingIndex = expectedHeaders.findIndex(headers => workbookHeaderMatches(worksheet, headers));
            if (matchingIndex < 0) {
                return {
                    sheet_name: worksheet.name,
                    normalized_name: normalizedName,
                    status: 'invalid',
                    candidate_datasets: candidateDatasets,
                    target_table: candidateDatasets.includes('analisis_rasio') ? 'ratio_data' : 'characteristic_data',
                    rows_found: rowsFound,
                    periods: [...periods.values()],
                    errors: ['Struktur header baris ke-3 tidak cocok dengan dataset yang diizinkan.']
                };
            }

            const status = rowsFound > MAX_DATA_ROWS
                ? 'invalid'
                : periodErrors.length > 0 ? 'invalid'
                    : candidateDatasets.length > 1 ? 'needs_dataset_choice' : 'detected';
            const datasetKey = candidateDatasets.length === 1 ? candidateDatasets[0] : null;
            const targetTable = candidateDatasets.includes('analisis_rasio')
                ? 'ratio_data'
                : 'characteristic_data';
            const detectedPeriods = [...periods.values()];
            const frequencyError = datasetKey === 'tahunan' && detectedPeriods.some(period => period.quarter !== null);
            if (frequencyError) {
                return {
                    sheet_name: worksheet.name,
                    normalized_name: normalizedName,
                    status: 'invalid',
                    candidate_datasets: candidateDatasets,
                    dataset_key: datasetKey,
                    target_table: targetTable,
                    rows_found: rowsFound,
                    periods: detectedPeriods,
                    errors: ['Sheet TAHUNAN tidak boleh berisi periode triwulanan.']
                };
            }

            return {
                sheet_name: worksheet.name,
                normalized_name: normalizedName,
                status,
                dataset_key: datasetKey,
                candidate_datasets: candidateDatasets,
                target_table: targetTable,
                rows_found: rowsFound,
                periods: detectedPeriods,
                errors: periodErrors.length > 0
                    ? periodErrors
                    : rowsFound > MAX_DATA_ROWS
                        ? [`Maksimal ${MAX_DATA_ROWS.toLocaleString('id-ID')} record per sheet.`]
                        : []
            };
        });

        const duplicates = new Map();
        for (const sheet of sheets) {
            if (!['detected', 'needs_dataset_choice'].includes(sheet.status)) continue;
            if (sheet.candidate_datasets?.length !== 1) continue;
            for (const period of sheet.periods) {
                if (period.requires_quarter) continue;
                for (const datasetKey of sheet.candidate_datasets || []) {
                    const key = `${datasetKey}|${period.period_key}`;
                    const match = duplicates.get(key) || [];
                    match.push(sheet);
                    duplicates.set(key, match);
                }
            }
        }
        for (const [key, matchingSheets] of duplicates) {
            if (matchingSheets.length < 2) continue;
            const [datasetKey, periodKey] = key.split('|');
            for (const sheet of matchingSheets) {
                sheet.status = 'duplicate_conflict';
                sheet.errors = [
                    ...(sheet.errors || []),
                    `Lebih dari satu sheet mengarah ke ${datasetKey} / ${periodKey}. Gabungkan atau pilih hanya satu sheet.`
                ];
            }
        }

        return res.json({
            success: true,
            message: 'Deteksi workbook selesai.',
            detection: { original_filename: req.file.originalname, sheets }
        });
    } catch (error) {
        return res.status(error.status || 400).json({
            success: false,
            message: error.status ? error.message : 'Workbook Excel tidak valid atau tidak dapat dibaca.'
        });
    } finally {
        if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {})
    }
}

function matchesWorkbookPeriod(rowValue, datasetKey, year, quarter) {
    const rowPeriod = getWorkbookRowPeriod(rowValue);
    if (!rowPeriod || rowPeriod.year !== year) return false;
    if (quarter === null) return rowPeriod.quarter === null;
    if (rowPeriod.quarter !== null) return rowPeriod.quarter === quarter;
    return datasetKey === 'triwulanan_1' || datasetKey === 'triwulanan_2';
}

function resolveDatasetConfig(datasetKey) {
    const normalizedKey = String(datasetKey ?? 'tahunan')
        .trim()
        .toLowerCase();

    const config = SUPPORTED_IMPORT_DATASETS[normalizedKey];

    if (!config) {
        const error = new Error(
            `Dataset "${datasetKey}" belum tersedia untuk import Excel.`
        );
        error.status = 400;
        throw error;
    }

    return config;
}

function normalizeDatasetKey(value) {
    return String(value ?? 'tahunan')
        .trim()
        .toLowerCase();
}

function parseQuarter(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const normalized = String(value).trim().toUpperCase();

    if (/^Q?[1-4]$/.test(normalized)) {
        return Number(normalized.replace('Q', ''));
    }

    const asNumber = Number(value);
    if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 4) {
        return asNumber;
    }

    return null;
}

function parseYearFromValue(value) {
    if (typeof value === 'number') {
        if (!Number.isInteger(value)) {
            return null;
        }

        if (value < 1900 || value > 2200) {
            return null;
        }

        return value;
    }

    const text = String(value ?? '').trim();

    if (!/^\d{4}$/.test(text) && !/^\d{4}\/Q[1-4]$/i.test(text)) {
        return null;
    }

    const yearPart = text.split('/')[0];
    const parsed = Number(yearPart);

    if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2200) {
        return null;
    }

    return parsed;
}

function parseDatasetPeriod(config, rawYear, rawQuarter) {
    const year = Number(rawYear);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
        const error = new Error('Tahun periode harus berupa empat digit antara 1900 dan 2200.');
        error.status = 400;
        throw error;
    }

    const hasQuarter = config.requiresQuarter ||
        (config.allowQuarter && rawQuarter !== undefined && rawQuarter !== null && rawQuarter !== '');

    if (!hasQuarter) {
        return {
            year,
            quarter: null,
            periodType: 'annual'
        };
    }

    const quarter = parseQuarter(rawQuarter);
    if (quarter === null) {
        const error = new Error('Dataset triwulanan membutuhkan parameter quarter yang valid (1-4).');
        error.status = 400;
        throw error;
    }

    return {
        year,
        quarter,
        periodType: 'quarterly'
    };
}

const MAX_DATA_ROWS = 50000;
const INSERT_CHUNK_SIZE = 200;
const PREVIEW_SAMPLE_SIZE = 20;
const PREVIEW_EXPIRY_MINUTES = 30;

/*
|--------------------------------------------------------------------------
| HELPER: TEXT NORMALIZATION
|--------------------------------------------------------------------------
*/

function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFKC')
        .replace(/\u00A0/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

function rawText(value) {
    if (value === undefined || value === null) {
        return null;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    return String(value);
}

/*
|--------------------------------------------------------------------------
| HELPER: EXCEL CELL
|--------------------------------------------------------------------------
*/

function isFormulaCell(value) {
    if (!value || typeof value !== 'object' || value instanceof Date) {
        return false;
    }

    return (
        Object.prototype.hasOwnProperty.call(value, 'formula') ||
        Object.prototype.hasOwnProperty.call(value, 'sharedFormula')
    );
}

function serializeCellValue(value) {
    if (value === undefined || value === null) {
        return null;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value !== 'object') {
        return value;
    }

    if (isFormulaCell(value)) {
        return {
            formula: value.formula ?? null,
            sharedFormula: value.sharedFormula ?? null,
            result: serializeCellValue(value.result)
        };
    }

    if (Array.isArray(value.richText)) {
        return value.richText
            .map(item => item.text || '')
            .join('');
    }

    if (value.hyperlink && value.text) {
        return String(value.text);
    }

    if (value.error !== undefined) {
        return String(value.error);
    }

    return JSON.parse(JSON.stringify(value));
}

function isBlankValue(value) {
    if (value === undefined || value === null) {
        return true;
    }

    if (typeof value === 'string' && value.trim() === '') {
        return true;
    }

    return false;
}

function getCellText(value) {
    if (value === undefined || value === null) {
        return '';
    }

    if (isFormulaCell(value)) {
        return '';
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (
        typeof value === 'object' &&
        Array.isArray(value.richText)
    ) {
        return value.richText
            .map(item => item.text || '')
            .join('');
    }

    if (
        typeof value === 'object' &&
        value.text !== undefined
    ) {
        return String(value.text);
    }

    if (typeof value === 'object') {
        return '';
    }

    return String(value).trim();
}

/*
|--------------------------------------------------------------------------
| HELPER: ANNUAL PERIOD VALIDATION
|--------------------------------------------------------------------------
*/

function parseAnnualYear(value) {
    if (typeof value === 'number') {
        if (!Number.isInteger(value)) {
            return null;
        }

        if (value < 1900 || value > 2200) {
            return null;
        }

        return value;
    }

    const text = getCellText(value);

    if (!/^\d{4}$/.test(text)) {
        return null;
    }

    const year = Number(text);

    if (year < 1900 || year > 2200) {
        return null;
    }

    return year;
}

/*
|--------------------------------------------------------------------------
| HELPER: NUMERIC PARSER
|--------------------------------------------------------------------------
|
| Mempertahankan aturan parsing dari transformasi lama.
| Nilai kosong tidak diubah menjadi nol.
|--------------------------------------------------------------------------
*/

function parseNumeric(value) {
    if (value === undefined || value === null) {
        return {
            value: null,
            raw: null,
            status: 'empty'
        };
    }

    if (isFormulaCell(value)) {
        return {
            value: null,
            raw: '[FORMULA]',
            status: 'non_numeric'
        };
    }

    const original = String(value);
    let text = original.trim();
    const dashNormalized = text.replace(/[−–—]/g, '-');

    if (!text || ['-', '--'].includes(dashNormalized)) {
        return {
            value: null,
            raw: original,
            status: 'empty'
        };
    }

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
        if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
            text = text.replace(/\./g, '').replace(',', '.');
        } else {
            text = text.replace(/,/g, '');
        }
    } else if (hasComma) {
        const parts = text.split(',');
        if (parts.length === 2) {
            if (/^[+-]?\d{1,3},\d{3}$/.test(text)) {
                return { value: null, raw: original, status: 'ambiguous' };
            }
            text = text.replace(',', '.');
        } else if (parts.length > 2 && parts.slice(1).every(part => /^\d{3}$/.test(part))) {
            text = text.replace(/,/g, '');
        }
    } else if (hasDot) {
        if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(text)) {
            text = text.replace(/\./g, '');
        } else if (/^-?\d{1,3}\.\d{3}$/.test(text)) {
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

/*
|--------------------------------------------------------------------------
| HELPER: FILE HASH
|--------------------------------------------------------------------------
*/

function calculateFileSha256(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', chunk => hash.update(chunk));

        stream.on('error', reject);

        stream.on('end', () => {
            resolve(hash.digest('hex'));
        });
    });
}

/*
|--------------------------------------------------------------------------
| HELPER: INSERT STAGING BATCH
|--------------------------------------------------------------------------
*/

async function insertStagingRows(client, batchId, rows) {
    if (rows.length === 0) return;

    const values = [];

    const placeholders = rows.map(item => {
        const rowValues = [
                    batchId,
                    config.worksheetName,
            item.rowNumber,
            JSON.stringify(item.rawData),
            item.normalizedData === null
                ? null
                : JSON.stringify(item.normalizedData),
            item.validationStatus,
            JSON.stringify(item.validationErrors)
        ];

        const rowPlaceholders = rowValues.map(value => {
            values.push(value);

            const index = values.length;

            if (index === values.length) {
                return `$${index}`;
            }

            return `$${index}`;
        });

        return `(${rowPlaceholders.join(', ')}, ` +
            `NULLIF($${values.length - 2}, '')::jsonb, ` +
            `$${values.length - 1}, ` +
            `$${values.length}::jsonb)`;
    });

    // Placeholder disusun secara eksplisit agar JSONB tetap aman.
    const sql = `
        INSERT INTO staging_excel_rows (
            batch_id,
            worksheet_name,
            source_row_number,
            raw_data,
            normalized_data,
            validation_status,
            validation_errors
        )
        VALUES ${placeholders.join(', ')}
    `;

    await client.query(sql, values);
}

/*
|--------------------------------------------------------------------------
| HELPER: VALIDATE AND NORMALIZE ROW
|--------------------------------------------------------------------------
*/

function validateAnnualRow(
    row,
    rowNumber,
    expectedYear,
    expectedQuarter,
    sectorMap,
    datasetKey = 'tahunan',
    headers = ANNUAL_HEADERS
) {
    const rawData = {};

    const values = Object.fromEntries(headers.map((header, index) => {
        const value = row.getCell(index + 1).value;
        rawData[header] = serializeCellValue(value);
        return [header, value];
    }));

    if (Object.values(values).every(isBlankValue)) {
        return null;
    }

    const errors = [];
    const warnings = [];

    headers.forEach(header => {
        if (isFormulaCell(values[header])) {
            errors.push(
                `Formula tidak diperbolehkan pada kolom ${header}.`
            );
        }
    });

    const sourceSector = normalizeSectorLabel(getCellText(values.SEKTOR));
    const sourcePeriod = getCellText(values.TAHUN);
    const rowYear = expectedQuarter === null
        ? parseAnnualYear(values.TAHUN)
        : parseYearFromValue(values.TAHUN);

    const sectorResolution = resolveUploadSector(sourceSector, sectorMap, errors);
    const sectorId = sectorResolution.sector_id ?? null;
    const storedSectorCode = sectorResolution.status === 'existing'
        ? sectorResolution.sector?.code || sourceSector
        : sourceSector

    if (rowYear === null) {
        errors.push(
            'TAHUN harus berupa empat digit antara 1900 dan 2200.'
        );
    } else if (rowYear !== expectedYear) {
        errors.push(
            `TAHUN ${rowYear} tidak sesuai dengan periode upload ${expectedYear}.`
        );
    }

    if (expectedQuarter !== null && expectedQuarter !== undefined) {
        const periodParts = sourcePeriod.match(/^\d{4}\/Q([1-4])$/i);
        const rowQuarter = periodParts ? Number(periodParts[1]) : expectedQuarter;
        if (rowQuarter !== expectedQuarter) {
            errors.push(
                `TRIWULAN ${rowQuarter} tidak sesuai dengan periode upload Q${expectedQuarter}.`
            );
        }
    }

    const statusNilai = normalizeText(getCellText(values['STATUS NILAI']));
    const nilaiIsDashOrBlank = isBlankValue(values.NILAI) ||
        ['-', '--', '–', '—', '−'].includes(String(getCellText(values.NILAI) ?? '').trim());
    let parsedValue = parseNumeric(values.NILAI);

    if (statusNilai === 'KOSONG') {
        if (!nilaiIsDashOrBlank) {
            errors.push('Status KOSONG tidak boleh memiliki nilai numerik. Gunakan status INPUT.');
        }
        parsedValue = { value: null, raw: parsedValue.raw, status: 'empty' };
    } else if (statusNilai === 'INPUT') {
        if (parsedValue.status !== 'valid' || parsedValue.value === null) {
            errors.push('Status INPUT memerlukan nilai numerik. Pilih KOSONG jika nilai tidak tersedia.');
        }
    } else {
        errors.push('STATUS NILAI harus berupa KOSONG atau INPUT.');
    }

    const normalizedData = {
        source_key: datasetKey,
        period_type: expectedQuarter === null ? 'annual' : 'quarterly',
        period: expectedQuarter === null ? String(expectedYear) : `${expectedYear}/Q${expectedQuarter}`,
        year: expectedYear,
        quarter: expectedQuarter ?? null,

        source_sector_code: storedSectorCode || null,
        sector_id: sectorId,
        sector_status: sectorResolution.status,
        new_sector_candidate: sectorResolution.status === 'new_sector_candidate',
        sector_conflicts: sectorResolution.sectors || [],

        sisi: getCellText(values.SISI) || null,
        jenis_neraca: getCellText(values['JENIS NERACA']) || null,
        kode: getCellText(values.KODE) || null,
        rincian: getCellText(values.RINCIAN) || null,
        neraca_rincian: getCellText(values['NERACA - RINCIAN']) || null,

        nilai: parsedValue.value,
        nilai_raw: parsedValue.raw,
        value_status: parsedValue.status,

        konsep: getCellText(values.KONSEP) || null
    };
    normalizedData.business_key = getDataBusinessKey(datasetKey, normalizedData);

    const validationStatus = errors.length > 0
        ? 'invalid'
        : warnings.length > 0
            ? 'warning'
            : 'valid';

    return {
        rowNumber,
        rawData,
        normalizedData,
        validationStatus,
        validationErrors: [
            ...errors,
            ...warnings
        ],
        preview: {
            row_number: rowNumber,
            ...rawData,
            validation_status: validationStatus,
            sector_status: sectorResolution.status,
            new_sector_candidate: sectorResolution.status === 'new_sector_candidate',
            sector_conflicts: sectorResolution.sectors || [],
            validation_errors: [
                ...errors,
                ...warnings
            ]
        }
    };
}

function resolveUploadSector(sourceSector, sectorIndex, errors) {
    if (!sourceSector) {
        errors.push('SEKTOR wajib diisi.');
        return { status: 'missing' };
    }

    const resolution = resolveSectorIdentity(sectorIndex, sourceSector);
    if (resolution.status === 'conflict') {
        if (resolution.official_code && resolution.sectors.length === 0) {
            errors.push(
                `Nama sektor resmi "${sourceSector}" mengarah ke kode master "${resolution.official_code}" yang tidak tersedia.`
            );
            return resolution;
        }
        const conflictingCodes = resolution.sectors
            .map(sector => sector.code || sector.name)
            .filter(Boolean)
            .join(', ');
        errors.push(
            `SEKTOR "${sourceSector}" cocok dengan beberapa identitas master (${conflictingCodes}). Periksa data master sebelum mengimpor.`
        );
        return resolution;
    }

    if (resolution.status === 'new_sector_candidate' && sourceSector.length > 50) {
        errors.push('Kode sektor baru maksimal 50 karakter.');
    }

    return resolution;
}

function validateRatioRow(
    row,
    rowNumber,
    expectedYear,
    sectorMap,
    expectedQuarter = null
) {
    const rawData = {};
    const values = [];

    for (let index = 0; index < RATIO_HEADERS.length; index++) {
        const header = RATIO_HEADERS[index];
        const value = row.getCell(index + 1).value;

        values.push(value);
        rawData[header] = serializeCellValue(value);
    }

    if (values.every(isBlankValue)) {
        return null;
    }

    const errors = [];
    const warnings = [];

    RATIO_HEADERS.forEach((header, index) => {
        if (isFormulaCell(values[index])) {
            errors.push(`Formula tidak diperbolehkan pada kolom ${header}.`);
        }
    });

    const sourceSector = normalizeSectorLabel(getCellText(values[0]));
    const rowYear = parseYearFromValue(values[1]);
    const sectorResolution = resolveUploadSector(sourceSector, sectorMap, errors);
    const sectorId = sectorResolution.sector_id ?? null;
    const storedSectorCode = sectorResolution.status === 'existing'
        ? sectorResolution.sector?.code || sourceSector
        : sourceSector

    if (rowYear === null) {
        errors.push('TAHUN harus berupa empat digit antara 1900 dan 2200.');
    } else if (rowYear !== expectedYear) {
        errors.push(`TAHUN ${rowYear} tidak sesuai dengan periode upload ${expectedYear}.`);
    }

    const periodParts = getCellText(values[1]).match(/^\d{4}\/Q([1-4])$/i);
    if (expectedQuarter === null && periodParts) {
        errors.push('Periode triwulanan tidak sesuai dengan upload tahunan.');
    } else if (expectedQuarter !== null && periodParts && Number(periodParts[1]) !== expectedQuarter) {
        errors.push(`TRIWULAN ${periodParts[1]} tidak sesuai dengan periode upload Q${expectedQuarter}.`);
    }

    const parsedValue = parseNumeric(values[5]);
    if (!['valid', 'empty'].includes(parsedValue.status)) {
        errors.push(`NILAI harus berupa angka valid atau kosong/dash; nilai "${parsedValue.raw}" tidak dikenali.`);
    }

    const normalizedData = {
        source_key: 'analisis_rasio',
        period_type: expectedQuarter === null ? 'annual' : 'quarterly',
        period: expectedQuarter === null ? String(expectedYear) : `${expectedYear}/Q${expectedQuarter}`,
        year: expectedYear,
        quarter: expectedQuarter ?? null,
        source_sector_code: storedSectorCode || null,
        sector_id: sectorId,
        sector_status: sectorResolution.status,
        new_sector_candidate: sectorResolution.status === 'new_sector_candidate',
        sector_conflicts: sectorResolution.sectors || [],
        jenis_rasio: getCellText(values[2]) || null,
        kode: getCellText(values[3]) || null,
        rincian: getCellText(values[4]) || null,
        nilai: parsedValue.value,
        nilai_raw: parsedValue.raw,
        value_status: parsedValue.status
    };
    normalizedData.business_key = getDataBusinessKey('analisis_rasio', normalizedData);

    const validationStatus = errors.length > 0
        ? 'invalid'
        : warnings.length > 0
            ? 'warning'
            : 'valid';

    return {
        rowNumber,
        rawData,
        normalizedData,
        validationStatus,
        validationErrors: [...errors, ...warnings],
        preview: {
            row_number: rowNumber,
            ...rawData,
            validation_status: validationStatus,
            sector_status: sectorResolution.status,
            new_sector_candidate: sectorResolution.status === 'new_sector_candidate',
            sector_conflicts: sectorResolution.sectors || [],
            validation_errors: [...errors, ...warnings]
        }
    };
}

/*
|--------------------------------------------------------------------------
| 1. DOWNLOAD OFFICIAL INPUT TEMPLATE
|--------------------------------------------------------------------------
*/

const TEMPLATE_INPUT_CAPACITY = 1000;

function styleInputWorksheet(worksheet, headers) {
    const endColumn = headers.length;
    worksheet.mergeCells(1, 1, 1, endColumn);
    worksheet.mergeCells(2, 1, 2, endColumn);
    worksheet.getCell(1, 1).value = `TEMPLATE INPUT DATA · ${worksheet.name}`;
    worksheet.getCell(2, 1).value = worksheet.name === 'TAHUNAN'
        ? 'Isi data mulai baris 4. STATUS NILAI=KOSONG untuk dash/NULL; INPUT memerlukan angka, termasuk 0.'
        : worksheet.name === 'TRIWULANAN'
            ? 'Isi data mulai baris 4. TAHUN boleh YYYY/Qn atau YYYY bila Q dipilih saat upload.'
            : 'Isi data mulai baris 4. Dash/kosong berarti NULL; angka 0 tetap disimpan sebagai 0.'
    worksheet.getRow(1).height = 30;
    worksheet.getRow(2).height = 24;
    worksheet.getRow(1).font = { bold: true, size: 15, color: { argb: 'FF17324D' } };
    worksheet.getRow(1).alignment = { vertical: 'middle' };
    worksheet.getRow(2).font = { size: 10, color: { argb: 'FF526579' } };
    worksheet.getRow(2).alignment = { vertical: 'middle', wrapText: true };

    const headerRow = worksheet.getRow(3);
    headerRow.height = 32;
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF176B72' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
    });

    worksheet.views = [{ state: 'frozen', ySplit: 3, activeCell: 'A4' }];
    for (let rowNumber = 4; rowNumber <= TEMPLATE_INPUT_CAPACITY + 3; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        row.height = 22;
        for (let columnNumber = 1; columnNumber <= endColumn; columnNumber++) {
            const cell = row.getCell(columnNumber);
            cell.alignment = { vertical: 'middle', wrapText: true };
            cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
        }
    }
}

async function downloadAnnualTemplate(req, res) {
    const datasetKey = normalizeDatasetKey(req.params?.datasetKey || req.query?.dataset || 'tahunan');
    const datasetConfig = resolveDatasetConfig(datasetKey);

    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'BPS Dashboard';
        workbook.subject = 'Template Input Data BPS Analytics Dashboard';
        workbook.title = 'TEMPLATE INPUT DATA';
        workbook.created = new Date();
        workbook.properties.date1904 = false;

        const sheets = [
            {
                name: 'TAHUNAN', table: 'TableTahunan', headers: ANNUAL_HEADERS,
                widths: [22, 16, 22, 34, 16, 38, 40, 18, 22, 38]
            },
            {
                name: 'TRIWULANAN', table: 'TableTriwulanan', headers: ANNUAL_HEADERS,
                widths: [22, 18, 22, 34, 16, 38, 40, 18, 22, 38]
            },
            {
                name: 'RASIO', table: 'TableRasio', headers: RATIO_HEADERS,
                widths: [22, 18, 32, 16, 40, 22]
            }
        ];

        for (const sheetConfig of sheets) {
            const worksheet = workbook.addWorksheet(sheetConfig.name);
            worksheet.columns = sheetConfig.widths.map((width, index) => ({
                key: sheetConfig.headers[index].toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                width
            }));
            worksheet.addRow([]);
            worksheet.addRow([]);
            worksheet.addTable({
                name: sheetConfig.table,
                ref: 'A3',
                headerRow: true,
                totalsRow: false,
                style: { theme: 'TableStyleMedium2', showRowStripes: true },
                columns: sheetConfig.headers.map(name => ({ name, filterButton: true })),
                rows: Array.from(
                    { length: TEMPLATE_INPUT_CAPACITY },
                    () => sheetConfig.headers.map(() => null)
                )
            });
            styleInputWorksheet(worksheet, sheetConfig.headers);
            if (sheetConfig.name === 'TAHUNAN') {
                worksheet.dataValidations.add(`H4:H${TEMPLATE_INPUT_CAPACITY + 3}`, {
                    type: 'list', allowBlank: true, formulae: ['"KOSONG,INPUT"'],
                    showInputMessage: true, promptTitle: 'Status nilai',
                    prompt: 'Gunakan KOSONG untuk NULL atau INPUT untuk angka, termasuk 0.',
                    showErrorMessage: true
                });
                worksheet.dataValidations.add(`B4:B${TEMPLATE_INPUT_CAPACITY + 3}`, {
                    type: 'whole', operator: 'between', formulae: [1900, 2200],
                    allowBlank: true, showErrorMessage: true,
                    errorTitle: 'Tahun tidak valid', error: 'Masukkan tahun antara 1900 dan 2200.'
                });
                worksheet.getColumn(2).numFmt = '0';
            } else if (sheetConfig.name === 'TRIWULANAN') {
                worksheet.getColumn(2).numFmt = '@';
            } else {
                worksheet.getColumn(2).numFmt = '@';
            }
        }

        const filename = 'TEMPLATE INPUT DATA.xlsx';

        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}"`
        );

        res.setHeader('Content-Length', buffer.length);

        return res.status(200).send(Buffer.from(buffer));

    } catch (error) {
        console.error(
            'Gagal membuat template input data:',
            error.message
        );

        return res.status(500).json({
            success: false,
            message: 'Gagal membuat template Excel input data.'
        });
    }
}

/*
|--------------------------------------------------------------------------
| 2. PREVIEW ANNUAL EXCEL UPLOAD
|--------------------------------------------------------------------------
*/

async function markDuplicateBusinessKeys(client, batchId) {
    const result = await client.query(`
        WITH keyed_rows AS (
            SELECT
                id,
                normalized_data->'business_key' AS business_key,
                COUNT(*) OVER (
                    PARTITION BY normalized_data->'business_key'
                ) AS duplicate_count
            FROM staging_excel_rows
            WHERE batch_id = $1
              AND normalized_data ? 'business_key'
        ), duplicate_rows AS (
            SELECT id
            FROM keyed_rows
            WHERE duplicate_count > 1
        )
        UPDATE staging_excel_rows staging
        SET
            validation_status = 'invalid',
            validation_errors = staging.validation_errors ||
                jsonb_build_array('Business key duplikat; periksa sektor, periode, dan rincian record.')
        FROM duplicate_rows
        WHERE staging.id = duplicate_rows.id
        RETURNING staging.id
    `, [batchId]);

    return result.rowCount;
}

async function previewAnnualUpload(req, res) {
    let client;
    let transactionStarted = false;

    try {
        const datasetKey = normalizeDatasetKey(req.query.dataset || req.params?.datasetKey || 'tahunan');
        const config = resolveDatasetConfig(datasetKey);
        const sourceWorksheetName = String(req.query.sheet_name || config.worksheetName).trim();
        const sourceSheetDatasets = WORKBOOK_SHEET_ALIASES.get(normalizeWorkbookSheetName(sourceWorksheetName)) || [];
        if (!sourceSheetDatasets.includes(datasetKey)) {
            return res.status(400).json({
                success: false,
                message: `Sheet "${sourceWorksheetName}" tidak sesuai dengan dataset "${datasetKey}".`
            });
        }
        const workbookGroupId = String(req.query.workbook_group_id || '').trim() || null;
        if (workbookGroupId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workbookGroupId)) {
            return res.status(400).json({ success: false, message: 'ID grup workbook tidak valid.' });
        }
        const importMode = String(req.query.mode || 'replace_period').trim();
        if (importMode !== 'replace_period') {
            return res.status(400).json({
                success: false,
                message: 'Mode import yang didukung saat ini hanya Replace Period.'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'File Excel belum dipilih. Gunakan field "file".'
            });
        }

        const rawYear = String(req.query.tahun || '');
        const rawQuarter = req.query.quarter;
        const { year, quarter, periodType } = parseDatasetPeriod(config, rawYear, rawQuarter);

        const filePath = req.file.path;

        const fileHash = await calculateFileSha256(filePath);

        const previewToken = crypto.randomBytes(32).toString('hex');

        const previewTokenHash = crypto
            .createHash('sha256')
            .update(previewToken)
            .digest('hex');

        client = await pool.connect();

        await client.query('BEGIN');
        transactionStarted = true;

        // -------------------------------------------------
        // Load canonical sector identities and legacy aliases.
        // -------------------------------------------------

        const sectorResult = await client.query(`
            SELECT
                s.id,
                s.code,
                s.name,
                a.source_code,
                s.id AS sector_id
            FROM sectors s
            LEFT JOIN sector_aliases a
                ON a.sector_id = s.id
        `);

        const sectorIndex = createSectorIdentityIndex(sectorResult.rows);

        // -------------------------------------------------
        // Determine new period or revision.
        // -------------------------------------------------

        const historyResult = await client.query(
            `
                        SELECT
                                EXISTS (
                                        SELECT 1
                                        FROM data_period_versions
                                        WHERE dataset_key = $1
                                            AND period_type = $2
                                            AND year = $3
                                            AND quarter IS NOT DISTINCT FROM $4
                                ) AS has_history,
                                (
                                        SELECT id
                                        FROM data_period_versions
                                        WHERE dataset_key = $1
                                            AND period_type = $2
                                            AND year = $3
                                            AND quarter IS NOT DISTINCT FROM $4
                                            AND status = 'active'
                                        ORDER BY version_number DESC
                                        LIMIT 1
                                ) AS base_version_id,
                                (
                                        SELECT activated_at
                                        FROM data_period_versions
                                        WHERE dataset_key = $1
                                            AND period_type = $2
                                            AND year = $3
                                            AND quarter IS NOT DISTINCT FROM $4
                                            AND status = 'active'
                                        ORDER BY version_number DESC
                                        LIMIT 1
                                ) AS base_version_activated_at
            `,
            [config.key, periodType, year, quarter]
        );

        const actionType = historyResult.rows[0].has_history
            ? 'revision'
            : 'new_period';

        // -------------------------------------------------
        // Create import batch.
        // -------------------------------------------------

        const batchResult = await client.query(
            `
            INSERT INTO data_import_batches (
                dataset_key,
                period_type,
                year,
                quarter,
                workbook_group_id,
                action_type,
                status,
                original_filename,
                file_sha256,
                file_size_bytes
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                'uploaded',
                $7,
                $8,
                $9
            )
            RETURNING id
            `,
            [
                config.key,
                periodType,
                year,
                quarter,
                workbookGroupId,
                actionType,
                path.basename(req.file.originalname),
                fileHash,
                req.file.size
            ]
        );

        const batchId = batchResult.rows[0].id;

        // -------------------------------------------------
        // Read workbook and prepare preview state.
        // -------------------------------------------------

        const workbook = new ExcelJS.Workbook();

        try {
            await workbook.xlsx.readFile(filePath);
        } catch (readError) {
            throw Object.assign(
                new Error('File Excel tidak valid atau rusak.', {
                    cause: readError
                }),
                { status: 400 }
            );
        }

        const worksheets = workbook.worksheets;

        let worksheetFound = false;
        let headerValidated = false;
        let totalRows = 0;
        let validRows = 0;
        let invalidRows = 0;
        let warningRows = 0;

        const previewRows = [];
        const sectorPreviewSummary = createSectorPreviewSummary();
        let stagingBuffer = [];

        async function flushStagingBuffer() {
            if (stagingBuffer.length === 0) return;

            const values = [];
            const placeholders = stagingBuffer.map(item => {
                const rowValues = [
                    batchId,
                    sourceWorksheetName,
                    item.rowNumber,
                    JSON.stringify(item.rawData),
                    item.normalizedData === null
                        ? null
                        : JSON.stringify(item.normalizedData),
                    item.validationStatus,
                    JSON.stringify(item.validationErrors)
                ];

                const markers = rowValues.map(value => {
                    values.push(value);
                    return `$${values.length}`;
                });

                return `(
                    ${markers[0]},
                    ${markers[1]},
                    ${markers[2]},
                    ${markers[3]}::jsonb,
                    ${markers[4]}::jsonb,
                    ${markers[5]},
                    ${markers[6]}::jsonb
                )`;
            });

            await client.query(
                `
                INSERT INTO staging_excel_rows (
                    batch_id,
                    worksheet_name,
                    source_row_number,
                    raw_data,
                    normalized_data,
                    validation_status,
                    validation_errors
                )
                VALUES ${placeholders.join(', ')}
                `,
                values
            );

            stagingBuffer = [];
        }

        const worksheet = worksheets.find(sheet => sheet.name === sourceWorksheetName);
        if (worksheet) worksheetFound = true;

        if (worksheet) {
            const headerRow = worksheet.getRow(3);
            if (!headerRow.hasValues) {
                throw Object.assign(
                    new Error('Header worksheet harus berada pada baris ke-3.'),
                    { status: 400 }
                );
            }

            const actualHeaders = [];
            let hasExtraHeaderValue = false;
            for (let columnNumber = 1; columnNumber <= config.headers.length; columnNumber++) {
                const value = headerRow.getCell(columnNumber).value;
                if (isFormulaCell(value)) {
                    throw Object.assign(
                        new Error('Header tidak boleh menggunakan formula.'),
                        { status: 400 }
                    );
                }
                actualHeaders.push(getCellText(value).trim());
            }
            headerRow.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
                if (columnNumber > config.headers.length && !isBlankValue(cell.value)) {
                    hasExtraHeaderValue = true;
                }
            });

            const expectedHeaders = config.headers;
            const headersMatch = actualHeaders.every((header, index) => header === expectedHeaders[index]) &&
                !hasExtraHeaderValue;
            if (!headersMatch) {
                throw Object.assign(
                    new Error(
                        'Header Excel tidak sesuai template pada baris ke-3. ' +
                        `Header wajib: ${config.headers.join(', ')}`
                    ),
                    { status: 400 }
                );
            }
            headerValidated = true;

            const dataRows = [];
            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                if (rowNumber < 4 || !row.hasValues) return;
                if (!row.values.some(value => !isBlankValue(value))) return;
                if (req.query.period_key && !matchesWorkbookPeriod(
                    row.getCell(2).value,
                    datasetKey,
                    year,
                    quarter
                )) return;
                dataRows.push({ row, rowNumber });
                if (dataRows.length > MAX_DATA_ROWS) {
                    throw Object.assign(
                        new Error(`Maksimal upload adalah ${MAX_DATA_ROWS.toLocaleString('id-ID')} baris data.`),
                        { status: 400 }
                    );
                }
            });

            for (const { row, rowNumber } of dataRows) {
                const validated = config.key === 'analisis_rasio'
                    ? validateRatioRow(
                        row,
                        rowNumber,
                        year,
                        sectorIndex,
                        quarter
                    )
                    : validateAnnualRow(
                        row,
                        rowNumber,
                        year,
                        quarter,
                        sectorIndex,
                        config.key,
                        config.headers
                    );

                if (validated === null) {
                    continue;
                }

                totalRows++;
                addSectorPreviewRecord(
                    sectorPreviewSummary,
                    validated.normalizedData
                );

                if (totalRows > MAX_DATA_ROWS) {
                    throw Object.assign(
                        new Error(
                            `Maksimal upload adalah ${MAX_DATA_ROWS.toLocaleString('id-ID')} baris data.`
                        ),
                        { status: 400 }
                    );
                }

                if (validated.validationStatus === 'invalid') {
                    invalidRows++;
                } else if (validated.validationStatus === 'warning') {
                    warningRows++;
                } else {
                    validRows++;
                }

                if (previewRows.length < PREVIEW_SAMPLE_SIZE) {
                    previewRows.push(validated.preview);
                }

                stagingBuffer.push(validated);

                if (stagingBuffer.length >= INSERT_CHUNK_SIZE) {
                    await flushStagingBuffer();
                }
            }
        }

        if (!worksheetFound) {
            throw Object.assign(
                new Error(
                    `Worksheet "${sourceWorksheetName}" tidak ditemukan.`
                ),
                { status: 400 }
            );
        }

        if (!headerValidated) {
            throw Object.assign(
                new Error('Worksheet tidak memiliki header yang valid.'),
                { status: 400 }
            );
        }

        if (totalRows === 0) {
            throw Object.assign(
                new Error('Tidak ditemukan baris data untuk diimport.'),
                { status: 400 }
            );
        }

        await flushStagingBuffer();
        const duplicateRows = await markDuplicateBusinessKeys(client, batchId);
        const validationSummary = await client.query(`
            SELECT
                COUNT(*)::INTEGER AS total,
                COUNT(*) FILTER (WHERE validation_status = 'valid')::INTEGER AS valid,
                COUNT(*) FILTER (WHERE validation_status = 'warning')::INTEGER AS warning,
                COUNT(*) FILTER (WHERE validation_status = 'invalid')::INTEGER AS invalid
            FROM staging_excel_rows
            WHERE batch_id = $1
        `, [batchId]);
        totalRows = Number(validationSummary.rows[0].total);
        validRows = Number(validationSummary.rows[0].valid);
        warningRows = Number(validationSummary.rows[0].warning);
        invalidRows = Number(validationSummary.rows[0].invalid);

        const expiresAtResult = await client.query(
            `
            UPDATE data_import_batches
            SET
                status = 'previewed',
                preview_token_hash = $2,
                preview_expires_at =
                    NOW() + (($3::integer) * INTERVAL '1 minute'),
                total_rows = $4::integer,
                valid_rows = $5::integer,
                invalid_rows = $6::integer,
                notes = $7
            WHERE id = $1
            RETURNING preview_expires_at
            `,
            [
                batchId,
                previewTokenHash,
                PREVIEW_EXPIRY_MINUTES,
                totalRows,
                validRows,
                invalidRows,
                `Replace Period preview ${config.label} ${year}${quarter ? ` Q${quarter}` : ''}`
            ]
        );

        await client.query(`
            INSERT INTO data_change_events (
                event_type,
                dataset_key,
                period_type,
                year,
                quarter,
                batch_id,
                reason,
                event_data
            )
            VALUES (
                'import_previewed',
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                jsonb_build_object(
                    'actor', 'local-user',
                    'total_rows', $7::integer,
                    'valid_rows', $8::integer,
                    'invalid_rows', $9::integer,
                    'warning_rows', $10::integer,
                    'duplicate_rows', $11::integer,
                    'base_version_id', $12::bigint,
                    'base_version_activated_at', $13::timestamptz,
                    'import_mode', $14
                )
            )
        `, [
            config.key,
            periodType,
            year,
            quarter,
            batchId,
            'Excel preview created',
            totalRows,
            validRows,
            invalidRows,
            warningRows,
            duplicateRows,
            historyResult.rows[0].base_version_id,
            historyResult.rows[0].base_version_activated_at,
            importMode
        ]);

        return res.status(200).json({
            success: true,
            message: 'Preview Excel berhasil dibuat.',
            preview: {
                batch_id: batchId,
                preview_token: previewToken,
                dataset_key: config.key,
                source_sheet: sourceWorksheetName,
                target_table: config.key === 'analisis_rasio' ? 'ratio_data' : 'characteristic_data',
                workbook_group_id: workbookGroupId,
                import_mode: importMode,
                period_type: periodType,
                year,
                quarter,
                action_type: actionType,
                status: 'previewed',
                total_rows: totalRows,
                valid_rows: validRows,
                invalid_rows: invalidRows,
                warning_rows: warningRows,
                duplicate_rows: duplicateRows,
                sample_limit: PREVIEW_SAMPLE_SIZE,
                sample_rows: previewRows,
                sector_summary: finalizeSectorPreviewSummary(sectorPreviewSummary),
                expires_at: expiresAtResult.rows[0].preview_expires_at
            }
        });

    } catch (error) {
        if (client && transactionStarted) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error(
                    'Preview rollback gagal:',
                    rollbackError.message
                );
            }
        }

        console.error(
    'Gagal memproses preview Excel:',
    error
);

        return res.status(error.status || 500).json({
            success: false,
            message: error.status
                ? error.message
                : 'Gagal memproses preview Excel. Periksa file dan koneksi database.'
        });

    } finally {
        if (client) {
            client.release();
        }

        if (req.file?.path) {
            try {
                await fs.promises.unlink(req.file.path);
            } catch (cleanupError) {
                if (cleanupError.code !== 'ENOENT') {
                    console.error(
                        'Gagal membersihkan file sementara:',
                        cleanupError.message
                    );
                }
            }
        }
    }
}

module.exports = {
    downloadAnnualTemplate,
    downloadDatasetTemplate: downloadAnnualTemplate,
    detectWorkbookSheets,
    previewAnnualUpload,
    previewDatasetUpload: previewAnnualUpload
};
