# Banding Makro source data

- `raw/tabel_kurs.xlsx` is the BI JISDOR source used by the backend. The workbook is read-only at runtime.
- The backend reads the file using a path resolved from the service module, not the current working directory.
- Keep this source file available in the private repository so Vercel includes it during deployment. Do not ignore `data/raw/`.
- For Vercel, set the backend project Root Directory to `backend/`. `vercel.json` explicitly bundles `data/raw/tabel_kurs.xlsx` with the Express function.
- Vercel's deployment filesystem is not persistent storage. Replace the source in the repository and redeploy to publish updates; the application does not write to the workbook.

The workbook contains the `Informasi Kurs Jisdor` sheet. The header row has `Tanggal` in column B and `Kurs` in column C. JISDOR is a reference exchange-rate series, not a buy/sell average.
