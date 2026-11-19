
-- =========================================================
-- BPS DASHBOARD
-- MIGRATION 005
-- EXCEL IMPORT AND DATA VERSIONING
-- =========================================================

BEGIN;

-- =========================================================
-- 1. DATA IMPORT BATCHES
-- =========================================================

CREATE TABLE IF NOT EXISTS data_import_batches (
    id BIGSERIAL PRIMARY KEY,

    dataset_key VARCHAR(50) NOT NULL
        CHECK (
            dataset_key IN (
                'tahunan',
                'triwulanan_1',
                'triwulanan_2',
                'analisis_rasio',
                'banding_makro'
            )
        ),

    period_type VARCHAR(20) NOT NULL
        CHECK (
            period_type IN ('annual', 'quarterly')
        ),

    year SMALLINT NOT NULL
        CHECK (year BETWEEN 1900 AND 2200),

    quarter SMALLINT
        CHECK (
            quarter IS NULL
            OR quarter BETWEEN 1 AND 4
        ),

    action_type VARCHAR(20) NOT NULL
        CHECK (
            action_type IN (
                'new_period',
                'revision'
            )
        ),

    status VARCHAR(20) NOT NULL DEFAULT 'uploaded'
        CHECK (
            status IN (
                'uploaded',
                'previewed',
                'processing',
                'confirmed',
                'cancelled',
                'failed',
                'expired'
            )
        ),

    original_filename TEXT NOT NULL,

    file_sha256 VARCHAR(64),

    file_size_bytes BIGINT
        CHECK (
            file_size_bytes IS NULL
            OR file_size_bytes >= 0
        ),

    preview_token_hash VARCHAR(64),

    preview_expires_at TIMESTAMPTZ,

    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    invalid_rows INTEGER NOT NULL DEFAULT 0,

    notes TEXT,
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,

    CONSTRAINT data_import_batch_period_check
        CHECK (
            (
                period_type = 'annual'
                AND quarter IS NULL
            )
            OR
            (
                period_type = 'quarterly'
                AND quarter IS NOT NULL
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_import_batch_period
ON data_import_batches (
    dataset_key,
    period_type,
    year,
    quarter
);

CREATE INDEX IF NOT EXISTS idx_import_batch_status
ON data_import_batches(status);

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_import_preview_token
ON data_import_batches(preview_token_hash)
WHERE preview_token_hash IS NOT NULL;


-- =========================================================
-- 2. EXCEL STAGING ROWS
-- =========================================================

CREATE TABLE IF NOT EXISTS staging_excel_rows (
    id BIGSERIAL PRIMARY KEY,

    batch_id BIGINT NOT NULL
        REFERENCES data_import_batches(id)
        ON DELETE CASCADE,

    worksheet_name TEXT NOT NULL,

    source_row_number INTEGER NOT NULL
        CHECK (source_row_number > 0),

    raw_data JSONB NOT NULL,

    normalized_data JSONB,

    validation_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            validation_status IN (
                'pending',
                'valid',
                'invalid',
                'warning'
            )
        ),

    validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_excel_batch_row
        UNIQUE (
            batch_id,
            source_row_number
        )
);

CREATE INDEX IF NOT EXISTS idx_excel_staging_batch
ON staging_excel_rows(batch_id);

CREATE INDEX IF NOT EXISTS idx_excel_staging_validation
ON staging_excel_rows(
    batch_id,
    validation_status
);


-- =========================================================
-- 3. DATA PERIOD VERSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS data_period_versions (
    id BIGSERIAL PRIMARY KEY,

    dataset_key VARCHAR(50) NOT NULL
        CHECK (
            dataset_key IN (
                'tahunan',
                'triwulanan_1',
                'triwulanan_2',
                'analisis_rasio',
                'banding_makro'
            )
        ),

    period_type VARCHAR(20) NOT NULL
        CHECK (
            period_type IN ('annual', 'quarterly')
        ),

    year SMALLINT NOT NULL
        CHECK (year BETWEEN 1900 AND 2200),

    quarter SMALLINT
        CHECK (
            quarter IS NULL
            OR quarter BETWEEN 1 AND 4
        ),

    version_number INTEGER NOT NULL
        CHECK (version_number > 0),

    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'superseded',
                'deleted'
            )
        ),

    import_batch_id BIGINT
        REFERENCES data_import_batches(id)
        ON DELETE RESTRICT,

    previous_version_id BIGINT
        REFERENCES data_period_versions(id)
        ON DELETE RESTRICT,

    row_count BIGINT NOT NULL DEFAULT 0,

    change_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,

    CONSTRAINT data_period_version_consistency
        CHECK (
            (
                period_type = 'annual'
                AND quarter IS NULL
            )
            OR
            (
                period_type = 'quarterly'
                AND quarter IS NOT NULL
            )
        )
);


