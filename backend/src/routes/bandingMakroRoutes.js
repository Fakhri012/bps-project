const express = require('express')
const { getBandingMakro } = require('../controllers/bandingMakroController')

const router = express.Router()

router.get('/', getBandingMakro)

module.exports = router
