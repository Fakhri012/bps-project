const test = require('node:test')
const assert = require('node:assert/strict')

const app = require('../src/app')

test('API disables caching and only reflects approved development origins', async () => {
  const server = await new Promise(resolve => {
    const instance = app.listen(0, () => resolve(instance))
  })

  try {
    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}`
    const allowedResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://localhost:5173' }
    })
    const deniedResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://unapproved.example' }
    })
    const unapprovedRefreshResponse = await fetch(
      `${baseUrl}/api/dashboard/cache/refresh`,
      {
        method: 'POST',
        headers: { Origin: 'https://unapproved.example' }
      }
    )
    const missingOriginRefreshResponse = await fetch(
      `${baseUrl}/api/dashboard/cache/refresh`,
      { method: 'POST' }
    )

    assert.equal(allowedResponse.status, 200)
    assert.equal(
      allowedResponse.headers.get('access-control-allow-origin'),
      'http://localhost:5173'
    )
    assert.equal(allowedResponse.headers.get('cache-control'), 'no-store')
    assert.equal(
      allowedResponse.headers.get('x-powered-by'),
      null
    )
    assert.equal(
      allowedResponse.headers.get('x-content-type-options'),
      'nosniff'
    )
    assert.equal(
      deniedResponse.headers.get('access-control-allow-origin'),
      null
    )
    assert.equal(unapprovedRefreshResponse.status, 403)
    assert.equal(missingOriginRefreshResponse.status, 403)
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    })
  }
})