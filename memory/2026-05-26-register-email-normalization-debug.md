# DEBUG REPORT - 2026-05-26

## Symptom

`POST /api/auth/register` pouvait encore declencher une erreur libSQL `SERVER_ERROR HTTP 400` sur la ligne de verification email.

## Root Cause

Le endpoint envoyait directement `body.email` a libSQL. Une valeur non normalisee ou invalide pouvait atteindre la requete distante avant validation stricte.

## Fix

L'email est maintenant normalise avec `trim().toLowerCase()` avant toute requete, valide avec un controle minimal, puis compare avec `email = ?`. Le login utilise la meme normalisation. Une contrainte unique Turso reste mappee en `409 EMAIL_ALREADY_EXISTS`.

## Evidence

- `npm test` passe.
- Verification Turso: nouvelle inscription `201`, doublon `409`, email invalide `422`.

## Regression Test

`tests/register.test.js` couvre maintenant un email avec espaces/majuscules, le doublon et l'email invalide.

## Status

DONE
