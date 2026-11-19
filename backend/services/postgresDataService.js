
const pool = require('../src/config/postgres');

/*
|--------------------------------------------------------------------------
| HELPER: NILAI YANG DITAMPILKAN
|--------------------------------------------------------------------------
|
| Nilai mentah dipertahankan untuk kompatibilitas dengan
| format Google Sheets.
|
| Untuk perhitungan, gunakan kolom NUMERIC di database,
| bukan nilai display ini.
|--------------------------------------------------------------------------
*/

function displayValue(rawValue, numericValue, status) {
    if (status === 'empty') {
        return null;
    }

    if (rawValue !== null && rawValue !== undefined) {
        return rawValue;
    }

    if (numericValue !== null && numericValue !== undefined) {
        return numericValue.toString();
    }

    return null;
}

/*
|--------------------------------------------------------------------------
| HELPER: DATA KARAKTERISTIK
|--------------------------------------------------------------------------
*/

async function getCharacteristicData(sourceKeys) {
    const result = await pool.query(
        `
        SELECT
            COALESCE(s.code, d.source_sector_code) AS "SEKTOR",
            d.period AS "TAHUN",
            d.sisi AS "SISI",
            d.jenis_neraca AS "JENIS NERACA",
            d.kode AS "KODE",
            d.rincian AS "RINCIAN",
            d.neraca_rincian AS "NERACA - RINCIAN",
            CASE WHEN d.value_status = 'empty' THEN 'KOSONG' ELSE 'INPUT' END AS "STATUS NILAI",
            CASE
                WHEN d.value_status = 'empty' THEN NULL
                WHEN d.nilai_raw IS NOT NULL THEN d.nilai_raw
                ELSE d.nilai::TEXT
            END AS "NILAI",
            d.nilai AS "NILAI_NUMERIC",
            d.nilai_raw AS "NILAI_RAW",
            d.value_status AS "VALUE_STATUS",
            d.konsep AS "KONSEP"
        FROM characteristic_data d
        INNER JOIN data_period_versions v
            ON v.id = d.period_version_id
            AND v.dataset_key = d.source_key
            AND v.period_type = d.period_type
            AND v.year = d.year
            AND v.quarter IS NOT DISTINCT FROM d.quarter
            AND v.status = 'active'
        LEFT JOIN sectors s
            ON s.id = d.sector_id
        WHERE d.source_key = ANY($1::VARCHAR[])
        ORDER BY
            CASE WHEN d.staging_row_id IS NULL THEN 1 ELSE 0 END,
            COALESCE(d.staging_row_id, d.source_order),
            d.id
        `,
        [sourceKeys]
    );

    return result.rows;
}

/*
|--------------------------------------------------------------------------
| 1. DATA TAHUNAN
|--------------------------------------------------------------------------
*/

async function getTahunanData() {
    return getCharacteristicData([
        'tahunan'
    ]);
}

/*
|--------------------------------------------------------------------------
| 2. DATA TRIWULANAN
|--------------------------------------------------------------------------
*/

async function getTriwulananData() {
    return getCharacteristicData([
        'triwulanan_1',
        'triwulanan_2'
    ]);
}

/*
|--------------------------------------------------------------------------
| 3. DATA DASHBOARD
|--------------------------------------------------------------------------
*/

async function getDashboardData() {
    const [
        tahunan,
        triwulanan
    ] = await Promise.all([
        getTahunanData(),
        getTriwulananData()
    ]);

    return {
        tahunan,
        triwulanan
    };
}

/*
|--------------------------------------------------------------------------
| 4. ANALISIS RASIO
|--------------------------------------------------------------------------
*/

async function getAnalisisRasioData() {
    const result = await pool.query(`
        SELECT
            COALESCE(s.code, d.source_sector_code) AS "SEKTOR",
            d.period AS "TAHUN",
            d.jenis_rasio AS "JENIS RASIO",
            d.kode AS "KODE",
            d.rincian AS "RINCIAN",
            CASE
                WHEN d.value_status = 'empty' THEN NULL
                WHEN d.nilai_raw IS NOT NULL THEN d.nilai_raw
                ELSE d.nilai::TEXT
            END AS "NILAI"
        FROM ratio_data d
        INNER JOIN data_period_versions v
            ON v.id = d.period_version_id
            AND v.dataset_key = 'analisis_rasio'
            AND v.period_type = d.period_type
            AND v.year = d.year
            AND v.quarter IS NOT DISTINCT FROM d.quarter
            AND v.status = 'active'
        LEFT JOIN sectors s
            ON s.id = d.sector_id
        ORDER BY
            CASE WHEN d.staging_row_id IS NULL THEN 1 ELSE 0 END,
            COALESCE(d.staging_row_id, d.source_order),
            d.id
    `);

    return result.rows;
}

/*
|--------------------------------------------------------------------------
| 5. BANDING MAKRO
|--------------------------------------------------------------------------
*/

async function getBandingMakroRows() {
    const result = await pool.query(`
        SELECT
            period AS "TAHUN",
            CASE
                WHEN value_status = 'empty' THEN NULL
                WHEN transaksi_raw IS NOT NULL THEN transaksi_raw
                ELSE transaksi::TEXT
            END AS "Transaksi",
            transaksi AS "TRANSAKSI_NUMERIC",
            transaksi_raw AS "TRANSAKSI_RAW",
            value_status AS "VALUE_STATUS"
        FROM macro_transactions
        INNER JOIN data_period_versions v
            ON v.id = macro_transactions.period_version_id
            AND v.dataset_key = 'banding_makro'
            AND v.period_type = CASE
                WHEN macro_transactions.quarter IS NULL THEN 'annual'
                ELSE 'quarterly'
            END
            AND v.year = macro_transactions.year
            AND v.quarter IS NOT DISTINCT FROM macro_transactions.quarter
            AND v.status = 'active'
        ORDER BY
            CASE WHEN macro_transactions.staging_row_id IS NULL THEN 1 ELSE 0 END,
            COALESCE(macro_transactions.staging_row_id, macro_transactions.source_order),
            macro_transactions.id
    `);

    return result.rows;
}

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {
    getTahunanData,
    getTriwulananData,
    getDashboardData,
    getAnalisisRasioData,
    getBandingMakroRows
};