-- Setiap nomor versi harus unik untuk satu periode.

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_data_period_version_number
ON data_period_versions (
    dataset_key,
    period_type,
    year,
    COALESCE(quarter, 0),
    version_number
);


-- Setiap periode hanya boleh mempunyai satu versi aktif.

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_data_period_active
ON data_period_versions (
    dataset_key,
    period_type,
    year,
    COALESCE(quarter, 0)
)
WHERE status = 'active';


CREATE INDEX IF NOT EXISTS idx_period_version_lookup
ON data_period_versions (
    dataset_key,
    year,
    period_type,
    quarter
);


-- =========================================================
-- 4. DATA CHANGE EVENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS data_change_events (
    id BIGSERIAL PRIMARY KEY,

    event_type VARCHAR(30) NOT NULL
        CHECK (
            event_type IN (
                'import_previewed',
                'import_confirmed',
                'import_cancelled',
                'import_failed',
                'period_deleted',
                'version_restored'
            )
        ),

    dataset_key VARCHAR(50) NOT NULL,

    period_type VARCHAR(20) NOT NULL,

    year SMALLINT NOT NULL,

    quarter SMALLINT,

    batch_id BIGINT
        REFERENCES data_import_batches(id)
        ON DELETE RESTRICT,

    version_id BIGINT
        REFERENCES data_period_versions(id)
        ON DELETE RESTRICT,

    previous_version_id BIGINT
        REFERENCES data_period_versions(id)
        ON DELETE RESTRICT,

    reason TEXT,

    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_change_period
ON data_change_events (
    dataset_key,
    year,
    period_type,
    quarter,
    created_at
);


-- =========================================================
-- 5. ADD NEW SOURCE RELATION TO CORE TABLES
-- =========================================================

-- staging_row_id tetap menjadi relasi Google Sheets.
-- Excel akan menggunakan excel_staging_row_id.

ALTER TABLE characteristic_data
    ALTER COLUMN staging_row_id DROP NOT NULL;

ALTER TABLE characteristic_data
    ADD COLUMN IF NOT EXISTS excel_staging_row_id BIGINT,
    ADD COLUMN IF NOT EXISTS period_version_id BIGINT,
    ADD COLUMN IF NOT EXISTS source_order BIGINT;


ALTER TABLE ratio_data
    ALTER COLUMN staging_row_id DROP NOT NULL;

ALTER TABLE ratio_data
    ADD COLUMN IF NOT EXISTS excel_staging_row_id BIGINT,
    ADD COLUMN IF NOT EXISTS period_version_id BIGINT,
    ADD COLUMN IF NOT EXISTS source_order BIGINT;


ALTER TABLE macro_transactions
    ALTER COLUMN staging_row_id DROP NOT NULL;

ALTER TABLE macro_transactions
    ADD COLUMN IF NOT EXISTS excel_staging_row_id BIGINT,
    ADD COLUMN IF NOT EXISTS period_version_id BIGINT,
    ADD COLUMN IF NOT EXISTS source_order BIGINT;


-- =========================================================
-- 6. CREATE BASELINE VERSIONS FROM EXISTING DATA
-- =========================================================

-- Data karakteristik tahunan dan triwulanan.

INSERT INTO data_period_versions (
    dataset_key,
    period_type,
    year,
    quarter,
    version_number,
    status,
    row_count,
    change_reason,
    activated_at
)
SELECT
    source_key,
    period_type,
    year,
    quarter,
    1,
    'active',
    COUNT(*),
    'Versi awal hasil migrasi Google Sheets',
    NOW()
FROM characteristic_data
GROUP BY
    source_key,
    period_type,
    year,
    quarter
ON CONFLICT DO NOTHING;


-- Analisis Rasio.

INSERT INTO data_period_versions (
    dataset_key,
    period_type,
    year,
    quarter,
    version_number,
    status,
    row_count,
    change_reason,
    activated_at
)
SELECT
    'analisis_rasio',
    period_type,
    year,
    quarter,
    1,
    'active',
    COUNT(*),
    'Versi awal hasil migrasi Google Sheets',
    NOW()
FROM ratio_data
GROUP BY
    period_type,
    year,
    quarter
ON CONFLICT DO NOTHING;


-- Banding Makro.
-- NULL quarter = tahunan.
-- quarter 1-4 = triwulanan.

INSERT INTO data_period_versions (
    dataset_key,
    period_type,
    year,
    quarter,
    version_number,
    status,
    row_count,
    change_reason,
    activated_at
)
SELECT
    'banding_makro',
    CASE
        WHEN quarter IS NULL THEN 'annual'
        ELSE 'quarterly'
    END,
    year,
    quarter,
    1,
    'active',
    COUNT(*),
    'Versi awal hasil migrasi Google Sheets',
    NOW()
FROM macro_transactions
GROUP BY
    year,
    quarter
ON CONFLICT DO NOTHING;


-- =========================================================
-- 7. ADD PERIOD VERSION REFERENCES TO EXISTING DATA
-- =========================================================

UPDATE characteristic_data d
SET
    period_version_id = v.id,
    source_order = d.staging_row_id
FROM data_period_versions v
WHERE v.dataset_key = d.source_key
  AND v.period_type = d.period_type
  AND v.year = d.year
  AND v.quarter IS NOT DISTINCT FROM d.quarter
  AND d.period_version_id IS NULL;


UPDATE ratio_data d
SET
    period_version_id = v.id,
    source_order = d.staging_row_id
FROM data_period_versions v
WHERE v.dataset_key = 'analisis_rasio'
  AND v.period_type = d.period_type
  AND v.year = d.year
  AND v.quarter IS NOT DISTINCT FROM d.quarter
  AND d.period_version_id IS NULL;


UPDATE macro_transactions d
SET
    period_version_id = v.id,
    source_order = d.staging_row_id
FROM data_period_versions v
WHERE v.dataset_key = 'banding_makro'
  AND v.period_type = CASE
      WHEN d.quarter IS NULL THEN 'annual'
      ELSE 'quarterly'
  END
  AND v.year = d.year
  AND v.quarter IS NOT DISTINCT FROM d.quarter
  AND d.period_version_id IS NULL;


-- =========================================================
-- 8. VALIDATE BASELINE REFERENCES BEFORE SETTING NOT NULL
-- =========================================================

DO $$
BEGIN

    IF EXISTS (
        SELECT 1
        FROM characteristic_data
        WHERE period_version_id IS NULL
           OR source_order IS NULL
    ) THEN
        RAISE EXCEPTION
            'Migration 005 dibatalkan: terdapat characteristic_data yang belum memiliki versi.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM ratio_data
        WHERE period_version_id IS NULL
           OR source_order IS NULL
    ) THEN
        RAISE EXCEPTION
            'Migration 005 dibatalkan: terdapat ratio_data yang belum memiliki versi.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM macro_transactions
        WHERE period_version_id IS NULL
           OR source_order IS NULL
    ) THEN
        RAISE EXCEPTION
            'Migration 005 dibatalkan: terdapat macro_transactions yang belum memiliki versi.';
    END IF;

