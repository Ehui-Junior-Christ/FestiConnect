export class AppError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function notFound(res) {
  return json(res, 404, { error: { code: 'NOT_FOUND', message: 'Ressource introuvable.' } });
}

export function errorResponse(res, error, context = '') {
  if (res.headersSent) {
    // Reponse deja partiellement envoyee : on coupe proprement la connexion.
    if (!(error instanceof AppError)) console.error(`[erreur] ${context}`, error);
    res.destroy();
    return;
  }
  if (error instanceof AppError) {
    for (const [name, value] of Object.entries(error.headers || {})) res.setHeader(name, value);
    return json(res, error.status, { error: { code: error.code, message: error.message } });
  }
  // Journalisation cote serveur uniquement : ni pile, ni message SQL au client.
  console.error(`[erreur] ${context}`, error);
  return json(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' } });
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}
