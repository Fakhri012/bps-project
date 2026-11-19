
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/postgres');

async function main() {
    const sqlPath = path.join(
        __dirname,
        '../database/migrations/004_create_sheet_views.sql'
    );

    const sql = fs.readFileSync(sqlPath, 'utf8');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');

        console.log('====================================');
        console.log('SHEET VIEWS CREATED SUCCESSFULLY');
        console.log('====================================');

        console.log('1. v_characteristic_tahunan');
        console.log('2. v_characteristic_triwulanan');
        console.log('3. v_characteristic_all');
        console.log('4. v_analisis_rasio');
        console.log('5. v_banding_makro');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('VIEW MIGRATION FAILED:', error.message);
        process.exitCode = 1;

    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
