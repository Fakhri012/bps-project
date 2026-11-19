const crypto = require('node:crypto')
const test = require('node:test')
const assert = require('node:assert/strict')

const { validatePreviewToken } = require('../src/controllers/dataManagementController')

test('preview tokens require a matching SHA-256 hash', () => {
  const token = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const differentToken = `${token[0] === '0' ? '1' : '0'}${token.slice(1)}`

  assert.equal(validatePreviewToken(token, hash), true)
  assert.equal(validatePreviewToken(differentToken, hash), false)
  assert.equal(validatePreviewToken('short-token', hash), false)
  assert.equal(validatePreviewToken(token, null), false)
})