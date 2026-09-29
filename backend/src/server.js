require('dotenv').config()

const app = require('./app')

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log('=================================')
  console.log('BPS Analytics Dashboard API')
  console.log(`Server: http://localhost:${PORT}`)
  console.log(`Health: http://localhost:${PORT}/api/health`)
  console.log('=================================')
})