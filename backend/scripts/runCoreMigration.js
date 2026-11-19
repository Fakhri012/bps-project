
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const pool = require('../src/config/postgres');

async function main() {
    const sqlPath = path.join(
        __dirname,
        '../database/migrations/002_create_core_tables.sql'
    );

    if (!fs.existsSync(sqlPath)) {
        throw new Error('File migration 002 tidak ditemukan');
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query(sql);

        await client.query('COMMIT');

        console.log('====================================');
        console.log('CORE DATABASE CREATED SUCCESSFULLY');
        console.log('====================================');

        console.log('1. sectors');
        console.log('2. sector_aliases');
        console.log('3. characteristic_data');
        console.log('4. ratio_data');
        console.log('5. macro_transactions');

    } catch (error) {
        await client.query('ROLLBACK');

        console.error('CORE MIGRATION FAILED:');
        console.error(error.message);

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
