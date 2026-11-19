
-- =============================================
-- MIGRATION 003: VALUE QUALITY FIELDS
-- =============================================

ALTER TABLE characteristic_data
ADD COLUMN IF NOT EXISTS nilai_raw TEXT,
ADD COLUMN IF NOT EXISTS value_status VARCHAR(30)
    NOT NULL DEFAULT 'pending';

ALTER TABLE ratio_data
ADD COLUMN IF NOT EXISTS nilai_raw TEXT,
ADD COLUMN IF NOT EXISTS value_status VARCHAR(30)
    NOT NULL DEFAULT 'pending';

ALTER TABLE macro_transactions
ADD COLUMN IF NOT EXISTS transaksi_raw TEXT,
ADD COLUMN IF NOT EXISTS value_status VARCHAR(30)
    NOT NULL DEFAULT 'pending';

-- Index untuk pemeriksaan kualitas data
CREATE INDEX IF NOT EXISTS idx_characteristic_value_status
    ON characteristic_data(value_status);

CREATE INDEX IF NOT EXISTS idx_ratio_value_status
    ON ratio_data(value_status);

CREATE INDEX IF NOT EXISTS idx_macro_value_status
    ON macro_transactions(value_status);

COMMENT ON COLUMN characteristic_data.nilai_raw IS
'Nilai asli dari Google Sheets sebelum konversi numerik';

COMMENT ON COLUMN characteristic_data.value_status IS
'Status validasi nilai asli';

COMMENT ON COLUMN ratio_data.nilai_raw IS
'Nilai asli dari Google Sheets sebelum konversi numerik';

COMMENT ON COLUMN ratio_data.value_status IS
'Status validasi nilai asli';
