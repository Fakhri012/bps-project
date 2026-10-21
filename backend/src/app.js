const express = require('express')
const cors = require('cors')
const dashboardRoutes = require('./routes/dashboardRoutes')
const analisisRasioRoutes = require('./routes/analisisRasioRoutes')

const app = express()

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean)

app.use(cors({ origin: allowedOrigins }))

app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'BPS Dashboard API is running',
    timestamp: new Date().toISOString()
  })
})

// Route dashboard
app.use('/api/dashboard', dashboardRoutes)

// Route analisis rasio
app.use('/api/analisis-rasio', analisisRasioRoutes)

module.exports = app