END $$;


ALTER TABLE characteristic_data
    ALTER COLUMN period_version_id SET NOT NULL,
    ALTER COLUMN source_order SET NOT NULL;

ALTER TABLE ratio_data
    ALTER COLUMN period_version_id SET NOT NULL,
    ALTER COLUMN source_order SET NOT NULL;

ALTER TABLE macro_transactions
    ALTER COLUMN period_version_id SET NOT NULL,
    ALTER COLUMN source_order SET NOT NULL;


-- =========================================================
-- 9. FOREIGN KEYS AND SOURCE CONSTRAINTS
-- =========================================================

ALTER TABLE characteristic_data
    ADD CONSTRAINT fk_characteristic_excel_staging
    FOREIGN KEY (excel_staging_row_id)
    REFERENCES staging_excel_rows(id)
    ON DELETE RESTRICT;

ALTER TABLE ratio_data
    ADD CONSTRAINT fk_ratio_excel_staging
    FOREIGN KEY (excel_staging_row_id)
    REFERENCES staging_excel_rows(id)
    ON DELETE RESTRICT;

ALTER TABLE macro_transactions
    ADD CONSTRAINT fk_macro_excel_staging
    FOREIGN KEY (excel_staging_row_id)
    REFERENCES staging_excel_rows(id)
    ON DELETE RESTRICT;


