/*
|--------------------------------------------------------------------------
| UNIT DATA DASHBOARD
|--------------------------------------------------------------------------
|
| Seluruh kolom NILAI pada dataset dashboard menggunakan
| satuan Triliun Rupiah.
|
| PENTING:
| Angka NILAI dari Google Sheets sudah berada dalam
| satuan Triliun Rupiah.
|
| Contoh:
|
| 42.020042575157020
|
| berarti:
|
| 42,020042575157020 Triliun Rupiah
|
| Tidak boleh dikali 1.000.
| Tidak boleh dibagi 1.000.
|
|--------------------------------------------------------------------------
*/

const DASHBOARD_VALUE_UNIT = Object.freeze({
  code: 'IDR_TRILLION',

  label: 'Triliun Rupiah',

  shortLabel: 'T',

  currency: 'IDR',

  scale: 1
})


module.exports = {
  DASHBOARD_VALUE_UNIT
}