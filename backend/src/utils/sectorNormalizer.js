
function cleanSectorCode(value) {
    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ''
    ) {
        return null;
    }

    return String(value)
        .normalize('NFKC')
        .replace(/\u00A0/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

const SECTOR_ALIASES = {
    'CB 2': 'CB',
    'CB2': 'CB',

    'FC 2': 'FC',
    'FC2': 'FC',

    'GG 2': 'GG',
    'GG2': 'GG',

    'HH 2': 'HH',
    'HH2': 'HH',

    'NFC 2': 'NFC',
    'NFC2': 'NFC',

    'NFC PRIVATE 2': 'NFC PRIVATE',
    'NFCPRIVATE2': 'NFC PRIVATE',

    'NFC PUBLIC 2': 'NFC PUBLIC',
    'NFCPUBLIC2': 'NFC PUBLIC',

    'NPISHS 2': 'NPISHS',
    'NPISHS2': 'NPISHS',

    'ODC 2': 'ODC',
    'ODC2': 'ODC',

    'ROW 2': 'ROW',
    'ROW2': 'ROW',

    'TOTAL EKN 2': 'TOTAL EKN',
    'TOTALEKN2': 'TOTAL EKN'
};

const AGGREGATE_SECTORS = new Set([
    'TOTAL',
    'TOTAL EKN'
]);

function normalizeSectorCode(value) {
    const sourceCode = cleanSectorCode(value);

    if (!sourceCode) {
        return null;
    }

    return SECTOR_ALIASES[sourceCode] || sourceCode;
}

function classifySector(value) {
    const normalizedCode = normalizeSectorCode(value);

    if (!normalizedCode) {
        return 'unknown';
    }

    if (AGGREGATE_SECTORS.has(normalizedCode)) {
        return 'aggregate';
    }

    return 'sector';
}

module.exports = {
    cleanSectorCode,
    normalizeSectorCode,
    classifySector,
    SECTOR_ALIASES,
    AGGREGATE_SECTORS
};
