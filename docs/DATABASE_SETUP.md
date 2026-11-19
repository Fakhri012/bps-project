# Database Setup BPS Dashboard

Panduan ini menyiapkan PostgreSQL lokal untuk backend BPS Dashboard dengan PostgreSQL 17.

## Konfigurasi

Salin `backend/.env.example` menjadi `backend/.env`, lalu isi:

```ini
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bps_dashboard
DB_USER=postgres
DB_PASSWORD=isi_password_lokal
```

Jangan commit `.env`. Password dikirim ke PostgreSQL melalui `PGPASSWORD` untuk proses `pg_dump` dan `pg_restore` dan tidak ditulis ke argument command line atau log.

## Instal PostgreSQL 17

1. Instal PostgreSQL 17 untuk Windows.
2. Pastikan service PostgreSQL berjalan.
3. Pastikan executable tersedia di salah satu lokasi berikut:
   - `C:\Program Files\PostgreSQL\17\bin`
   - atau directory PostgreSQL 17 yang sudah ditambahkan ke `PATH`.
4. Buat password user PostgreSQL lokal yang sesuai dengan `DB_PASSWORD`.

## Backup database developer

Jalankan dari root repository:

```powershell
npm run db:backup
```

File default:

```text
backend/database/backups/bps_dashboard_full.backup
```

Custom output:

```powershell
npm run db:backup -- --output "C:\Database\bps_dashboard_full.backup"
```

Atau dari folder backend:

```powershell
cd backend
npm run db:backup -- --output "C:\Database\bps_dashboard_full.backup"
```

Backup menggunakan custom-format `pg_dump`, mencakup schema, seluruh tabel dan data, sequence, index, constraint, function, view, dan history versi. Backup divalidasi dengan `pg_restore --list` dan ukuran file harus lebih dari nol.

Direktori default backup di-ignore Git. Jangan commit file backup karena dapat berisi data operasional dan credential metadata.

## Fresh setup tanpa backup

Untuk database baru yang belum berisi tabel atau data:

```powershell
npm run db:setup
```

Root membuat database bila belum ada lalu menjalankan migration existing `001` sampai `008` dan seed yang sudah tercantum dalam migration 002 dan 007.

Database fresh bukan snapshot database utama. Belum ada data transaksi dari developer kecuali seed master/alias yang memang menjadi bagian migration existing.

## Restore full backup

Buat atau pilih database target baru yang kosong. Konfigurasi target menggunakan `DB_NAME` pada `backend/.env`, misalnya:

```ini
DB_NAME=bps_dashboard
```

Lalu jalankan:

```powershell
npm run db:setup -- --backup "C:\Database\bps_dashboard_full.backup"
```

Sebelum restore, sistem:

- memeriksa keberadaan dan ukuran backup;
- memvalidasi archive melalui `pg_restore --list`;
- memastikan database target bukan database sistem;
- memastikan database target tidak memiliki tabel atau data;
- menjalankan `pg_restore --exit-on-error --no-owner --no-acl`;
- memvalidasi tabel transaksi, sektor, alias, versi, migration 007, dan sequence.

Database yang sudah memiliki tabel atau data tidak ditimpa. Buat database baru dan jalankan lagi restore.

Jangan menggunakan opsi `--clean`. Sistem tidak mendrop database atau tabel secara otomatis.

## Jalankan backend

```powershell
npm --prefix backend install
npm run dev:backend
```

Backend berjalan pada port yang dikonfigurasi, default `3001`.

## Troubleshooting

### pg_dump atau pg_restore tidak ditemukan

Pastikan PostgreSQL 17 terpasang. Contoh lokasi:

```text
C:\Program Files\PostgreSQL\17\bin
```

Tambahkan direktori tersebut ke `PATH`, lalu buka ulang terminal.

### Database sudah terisi

Database tidak akan ditimpa. Buat database baru melalui `backend/.env` atau PostgreSQL client:

```sql
CREATE DATABASE bps_dashboard_team;
```

Set `DB_NAME=bps_dashboard_team`, pastikan database kosong, lalu jalankan setup atau restore.

### Restore gagal

Perintah dihentikan pada error pertama dan setup tidak dilaporkan berhasil. Periksa backup, koneksi, hak database, serta isi log. Jangan jalankan migration ulang setelah restore; archive sudah seharusnya berisi schema dan migration content yang dibutuhkan.

### Password authentication gagal

Periksa `DB_PASSWORD`, service PostgreSQL, dan authentication rule PostgreSQL. Jangan menaruh password nyata pada `.env.example` atau commit `.env`.

## Database testing

Pengujian harus memakai database random terisolasi, bukan `bps_dashboard`, dan `DB_NAME` tidak boleh sama dengan database utama. Jangan jalankan test destructive pada database developer.
