const {
  getAnalisisRasioData
} = require('../services/googleSheetsService')


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
    console.error(
      'Error getAnalisisRasio:',
      error
    )

    res.status(500).json({
      success: false,
      message:
        'Gagal mengambil data analisis rasio',
      error:
        error.message
    })
  }
}


module.exports = {
  getAnalisisRasio
}