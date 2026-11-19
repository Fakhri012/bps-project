
-- ============================================
-- BPS DASHBOARD
-- MIGRATION 001: RAW STAGING TABLES
-- ============================================

-- Riwayat setiap proses import
CREATE TABLE IF NOT EXISTS migration_batches (
    id BIGSERIAL PRIMARY KEY,

    batch_type VARCHAR(50) NOT NULL
        DEFAULT 'google_sheets',

    status VARCHAR(20) NOT NULL
        DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'processing',
                'completed',
                'failed'
            )
        ),

    source_row_counts JSONB NOT NULL
        DEFAULT '{}'::jsonb,

    total_rows BIGINT NOT NULL DEFAULT 0,

    started_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    finished_at TIMESTAMPTZ,

    notes TEXT
);

-- Seluruh record mentah dari Google Sheets
CREATE TABLE IF NOT EXISTS staging_google_sheets_rows (
    id BIGSERIAL PRIMARY KEY,

    batch_id BIGINT NOT NULL
        REFERENCES migration_batches(id)
        ON DELETE CASCADE,

    source_key VARCHAR(50) NOT NULL
        CHECK (
            source_key IN (
                'tahunan',
                'triwulanan_1',
                'triwulanan_2',
                'analisis_rasio',
                'banding_makro'
            )
        ),

    source_sheet_name TEXT NOT NULL,

    source_record_index INTEGER NOT NULL,

    raw_data JSONB NOT NULL,

    ingested_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT unique_staging_source_record
        UNIQUE (
            batch_id,
            source_key,
            source_record_index
        )
);

-- Index untuk mempercepat pemeriksaan data
CREATE INDEX IF NOT EXISTS idx_staging_batch
    ON staging_google_sheets_rows(batch_id);

CREATE INDEX IF NOT EXISTS idx_staging_source
    ON staging_google_sheets_rows(source_key);

CREATE INDEX IF NOT EXISTS idx_staging_batch_source
    ON staging_google_sheets_rows(batch_id, source_key);

-- Catatan tabel
COMMENT ON TABLE staging_google_sheets_rows IS
'Penyimpanan data mentah dari lima sumber Google Sheets BPS';

COMMENT ON TABLE migration_batches IS
'Riwayat proses migrasi Google Sheets ke PostgreSQL';
