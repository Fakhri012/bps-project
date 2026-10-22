const express = require('express')
const cors = require('cors')
const dashboardRoutes = require('./routes/dashboardRoutes')
const analisisRasioRoutes = require('./routes/analisisRasioRoutes')

const app = express()
app.disable('x-powered-by')

const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173'
      ])
].filter(Boolean)

app.use(cors({ origin: allowedOrigins }))

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  next()
})

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