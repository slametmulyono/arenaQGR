export function notFound(req, res) {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('[api-error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Terjadi kesalahan pada server.' : err.message,
    ...(process.env.NODE_ENV !== 'production' && status === 500 ? { detail: err.message } : {}),
  });
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
