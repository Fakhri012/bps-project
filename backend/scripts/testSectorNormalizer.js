
const {
    normalizeSectorCode
} = require('../src/utils/sectorNormalizer');

const testCases = [
    ['FC 2', 'FC'],
    ['FC2', 'FC'],
    ['GG 2', 'GG'],
    ['GG2', 'GG'],
    ['HH 2', 'HH'],
    ['NFC 2', 'NFC'],
    ['NFC', 'NFC'],
    ['NFC PRIVATE 2', 'NFC PRIVATE'],
    ['NFC PRIVATE', 'NFC PRIVATE'],
    ['NFC PUBLIC 2', 'NFC PUBLIC'],
    ['NFC PUBLIC', 'NFC PUBLIC'],
    ['NPISHS 2', 'NPISHS'],
    ['NPISHS', 'NPISHS'],
    ['ODC 2', 'ODC'],
    ['ODC', 'ODC'],
    ['ROW 2', 'ROW'],
    ['ROW', 'ROW'],
    ['TOTAL EKN 2', 'TOTAL EKN']
];

let failed = 0;

console.log('TEST NORMALISASI SEKTOR BPS');
console.log('================================');

for (const [source, expected] of testCases) {
    const actual = normalizeSectorCode(source);
    const passed = actual === expected;

    if (!passed) failed++;

    console.log(
        `${passed ? 'PASS' : 'FAIL'} | ${source} -> ${actual} | Expected: ${expected}`
    );
}

console.log('================================');
console.log(`Total: ${testCases.length}`);
console.log(`Berhasil: ${testCases.length - failed}`);
console.log(`Gagal: ${failed}`);

if (failed > 0) {
    process.exitCode = 1;
}
