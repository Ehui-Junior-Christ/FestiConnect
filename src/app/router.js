// Table de routes de l'API. Chaque module de fonctionnalite enregistre ses
// routes avec route() ; server.js les parcourt dans l'ordre d'enregistrement.
import { AppError } from '../shared/errors.js';
import * as v from '../shared/validation.js';

export const routes = [];

export function route(method, pattern, handler) {
  routes.push({ method, pattern, handler });
}

export function matchRoute(pattern, pathname) {
  if (typeof pattern === 'string') return pattern === pathname ? [] : null;
  const match = pattern.exec(pathname);
  return match ? match.slice(1) : null;
}

// Un identifiant mal forme equivaut a une ressource introuvable.
export function pathId(value) {
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  return v.isValidId(decoded) ? decoded : null;
}

export function searchParam(url, name, max) {
  const value = (url.searchParams.get(name) || '').trim();
  if (value.length > max) throw new AppError(422, 'VALIDATION_ERROR', `Paramètre ${name} trop long (max ${max}).`);
  return value;
}
