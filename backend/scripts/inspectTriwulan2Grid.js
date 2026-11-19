
require('dotenv').config();

const sheets = require('../src/config/googleSheets');

const SHEET_NAME = 'Karakteristik & Pivot Triwulan 2';

// Nomor record dari hasil audit staging.
const TARGET_RECORDS = [
    5237,
    5238,
    5240,
    5241,
    5242,
    5246
];

const COLUMNS = [
    'E', 'F', 'G', 'H', 'I',
    'J', 'K', 'L', 'M'
];

async function main() {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
        throw new Error('GOOGLE_SHEET_ID belum tersedia');
    }

    // Temukan baris header sebenarnya.
    const headerResponse =
        await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${SHEET_NAME}'!E:M`,
            valueRenderOption: 'FORMATTED_VALUE'
        });

    const rows = headerResponse.data.values || [];

    const headerIndex = rows.findIndex(row => {
        const headers = row.map(value =>
            String(value ?? '').trim().toUpperCase()
        );

        return [
            'SEKTOR',
            'TAHUN',
            'SISI',
            'JENIS NERACA',
            'KODE',
            'RINCIAN',
            'NILAI'
        ].every(header => headers.includes(header));
    });

    if (headerIndex === -1) {
        throw new Error('Header sheet tidak ditemukan');
    }

    const sheetRows = TARGET_RECORDS.map(index => ({
        recordIndex: index,
        physicalRow: headerIndex + index + 1
    }));

    const startRow = Math.min(
        ...sheetRows.map(row => row.physicalRow)
    );

    const endRow = Math.max(
        ...sheetRows.map(row => row.physicalRow)
    );

    console.log('Header fisik:', headerIndex + 1);
    console.log('Range:', `E${startRow}:M${endRow}`);

    // Baca grid sel sebenarnya, termasuk sel kosong.
    const response =
        await sheets.spreadsheets.get({
            spreadsheetId,
            ranges: [
                `'${SHEET_NAME}'!E${startRow}:M${endRow}`
            ],
            includeGridData: true,
            fields:
                'sheets(properties(title),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,formattedValue))))'
        });

    const gridRows =
        response.data.sheets?.[0]?.data?.[0]?.rowData || [];

    for (const target of sheetRows) {
        const row = gridRows[
            target.physicalRow - startRow
        ];

        const cells = row?.values || [];

        console.log('\n================================');
        console.log(
            'RECORD:',
            target.recordIndex,
            '| SHEET ROW:',
            target.physicalRow
        );

        const result = COLUMNS.map((column, index) => {
            const cell = cells[index] || {};

            const effective = cell.effectiveValue || {};

            let actualValue = null;

            if (effective.stringValue !== undefined) {
                actualValue = effective.stringValue;
            } else if (effective.numberValue !== undefined) {
                actualValue = effective.numberValue;
            } else if (effective.errorValue !== undefined) {
                actualValue = effective.errorValue;
            }

            return {
                column,
                formatted: cell.formattedValue ?? null,
                actual: actualValue,
                formula:
                    cell.userEnteredValue?.formulaValue ?? null
            };
        });

        console.table(result);
    }
}

main().catch(error => {
    console.error('GRID AUDIT FAILED:', error);
    process.exitCode = 1;
});