ALTER TABLE characteristic_data
    ADD CONSTRAINT fk_characteristic_period_version
    FOREIGN KEY (period_version_id)
    REFERENCES data_period_versions(id)
    ON DELETE RESTRICT;

ALTER TABLE ratio_data
    ADD CONSTRAINT fk_ratio_period_version
    FOREIGN KEY (period_version_id)
    REFERENCES data_period_versions(id)
    ON DELETE RESTRICT;

ALTER TABLE macro_transactions
    ADD CONSTRAINT fk_macro_period_version
    FOREIGN KEY (period_version_id)
    REFERENCES data_period_versions(id)
    ON DELETE RESTRICT;


-- Setiap baris harus memiliki tepat satu sumber.

ALTER TABLE characteristic_data
    ADD CONSTRAINT characteristic_exactly_one_source
    CHECK (
        (
            staging_row_id IS NOT NULL
            AND excel_staging_row_id IS NULL
        )
        OR
        (
            staging_row_id IS NULL
            AND excel_staging_row_id IS NOT NULL
        )
    );

ALTER TABLE ratio_data
    ADD CONSTRAINT ratio_exactly_one_source
    CHECK (
        (
            staging_row_id IS NOT NULL
            AND excel_staging_row_id IS NULL
        )
        OR
        (
            staging_row_id IS NULL
            AND excel_staging_row_id IS NOT NULL
        )
    );

ALTER TABLE macro_transactions
    ADD CONSTRAINT macro_exactly_one_source
    CHECK (
        (
            staging_row_id IS NOT NULL
            AND excel_staging_row_id IS NULL
        )
        OR
        (
            staging_row_id IS NULL
            AND excel_staging_row_id IS NOT NULL
        )
    );


-- Satu Excel staging row tidak boleh digunakan dua kali.

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_characteristic_excel_staging
ON characteristic_data(excel_staging_row_id)
WHERE excel_staging_row_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_ratio_excel_staging
ON ratio_data(excel_staging_row_id)
WHERE excel_staging_row_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_macro_excel_staging
ON macro_transactions(excel_staging_row_id)
WHERE excel_staging_row_id IS NOT NULL;


-- =========================================================
-- 10. DATA VERSION INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_characteristic_version_order
ON characteristic_data(
    period_version_id,
    source_order
);

CREATE INDEX IF NOT EXISTS idx_ratio_version_order
ON ratio_data(
    period_version_id,
    source_order
);

CREATE INDEX IF NOT EXISTS idx_macro_version_order
ON macro_transactions(
    period_version_id,
    source_order
);


-- =========================================================
-- 11. UPDATE VIEWS TO READ ACTIVE VERSION ONLY
-- =========================================================

CREATE OR REPLACE VIEW v_characteristic_tahunan AS
SELECT
    COALESCE(s.code, d.source_sector_code) AS "SEKTOR",
    d.period AS "TAHUN",
    d.sisi AS "SISI",
    d.jenis_neraca AS "JENIS NERACA",
    d.kode AS "KODE",
    d.rincian AS "RINCIAN",
    d.neraca_rincian AS "NERACA - RINCIAN",
    COALESCE(
        NULLIF(d.nilai_raw, ''),
        d.nilai::TEXT
    ) AS "NILAI",
    d.konsep AS "KONSEP"
