export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(res) {
  return json(res, 404, { error: { code: 'NOT_FOUND', message: 'Ressource introuvable.' } });
}

export function errorResponse(res, error) {
  if (error instanceof AppError) {
    return json(res, error.status, { error: { code: error.code, message: error.message } });
  }
  console.error(error);
  return json(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' } });
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

