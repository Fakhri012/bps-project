BEGIN;

ALTER TABLE sector_aliases
    ALTER COLUMN source_code TYPE VARCHAR(200);

DO $$
DECLARE
    mapping RECORD;
    target_ids BIGINT[];
    existing_sector_ids BIGINT[];
    normalized_alias TEXT;
BEGIN
    FOR mapping IN
        SELECT * FROM (VALUES
            ('KORPORASI FINANSIAL (FINANCIAL CORPORATIONS)', 'FC'),
            ('KORPORASI NONFINANSIAL (NONFINANCIAL CORPORATIONS)', 'NFC'),
            ('LEMBAGA NON PROFIT YANG MELAYANI RUMAH TANGGA (NONPROFIT INSTITUTIONS SERVING HOUSEHOLDS)', 'NPISHS'),
            ('LUAR NEGERI (REST OF THE WORLD)', 'ROW'),
            ('PEMERINTAH UMUM (GENERAL GOVERNMENT)', 'GG'),
            ('RUMAH TANGGA (HOUSEHOLDS)', 'HH'),
            ('TOTAL', 'TOTAL'),
            ('TOTAL EKONOMI (TOTAL ECONOMY)', 'TOTAL EKN')
        ) AS official_names(source_code, target_code)
    LOOP
        normalized_alias := UPPER(REGEXP_REPLACE(BTRIM(mapping.source_code), '[[:space:]]+', ' ', 'g'));

        SELECT ARRAY_AGG(id)
        INTO target_ids
        FROM sectors
        WHERE UPPER(REGEXP_REPLACE(BTRIM(code), '[[:space:]]+', ' ', 'g')) = UPPER(mapping.target_code);

        IF COALESCE(ARRAY_LENGTH(target_ids, 1), 0) <> 1 THEN
            RAISE EXCEPTION 'Official sector alias "%" requires exactly one master code "%"; found %',
                mapping.source_code, mapping.target_code, COALESCE(ARRAY_LENGTH(target_ids, 1), 0);
        END IF;

        SELECT ARRAY_AGG(DISTINCT sector_id)
        INTO existing_sector_ids
        FROM sector_aliases
        WHERE UPPER(REGEXP_REPLACE(BTRIM(source_code), '[[:space:]]+', ' ', 'g')) = normalized_alias;

        IF existing_sector_ids IS NOT NULL AND (
            ARRAY_LENGTH(existing_sector_ids, 1) <> 1 OR
            existing_sector_ids[1] <> target_ids[1]
        ) THEN
            RAISE EXCEPTION 'Official sector alias "%" conflicts with an existing alias mapping', mapping.source_code;
        END IF;

        IF existing_sector_ids IS NULL THEN
            INSERT INTO sector_aliases (source_code, sector_id)
            VALUES (mapping.source_code, target_ids[1]);
        END IF;
    END LOOP;
END
$$;

COMMIT;