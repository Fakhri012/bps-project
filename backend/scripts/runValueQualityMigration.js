
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/postgres');

async function main() {
    const sqlPath = path.join(
        __dirname,
        '../database/migrations/003_add_value_quality_fields.sql'
    );

    const sql = fs.readFileSync(sqlPath, 'utf8');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');

        console.log('VALUE QUALITY MIGRATION SUCCESS');
        console.log('- characteristic_data');
        console.log('- ratio_data');
        console.log('- macro_transactions');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('MIGRATION FAILED:', error.message);
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
