
-- =====================================================
-- BPS DASHBOARD
-- MIGRATION 002: CORE DATABASE TABLES
-- =====================================================

-- =====================================================
-- 1. MASTER SECTORS
-- =====================================================

CREATE TABLE IF NOT EXISTS sectors (
    id BIGSERIAL PRIMARY KEY,

    code VARCHAR(50) NOT NULL UNIQUE,

    name VARCHAR(150) NOT NULL,

    sector_type VARCHAR(20) NOT NULL DEFAULT 'sector'
        CHECK (
            sector_type IN ('sector', 'aggregate')
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================
-- 2. SECTOR ALIASES
-- =====================================================

CREATE TABLE IF NOT EXISTS sector_aliases (
    id BIGSERIAL PRIMARY KEY,

    source_code VARCHAR(80) NOT NULL UNIQUE,

    sector_id BIGINT NOT NULL
        REFERENCES sectors(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Master sector
INSERT INTO sectors (code, name, sector_type)
VALUES
    ('CB', 'CB', 'sector'),
    ('FC', 'FC', 'sector'),
    ('GG', 'GG', 'sector'),
    ('HH', 'HH', 'sector'),
    ('NFC', 'NFC', 'sector'),
    ('NFC PRIVATE', 'NFC PRIVATE', 'sector'),
    ('NFC PUBLIC', 'NFC PUBLIC', 'sector'),
    ('NPISHS', 'NPISHS', 'sector'),
    ('ODC', 'ODC', 'sector'),
    ('ROW', 'ROW', 'sector'),
    ('TOTAL', 'TOTAL', 'aggregate'),
    ('TOTAL EKN', 'TOTAL EKN', 'aggregate')
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    sector_type = EXCLUDED.sector_type,
    updated_at = NOW();


-- Mapping seluruh variasi kode sumber
INSERT INTO sector_aliases (source_code, sector_id)
SELECT
    mapping.source_code,
    sectors.id
FROM (
    VALUES
        ('CB', 'CB'),
        ('CB 2', 'CB'),
        ('CB2', 'CB'),

        ('FC', 'FC'),
        ('FC 2', 'FC'),
        ('FC2', 'FC'),

        ('GG', 'GG'),
        ('GG 2', 'GG'),
        ('GG2', 'GG'),

        ('HH', 'HH'),
        ('HH 2', 'HH'),
        ('HH2', 'HH'),

        ('NFC', 'NFC'),
        ('NFC 2', 'NFC'),
        ('NFC2', 'NFC'),

        ('NFC PRIVATE', 'NFC PRIVATE'),
        ('NFC PRIVATE 2', 'NFC PRIVATE'),
        ('NFCPRIVATE2', 'NFC PRIVATE'),

        ('NFC PUBLIC', 'NFC PUBLIC'),
        ('NFC PUBLIC 2', 'NFC PUBLIC'),
        ('NFCPUBLIC2', 'NFC PUBLIC'),

        ('NPISHS', 'NPISHS'),
        ('NPISHS 2', 'NPISHS'),
        ('NPISHS2', 'NPISHS'),

        ('ODC', 'ODC'),
        ('ODC 2', 'ODC'),
        ('ODC2', 'ODC'),

        ('ROW', 'ROW'),
        ('ROW 2', 'ROW'),
        ('ROW2', 'ROW'),

        ('TOTAL', 'TOTAL'),
        ('TOTAL EKN', 'TOTAL EKN'),
        ('TOTAL EKN 2', 'TOTAL EKN'),
        ('TOTALEKN2', 'TOTAL EKN')
) AS mapping(source_code, sector_code)
JOIN sectors
    ON sectors.code = mapping.sector_code
ON CONFLICT (source_code) DO UPDATE
SET sector_id = EXCLUDED.sector_id;


-- =====================================================
-- 3. CHARACTERISTIC DATA
-- Tahunan + Triwulanan dalam satu tabel
-- =====================================================

CREATE TABLE IF NOT EXISTS characteristic_data (
    id BIGSERIAL PRIMARY KEY,

    source_key VARCHAR(30) NOT NULL
        CHECK (
            source_key IN (
                'tahunan',
                'triwulanan_1',
                'triwulanan_2'
            )
        ),

    period_type VARCHAR(20) NOT NULL
        CHECK (
            period_type IN ('annual', 'quarterly')
        ),

    period VARCHAR(20) NOT NULL,

    year SMALLINT NOT NULL
        CHECK (year BETWEEN 1900 AND 2200),

    quarter SMALLINT
        CHECK (quarter IS NULL OR quarter BETWEEN 1 AND 4),

    source_sector_code VARCHAR(80) NOT NULL,

    sector_id BIGINT
        REFERENCES sectors(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    sisi TEXT,

    jenis_neraca TEXT,

    kode VARCHAR(100),

    rincian TEXT,

    neraca_rincian TEXT,

    nilai NUMERIC(38,18),

    konsep TEXT,

    staging_row_id BIGINT NOT NULL UNIQUE
        REFERENCES staging_google_sheets_rows(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT characteristic_period_consistency
        CHECK (
            (period_type = 'annual' AND quarter IS NULL)
            OR
            (period_type = 'quarterly' AND quarter IS NOT NULL)
        )
);


-- =====================================================
-- 4. RATIO DATA
-- =====================================================

CREATE TABLE IF NOT EXISTS ratio_data (
    id BIGSERIAL PRIMARY KEY,

    period_type VARCHAR(20) NOT NULL
        CHECK (
            period_type IN ('annual', 'quarterly')
        ),

    period VARCHAR(20) NOT NULL,

    year SMALLINT NOT NULL
        CHECK (year BETWEEN 1900 AND 2200),

    quarter SMALLINT
        CHECK (quarter IS NULL OR quarter BETWEEN 1 AND 4),

    source_sector_code VARCHAR(80) NOT NULL,

    sector_id BIGINT
        REFERENCES sectors(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    jenis_rasio TEXT,

    kode VARCHAR(100),

    rincian TEXT,

    nilai NUMERIC(38,18),

    staging_row_id BIGINT NOT NULL UNIQUE
        REFERENCES staging_google_sheets_rows(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ratio_period_consistency
        CHECK (
            (period_type = 'annual' AND quarter IS NULL)
            OR
            (period_type = 'quarterly' AND quarter IS NOT NULL)
        )
);


-- =====================================================
-- 5. MACRO TRANSACTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS macro_transactions (
    id BIGSERIAL PRIMARY KEY,

    period VARCHAR(20) NOT NULL,

    year SMALLINT NOT NULL
        CHECK (year BETWEEN 1900 AND 2200),

    quarter SMALLINT
        CHECK (quarter IS NULL OR quarter BETWEEN 1 AND 4),

    transaksi NUMERIC(38,18),

    staging_row_id BIGINT NOT NULL UNIQUE
        REFERENCES staging_google_sheets_rows(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================
-- 6. INDEXES
-- =====================================================

-- Sector indexes
CREATE INDEX IF NOT EXISTS idx_sector_aliases_sector
    ON sector_aliases(sector_id);

-- Characteristic indexes
CREATE INDEX IF NOT EXISTS idx_characteristic_period
    ON characteristic_data(period_type, year, quarter);

CREATE INDEX IF NOT EXISTS idx_characteristic_sector
    ON characteristic_data(sector_id);

CREATE INDEX IF NOT EXISTS idx_characteristic_source
    ON characteristic_data(source_key);

CREATE INDEX IF NOT EXISTS idx_characteristic_code
    ON characteristic_data(kode);

CREATE INDEX IF NOT EXISTS idx_characteristic_sector_period
    ON characteristic_data(sector_id, period_type, year, quarter);

-- Ratio indexes
CREATE INDEX IF NOT EXISTS idx_ratio_period
    ON ratio_data(period_type, year, quarter);

CREATE INDEX IF NOT EXISTS idx_ratio_sector
    ON ratio_data(sector_id);

CREATE INDEX IF NOT EXISTS idx_ratio_code
    ON ratio_data(kode);

-- Macro indexes
CREATE INDEX IF NOT EXISTS idx_macro_year_quarter
    ON macro_transactions(year, quarter);


-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON TABLE sectors IS
'Master sektor BPS dengan kode sektor kanonis';

COMMENT ON TABLE sector_aliases IS
'Mapping kode sektor asli ke satu identitas sektor kanonis';

COMMENT ON TABLE characteristic_data IS
'Data karakteristik tahunan dan triwulanan dalam satu tabel';

COMMENT ON TABLE ratio_data IS
'Data Analisis Rasio BPS';

COMMENT ON TABLE macro_transactions IS
'Data transaksi Banding Makro BPS';

-- =====================================================
-- END MIGRATION 002
-- =====================================================
