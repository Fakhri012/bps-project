function sendInternalServerError(res, context, message, error) {
  const errorName =
    error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name)
      ? error.name
      : 'Error'

  console.error(`${context}: ${errorName}`)

  return res.status(500).json({
    success: false,
    message
  })
}

module.exports = {
  sendInternalServerError
}