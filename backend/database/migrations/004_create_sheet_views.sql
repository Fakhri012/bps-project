
-- =====================================================
-- MIGRATION 004: GOOGLE SHEETS TEMPLATE VIEWS
-- =====================================================

-- =====================================================
-- 1. KARAKTERISTIK TAHUNAN
-- =====================================================

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
LEFT JOIN sectors s ON s.id = d.sector_id
WHERE d.source_key = 'tahunan';


-- =====================================================
-- 2. KARAKTERISTIK TRIWULANAN
-- =====================================================

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
LEFT JOIN sectors s ON s.id = d.sector_id
WHERE d.period_type = 'quarterly'
  AND d.source_key IN (
      'triwulanan_1',
      'triwulanan_2'
  );


-- =====================================================
-- 3. GABUNGAN TAHUNAN DAN TRIWULANAN
-- =====================================================

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
LEFT JOIN sectors s ON s.id = d.sector_id;


-- =====================================================
-- 4. ANALISIS RASIO
-- =====================================================

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
LEFT JOIN sectors s ON s.id = d.sector_id;


-- =====================================================
-- 5. BANDING MAKRO
-- =====================================================

CREATE OR REPLACE VIEW v_banding_makro AS
SELECT
    period AS "TAHUN",
    COALESCE(
        NULLIF(transaksi_raw, ''),
        transaksi::TEXT
    ) AS "Transaksi"
FROM macro_transactions;


-- =====================================================
-- END MIGRATION 004
-- =====================================================
