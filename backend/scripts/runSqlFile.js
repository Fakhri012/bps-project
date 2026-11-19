
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const pool = require('../src/config/postgres');

async function main() {
    const sqlPath = path.join(
        __dirname,
        '../database/migrations/001_create_staging_tables.sql'
    );

    const sql = fs.readFileSync(sqlPath, 'utf8');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query(sql);

        await client.query('COMMIT');

        console.log('================================');
        console.log('STAGING TABLES CREATED SUCCESSFULLY');
        console.log('================================');

        console.log('1. migration_batches');
        console.log('2. staging_google_sheets_rows');

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
