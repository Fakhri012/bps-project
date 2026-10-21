const express =
  require('express')


const {
  getAnalisisRasio
} = require(
  '../controllers/analisisRasioController'
)


const router =
  express.Router()


/*
|--------------------------------------------------------------------------
| ANALISIS RASIO
|--------------------------------------------------------------------------
*/

router.get(
  '/',
  getAnalisisRasio
)


module.exports =
  router