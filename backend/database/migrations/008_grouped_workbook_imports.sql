BEGIN;

ALTER TABLE data_import_batches
    ADD COLUMN IF NOT EXISTS workbook_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_import_batches_workbook_group
    ON data_import_batches (workbook_group_id, created_at, id)
    WHERE workbook_group_id IS NOT NULL;

COMMENT ON COLUMN data_import_batches.workbook_group_id IS
    'Groups child preview batches created from one multi-sheet Excel workbook.';

COMMIT;