const { google } = require('googleapis')
const path = require('path')

const scopes = [
  'https://www.googleapis.com/auth/spreadsheets.readonly'
]

const hasEnvironmentCredentials = [
  process.env.GOOGLE_PROJECT_ID,
  process.env.GOOGLE_CLIENT_EMAIL,
  process.env.GOOGLE_PRIVATE_KEY
].every(Boolean)

const authOptions = { scopes }

if (hasEnvironmentCredentials) {
  authOptions.credentials = {
    project_id: process.env.GOOGLE_PROJECT_ID,
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
  }
} else if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL, and GOOGLE_PRIVATE_KEY are required in production'
  )
} else {
  authOptions.keyFile = path.join(
    __dirname,
    '../../google-service-account.json'
  )
}

const auth = new google.auth.GoogleAuth(authOptions)

const sheets = google.sheets({
  version: 'v4',
  auth
})

module.exports = sheets