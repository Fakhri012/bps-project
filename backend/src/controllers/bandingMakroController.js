const { getBandingMakroData } = require('../services/bandingMakroService')
const { sendInternalServerError } = require('../utils/httpErrors')

async function getBandingMakro(req, res) {
  try {
    const result = await getBandingMakroData()
    const selectedYear = req.query.tahun
    const data = selectedYear
      ? result.data.filter(item => String(item.tahun) === String(selectedYear))
      : result.data

    if (
      selectedYear &&
      (!/^\d{4}$/.test(String(selectedYear)) ||
        !result.data.some(item => String(item.tahun) === String(selectedYear)))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Tahun tidak valid atau tidak tersedia.'
      })
    }

    return res.json({
      success: true,
      unit: 'triliun rupiah',
      total: data.length,
      data,
      detailTriwulanan: selectedYear
        ? result.detailTriwulanan.filter(item => String(item.tahun) === String(selectedYear))
        : result.detailTriwulanan,
      metadata: result.summary
    })
  } catch (error) {
    return sendInternalServerError(
      res,
      'Banding Makro',
      'Gagal mengambil data Banding Makro',
      error
    )
  }
}

module.exports = { getBandingMakro }
