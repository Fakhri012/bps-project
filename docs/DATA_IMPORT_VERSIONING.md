# Data Import and Version Management

## Architecture

The Manajemen Data page reads all metadata from PostgreSQL through
`backend/services/postgresDataService.js`, `backend/services/dashboardCacheService.js`,
and the data-management controller. Excel import capabilities are exposed by
the management summary and currently include Karakteristik Tahunan, both
Karakteristik Triwulanan datasets, and Analisis Rasio. Banding Makro remains
blocked until its Excel layout can be mapped to the existing macro data model.

Migration 005 provides the import batches, Excel staging rows, period versions,
change events, and `period_version_id` links on the core tables. Existing rows
are attached to the active baseline version. Runtime dashboard queries join the
active version; historical rows remain stored when a version is superseded or
soft-deleted.

## Excel Upload Flow

1. Select the dataset, year, and (for quarterly characteristics) quarter, then
  download that dataset's workbook template.
2. Upload an `.xlsx` file of at most 15 MB. The backend reads the configured
  worksheet and validates its exact headers, period, sectors, and values.
3. Raw and normalized rows are stored in `staging_excel_rows` in the same
  transaction as the preview batch and preview audit event.
4. Inspect the preview. Invalid rows block confirmation. Warning rows are
   allowed only when at least one valid row is present; raw values and quality
   statuses remain stored.
5. Confirm with the batch ID, one-time preview token, and explicit consent.
6. Confirmation revalidates staged rows, inserts into `characteristic_data` or
  `ratio_data` according to dataset, changes the prior active version to
  `superseded`, records the audit event, and marks the batch confirmed in one
  transaction.
7. After commit, the internal dashboard cache refresh bypasses the manual
   60-second refresh throttle. If refresh fails, the API reports that the data
   is saved but the cache needs a retry; it does not roll back committed data.

Preview tokens are random 256-bit values. Only their SHA-256 hashes are stored;
they expire after 30 minutes and are cleared after confirmation. A row-lock on
the batch and a transaction-scoped period lock prevent duplicate confirmation
and conflicting version activation.

## Version Lifecycle

- `active`: the version selected by runtime views and dashboard queries.
- `superseded`: a prior version retained after revision or restore.
- `deleted`: soft-deleted; core rows remain in place and the version is excluded
  from active-version views.
- Restore changes version statuses, records an event, commits, then refreshes
  the dashboard cache.
- Soft delete changes status and records an event; no core rows are deleted.
- Restore of a deleted version uses the same restore endpoint and status
  transition.

Every version mutation uses PostgreSQL transactions and records an entry in
`data_change_events`. There is no physical delete endpoint.

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/data-import/templates/:datasetKey?tahun=YYYY&quarter=1-4` | Download a supported dataset template |
| POST | `/api/data-import/preview?dataset=:datasetKey&tahun=YYYY&quarter=1-4` | Upload and preview Excel (`multipart/form-data`, field `file`) |
| GET | `/api/data-import/management/summary` | Dataset, active-period, version, batch summary |
| GET | `/api/data-import/management/batches` | Paginated/filterable import history |
| GET | `/api/data-import/management/batches/:batchId` | Batch validation detail and staging rows |
| POST | `/api/data-import/management/batches/:batchId/confirm` | Confirm a valid preview |
| GET | `/api/data-import/management/versions` | Paginated/filterable version history |
| GET | `/api/data-import/management/versions/:versionId` | Version comparison and data sample |
| POST | `/api/data-import/management/versions/:versionId/restore` | Activate a historical/deleted version |
| POST | `/api/data-import/management/versions/:versionId/delete` | Soft-delete a version |
| GET | `/api/data-import/management/audit` | Paginated change events |
| POST | `/api/data-import/management/cache/retry` | Retry cache refresh after a committed change |

Supported `datasetKey` values are `tahunan`, `triwulanan_1`, `triwulanan_2`,
and `analisis_rasio`. Quarterly imports require `quarter=1`, `2`, `3`, or `4`.
Banding Makro is intentionally not importable until its Excel mapping is
verified.

Example upload:

```powershell
curl.exe -X POST "http://localhost:3001/api/data-import/preview?dataset=triwulanan_1&tahun=2026&quarter=2" -F "file=@PATH_TO_QUARTERLY_FILE.xlsx"
```

Example confirmation body (use the token returned by preview):

```json
{
  "preview_token": "<preview token>",
  "confirm": true,
  "reason": "Approved annual data revision"
}
```

Restore and soft-delete bodies accept an optional `reason` string. List
endpoints accept `page`, `limit`, dataset/status/year filters, and `search` where
applicable. Responses use JSON with `success`, `message`, and `data` fields;
list responses also include pagination metadata.

## Backup and Operation

Before enabling mutating endpoints in a production environment, take a database
backup using the deployment's approved PostgreSQL credentials and retention
policy. A custom-format backup can be produced with:

```powershell
pg_dump --format=custom --file=bps-dashboard-before-import.dump --dbname=bps_dashboard
```

Run the backend from the repository root with `npm run dev:backend`, the
frontend with `npm run dev:frontend`, backend tests with `npm test`, and the
frontend production build with `npm run build`.

## Security and Current Limitations

The project currently has no authentication. Upload, confirm, restore,
soft-delete, and cache-retry endpoints must not be exposed to the public
internet until authentication/authorization or network access controls are in
place. CORS is not authentication.

Annual 2026 and 2027 data must not be synthesized from quarterly data or
placeholders. No schema migration was run as part of this feature work.