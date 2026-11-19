function getAllowedOrigins() {
  return [
    process.env.FRONTEND_URL,
    ...(process.env.NODE_ENV === 'production'
      ? []
      : [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:4173',
          'http://127.0.0.1:4173'
        ])
  ].filter(Boolean)
}

module.exports = getAllowedOrigins
