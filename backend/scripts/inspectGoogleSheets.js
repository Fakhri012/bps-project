
require('dotenv').config();

const {
    getMigrationSourceData
} = require('../services/googleSheetsService');

function normalizeHeader(value) {
    return String(value ?? '').trim().toUpperCase();
}

function isEmpty(value) {
    return value === null ||
        value === undefined ||
        String(value).trim() === '';
}

function getValue(row, header) {
    const key = Object.keys(row).find(
        item => normalizeHeader(item) === header
    );

    return key ? row[key] : undefined;
}

function inspectData(name, rows) {
    console.log('\n====================================');
    console.log(`DETAIL AUDIT: ${name}`);
    console.log('====================================');

    console.log('Total baris:', rows.length);

    if (!rows.length) return;

    const sectorCounts = {};
    const valueTypes = {};
    let emptyValues = 0;
    let populatedValues = 0;
    let repeatedHeaders = 0;

    rows.forEach(row => {
        const sector = String(
            getValue(row, 'SEKTOR') ?? '(KOSONG)'
        ).trim();

        sectorCounts[sector] =
            (sectorCounts[sector] || 0) + 1;

        const value = getValue(row, 'NILAI');

        if (isEmpty(value)) {
            emptyValues++;
        } else {
            populatedValues++;

            const type = typeof value;

            valueTypes[type] =
                (valueTypes[type] || 0) + 1;
        }

        if (normalizeHeader(sector) === 'SEKTOR') {
            repeatedHeaders++;
        }
    });

    console.log('\nDistribusi sektor:');

    Object.entries(sectorCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([sector, count]) => {
            console.log(`  ${sector}: ${count}`);
        });

    console.log('\nKualitas NILAI:');
    console.log('  Terisi:', populatedValues);
    console.log('  Kosong:', emptyValues);
    console.log('  Tipe data:', valueTypes);

    console.log('\nJumlah kemungkinan header berulang:', repeatedHeaders);

    console.log('\nContoh NILAI terisi:');

    rows.filter(row => !isEmpty(getValue(row, 'NILAI')))
        .slice(0, 5)
        .forEach(row => {
            console.log({
                sektor: getValue(row, 'SEKTOR'),
                tahun: getValue(row, 'TAHUN'),
                kode: getValue(row, 'KODE'),
                nilai: getValue(row, 'NILAI')
            });
        });

    console.log('\nContoh NILAI kosong:');

    rows.filter(row => isEmpty(getValue(row, 'NILAI')))
        .slice(0, 5)
        .forEach(row => {
            console.log({
                sektor: getValue(row, 'SEKTOR'),
                tahun: getValue(row, 'TAHUN'),
                kode: getValue(row, 'KODE'),
                rincian: getValue(row, 'RINCIAN'),
                nilai: getValue(row, 'NILAI')
            });
        });
}

function inspectQuarterOverlap(first, second) {
    console.log('\n====================================');
    console.log('AUDIT OVERLAP TRIWULANAN');
    console.log('====================================');

    const keyColumns = [
        'SEKTOR',
        'TAHUN',
        'SISI',
        'JENIS NERACA',
        'KODE',
        'RINCIAN',
        'NERACA - RINCIAN',
        'KONSEP'
    ];

    const createKey = row => JSON.stringify(
        keyColumns.map(key => {
            const value = getValue(row, key);

            return String(value ?? '')
                .trim()
                .toUpperCase();
        })
    );

    const firstKeys = new Set(first.map(createKey));
    const overlaps = second.filter(row =>
        firstKeys.has(createKey(row))
    );

    console.log('Baris sheet pertama:', first.length);
    console.log('Baris sheet kedua:', second.length);
    console.log('Kunci yang sama:', overlaps.length);

    console.log('\nContoh kemungkinan overlap:');

    overlaps.slice(0, 10).forEach(row => {
        console.log({
            sektor: getValue(row, 'SEKTOR'),
            tahun: getValue(row, 'TAHUN'),
            kode: getValue(row, 'KODE'),
            rincian: getValue(row, 'RINCIAN'),
            nilai: getValue(row, 'NILAI')
        });
    });
}

async function main() {
    console.log('MEMULAI DETAIL AUDIT GOOGLE SHEETS');

    const sources = await getMigrationSourceData();

    inspectData(
        'Karakteristik & Pivot Tahunan',
        sources.tahunan
    );

    inspectData(
        'Karakteristik & Pivot Triwulanan',
        sources.triwulanan1
    );

    inspectData(
        'Karakteristik & Pivot Triwulan 2',
        sources.triwulanan2
    );

    inspectData(
        'Analisis Rasio',
        sources.analisisRasio
    );

    inspectData(
        'Banding Makro',
        sources.bandingMakro
    );

    inspectQuarterOverlap(
        sources.triwulanan1,
        sources.triwulanan2
    );

    console.log('\nDETAIL AUDIT SELESAI');
}

main().catch(error => {
    console.error('AUDIT GAGAL:', error);
    process.exitCode = 1;
});
