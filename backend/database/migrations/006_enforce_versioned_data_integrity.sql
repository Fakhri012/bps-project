-- Enforce one active version per dataset period and unique business identities
-- within each immutable version snapshot.
--
-- Read-only preflight on the local database found no active-period conflicts or
-- duplicate characteristic, ratio, or macro keys for the definitions below.
-- Apply only after the deployment backup and migration review.
--
-- Rollback: drop the four indexes created by this migration.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_period_versions_one_active_period
    ON data_period_versions (
        dataset_key,
        period_type,
        year,
        (COALESCE(quarter, 0))
    )
    WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_characteristic_version_business_key
    ON characteristic_data (
        period_version_id,
        source_key,
        (COALESCE(sector_id::TEXT, 'code:' || UPPER(BTRIM(source_sector_code)))),
        year,
        (COALESCE(quarter, 0)),
        (UPPER(BTRIM(COALESCE(sisi, '')))),
        (UPPER(BTRIM(COALESCE(jenis_neraca, '')))),
        (UPPER(BTRIM(COALESCE(kode, '')))),
        (UPPER(BTRIM(COALESCE(rincian, '')))),
        (UPPER(BTRIM(COALESCE(neraca_rincian, ''))))
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_ratio_version_business_key
    ON ratio_data (
        period_version_id,
        (COALESCE(sector_id::TEXT, 'code:' || UPPER(BTRIM(source_sector_code)))),
        year,
        (COALESCE(quarter, 0)),
        (UPPER(BTRIM(COALESCE(jenis_rasio, '')))),
        (UPPER(BTRIM(COALESCE(kode, '')))),
        (UPPER(BTRIM(COALESCE(rincian, ''))))
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_macro_version_period
    ON macro_transactions (
        period_version_id,
        year,
        (COALESCE(quarter, 0))
    );

COMMIT;
