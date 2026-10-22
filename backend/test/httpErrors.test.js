const test = require('node:test')
const assert = require('node:assert/strict')

const {
  sendInternalServerError
} = require('../src/utils/httpErrors')

test('internal server errors omit exception details from responses and logs', () => {
  const response = {
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
  const originalConsoleError = console.error
  let loggedMessage = ''

  console.error = (...values) => {
    loggedMessage = values.join(' ')
  }

  try {
    sendInternalServerError(
      response,
      'Sheets request',
      'Data belum dapat diproses.',
      new Error('sensitive upstream details')
    )
  } finally {
    console.error = originalConsoleError
  }

  assert.equal(response.statusCode, 500)
  assert.deepEqual(response.body, {
    success: false,
    message: 'Data belum dapat diproses.'
  })
  assert.equal(loggedMessage, 'Sheets request: Error')
  assert.equal(loggedMessage.includes('sensitive upstream details'), false)
})