FROM characteristic_data d
LEFT JOIN sectors s
    ON s.id = d.sector_id
INNER JOIN data_period_versions v
    ON v.id = d.period_version_id
    AND v.dataset_key = d.source_key
    AND v.period_type = d.period_type
    AND v.year = d.year
    AND v.quarter IS NOT DISTINCT FROM d.quarter
    AND v.status = 'active'
WHERE d.source_key = 'tahunan';


CREATE OR REPLACE VIEW v_characteristic_triwulanan AS
SELECT
    COALESCE(s.code, d.source_sector_code) AS "SEKTOR",
    d.period AS "TAHUN",
    d.sisi AS "SISI",
    d.jenis_neraca AS "JENIS NERACA",
    d.kode AS "KODE",
    d.rincian AS "RINCIAN",
    d.neraca_rincian AS "NERACA - RINCIAN",
    COALESCE(
        NULLIF(d.nilai_raw, ''),
        d.nilai::TEXT
    ) AS "NILAI",
    d.konsep AS "KONSEP"
FROM characteristic_data d
LEFT JOIN sectors s
    ON s.id = d.sector_id
INNER JOIN data_period_versions v
    ON v.id = d.period_version_id
    AND v.dataset_key = d.source_key
    AND v.period_type = d.period_type
    AND v.year = d.year
    AND v.quarter IS NOT DISTINCT FROM d.quarter
    AND v.status = 'active'
WHERE d.period_type = 'quarterly'
  AND d.source_key IN (
      'triwulanan_1',
      'triwulanan_2'
  );


CREATE OR REPLACE VIEW v_characteristic_all AS
SELECT
    COALESCE(s.code, d.source_sector_code) AS "SEKTOR",
    d.period AS "TAHUN",
    d.sisi AS "SISI",
    d.jenis_neraca AS "JENIS NERACA",
    d.kode AS "KODE",
    d.rincian AS "RINCIAN",
    d.neraca_rincian AS "NERACA - RINCIAN",
    COALESCE(
        NULLIF(d.nilai_raw, ''),
        d.nilai::TEXT
    ) AS "NILAI",
    d.konsep AS "KONSEP"
FROM characteristic_data d
LEFT JOIN sectors s
    ON s.id = d.sector_id
INNER JOIN data_period_versions v
    ON v.id = d.period_version_id
    AND v.dataset_key = d.source_key
    AND v.period_type = d.period_type
    AND v.year = d.year
    AND v.quarter IS NOT DISTINCT FROM d.quarter
    AND v.status = 'active';


CREATE OR REPLACE VIEW v_analisis_rasio AS
SELECT
    COALESCE(s.code, d.source_sector_code) AS "SEKTOR",
    d.period AS "TAHUN",
    d.jenis_rasio AS "JENIS RASIO",
    d.kode AS "KODE",
    d.rincian AS "RINCIAN",
    COALESCE(
        NULLIF(d.nilai_raw, ''),
        d.nilai::TEXT
    ) AS "NILAI"
FROM ratio_data d
LEFT JOIN sectors s
    ON s.id = d.sector_id
INNER JOIN data_period_versions v
    ON v.id = d.period_version_id
    AND v.dataset_key = 'analisis_rasio'
    AND v.period_type = d.period_type
    AND v.year = d.year
    AND v.quarter IS NOT DISTINCT FROM d.quarter
    AND v.status = 'active';


CREATE OR REPLACE VIEW v_banding_makro AS
SELECT
    d.period AS "TAHUN",
    COALESCE(
        NULLIF(d.transaksi_raw, ''),
        d.transaksi::TEXT
    ) AS "Transaksi"
FROM macro_transactions d
INNER JOIN data_period_versions v
    ON v.id = d.period_version_id
    AND v.dataset_key = 'banding_makro'
    AND v.period_type = CASE
        WHEN d.quarter IS NULL THEN 'annual'
        ELSE 'quarterly'
    END
    AND v.year = d.year
    AND v.quarter IS NOT DISTINCT FROM d.quarter
    AND v.status = 'active';


COMMIT;

-- =========================================================
-- END MIGRATION 005
-- =========================================================
