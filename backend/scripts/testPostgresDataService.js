
require('dotenv').config();

const {
    getTahunanData,
    getTriwulananData,
    getAnalisisRasioData,
    getBandingMakroRows
} = require('../services/postgresDataService');

const pool = require('../src/config/postgres');

async function main() {
    console.log('======================================');
    console.log('TEST POSTGRES DATA SERVICE');
    console.log('======================================');

    try {
        const tahunan = await getTahunanData();
        const triwulanan = await getTriwulananData();
        const rasio = await getAnalisisRasioData();
        const makro = await getBandingMakroRows();

        console.log('\n1. DATA TAHUNAN');
        console.log('Total:', tahunan.length);
        console.log('Kolom:', Object.keys(tahunan[0] || {}));
        console.log('Contoh:', tahunan[0]);

        console.log('\n2. DATA TRIWULANAN');
        console.log('Total:', triwulanan.length);
        console.log('Kolom:', Object.keys(triwulanan[0] || {}));
        console.log('Contoh:', triwulanan[0]);

        console.log('\n3. ANALISIS RASIO');
        console.log('Total:', rasio.length);
        console.log('Kolom:', Object.keys(rasio[0] || {}));
        console.log('Contoh:', rasio[0]);

        console.log('\n4. BANDING MAKRO');
        console.log('Total:', makro.length);
        console.log('Kolom:', Object.keys(makro[0] || {}));
        console.log('Contoh:', makro[0]);

        console.log('\n======================================');
        console.log('POSTGRES DATA SERVICE TEST COMPLETE');
        console.log('======================================');

    } catch (error) {
        console.error('\nPOSTGRES DATA SERVICE TEST FAILED');
        console.error(error);
        process.exitCode = 1;

    } finally {
        await pool.end();
    }
}

main();
