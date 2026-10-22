const {
  getAnalisisRasioData
} = require('../services/googleSheetsService')

const {
  sendInternalServerError
} = require('../utils/httpErrors')


/*
|--------------------------------------------------------------------------
| GET ANALISIS RASIO
|--------------------------------------------------------------------------
*/

async function getAnalisisRasio(
  req,
  res
) {
  try {
    const data =
      await getAnalisisRasioData()

    res.json({
      success: true,
      data
    })

  } catch (error) {
    return sendInternalServerError(
      res,
      'Analisis rasio',
      'Gagal mengambil data analisis rasio',
      error
    )
  }
}


module.exports = {
  getAnalisisRasio
}