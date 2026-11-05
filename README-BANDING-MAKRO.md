# Panduan Pengguna: Banding Makro

## 1. Mengenal Banding Makro

Halaman **Banding Makro** menyajikan data transaksi berjalan tahunan dan membantu pengguna melihat nilainya dalam dua satuan: nilai transaksi dalam **Juta USD** dan hasil konversi dalam **triliun rupiah**. Konversi menggunakan rata-rata JISDOR tahunan.

## 2. Mengenal Informasi yang Ditampilkan

Di bagian atas halaman terdapat tiga KPI:

- **Transaksi Berjalan** — hasil konversi untuk tahun yang sedang ditampilkan pada KPI, dalam triliun rupiah. Tahun dituliskan tepat di bawah nilainya.
- **Rata-rata JISDOR** — rata-rata kurs tahunan dalam IDR/USD. Nilainya merupakan rata-rata sederhana dari rata-rata triwulan yang tersedia.
- **Cakupan kurs** — jumlah triwulan yang memiliki data dari empat triwulan dalam setahun. Keterangan di bawahnya menunjukkan jumlah observasi dan rentang tanggal; label *parsial* muncul jika cakupan kurs ditandai parsial.

Jika filter tahun aktif, KPI menampilkan tahun tersebut. Jika semua tahun ditampilkan, KPI merangkum tahun paling akhir yang tersedia pada data.

## 3. Cara Menggunakan Filter Tahun

1. Temukan pilihan **Filter tahun** di bagian grafik.
2. Pilih tahun yang ingin diperiksa. Grafik, tabel, dan KPI akan menampilkan data untuk tahun tersebut.
3. Untuk kembali melihat seluruh data, pilih **Semua tahun**.

## 4. Cara Membaca Grafik

Grafik **Perkembangan Transaksi Berjalan** menampilkan hasil konversi tahunan dalam **triliun rupiah**:

- Sumbu mendatar menunjukkan tahun.
- Sumbu tegak menunjukkan nilai dalam triliun rupiah (Rp triliun).
- Garis menunjukkan nilai transaksi berjalan yang sudah dikonversi. Garis putus-putus menandai nilai nol.
- Nilai di bawah garis nol berarti negatif; nilai di atasnya berarti positif.

Grafik menampilkan satu seri, bukan dua garis terpisah untuk nilai Juta USD dan hasil konversi. Arahkan penunjuk ke titik grafik untuk melihat tahun dan nilai konversinya. Jika kurs untuk suatu tahun tidak tersedia, nilai konversinya tidak digambarkan sebagai nol.

## 5. Cara Membaca Tabel

Tabel **Data tahunan** memuat kolom berikut:

| Kolom | Arti |
|---|---|
| **Tahun** | Tahun transaksi. Label *parsial* menandakan cakupan kurs parsial. |
| **Transaksi (juta USD)** | Nilai transaksi dalam Juta USD. |
| **Rata-rata JISDOR (IDR/USD)** | Rata-rata kurs JISDOR tahunan, dalam rupiah per USD. |
| **Hasil (triliun rupiah)** | Nilai transaksi setelah dikonversi ke triliun rupiah. |
| **Cakupan kurs** | Triwulan yang tersedia, jumlah observasi harian, dan rentang tanggal yang tercatat. |

Contoh: baris **2024** menunjukkan transaksi **-8.583 juta USD**, rata-rata JISDOR **15.861,19 IDR/USD**, hasil konversi **-136,14 triliun rupiah**, dan cakupan **Q1–Q4**, dengan **238 observasi** dari **2024-01-02 sampai 2024-12-31**.

## 6. Memahami Satuan dan Perhitungan

Nilai transaksi menggunakan satuan **Juta USD**. Dengan format angka yang digunakan pada halaman, `-8.583` berarti minus 8.583 juta USD. Kurs dinyatakan dalam rupiah per USD dan menggunakan rata-rata JISDOR—bukan kurs jual atau kurs beli. Hasil konversi dinyatakan dalam **triliun rupiah**.

Rumus yang digunakan:

`Transaksi (Juta USD) × Rata-rata JISDOR tahunan ÷ 1.000.000`

Contoh:

- Transaksi: **-8.583 juta USD**
- Rata-rata JISDOR: **Rp15.861,1894/USD**
- Hasil: **sekitar -136,14 triliun rupiah**

## 7. Memahami Rata-rata JISDOR dan Cakupan Data

Data JISDOR harian dirata-ratakan terlebih dahulu untuk setiap triwulan. Rata-rata dari triwulan yang tersedia kemudian dirata-ratakan untuk mendapatkan nilai tahunan. Setiap triwulan yang tersedia memiliki bobot yang sama dalam rata-rata tahunan, terlepas dari jumlah observasi hariannya.

Karena itu, tahun dengan cakupan triwulan yang belum lengkap atau parsial tetap dapat memiliki rata-rata tahunan. Periksa keterangan cakupan sebelum membandingkan nilai kurs antarperiode. Tabel dan KPI cakupan menampilkan jumlah observasi serta rentang tanggal yang tersedia. Label *parsial* juga dapat muncul ketika hanya sebagian periode tercakup; jumlah triwulan yang tersedia saja tidak selalu menjelaskan kelengkapan seluruh tanggal dalam triwulan.

## 8. Memahami Data Tidak Tersedia

Tahun tertentu mungkin tidak memiliki kurs JISDOR pada sumber data, misalnya karena periode tersebut berada di luar rentang data kurs yang tersedia. Jika kurs tidak tersedia, transaksi untuk tahun itu tidak dapat dikonversi. Hal ini ditampilkan sebagai **Tidak tersedia** pada hasil konversi—bukan sebagai nol. Angka transaksi dalam Juta USD tetap dapat dibaca pada tabel.

## 9. Contoh Interpretasi Data

Untuk tahun 2024, rata-rata JISDOR adalah **Rp15.861,1894/USD**. Transaksinya sebesar **-8.583 juta USD**, dan hasil konversinya sekitar **-136,14 triliun rupiah**.

Tanda negatif menunjukkan bahwa nilai transaksi yang dicatat bertanda negatif; tanda tersebut tetap dipertahankan setelah konversi. Angka ini menjelaskan nilai dan arahnya, tetapi tidak dengan sendirinya menjelaskan penyebab atau dampak ekonomi.

## 10. Catatan untuk Pengguna

- Perhatikan satuan sebelum membandingkan angka: transaksi dalam Juta USD, kurs dalam IDR/USD, dan hasil konversi dalam triliun rupiah.
- Periksa jumlah triwulan, jumlah observasi, rentang tanggal, dan label *parsial* sebelum membandingkan rata-rata kurs antarperiode.
- Jangan mengartikan **Tidak tersedia** sebagai nol.
- Gunakan keterangan pada grafik dan tabel sebagai acuan interpretasi.
