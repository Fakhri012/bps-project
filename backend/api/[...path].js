const app = require('../src/app')

module.exports = (req, res) => {
  const requestUrl = req.url || '/'

  if (!requestUrl.startsWith('/api/')) {
    req.url = `/api${requestUrl.startsWith('/') ? '' : '/'}${requestUrl}`
  }

  return app(req, res)
}