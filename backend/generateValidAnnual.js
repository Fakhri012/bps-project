const ExcelJS = require('exceljs');
const filePath = 'Valid_Tahunan_2026.xlsx';
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('Karakteristik Tahunan');
ws.addRow(['SEKTOR','TAHUN','SISI','JENIS NERACA','KODE','RINCIAN','NERACA - RINCIAN','NILAI','KONSEP']);
ws.addRow(['CB', 2026, 'Kredit', 'Neraca', 'A1', 'PDB', 'Neraca - PDB', 1234567.89, 'Nominal']);
ws.addRow(['CB', 2026, 'Debit', 'Neraca', 'A2', 'PDB', 'Neraca - PDB', 7654321.1, 'Nominal']);
wb.xlsx.writeFile(filePath)
  .then(() => console.log('created', filePath))
  .catch(err => { console.error(err); process.exit(1); });
