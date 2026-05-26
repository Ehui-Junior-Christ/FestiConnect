# DEBUG REPORT - 2026-05-26

## Symptom

`POST /api/auth/register` retournait `500 Internal Server Error` quand un utilisateur essayait de s'inscrire avec un email deja existant.

## Root Cause

La base Turso applique une contrainte unique sur `users.email`. Le backend tentait l'insertion directement et laissait l'erreur SQLite `UNIQUE constraint failed: users.email` remonter au gestionnaire global, qui la transformait en 500.

## Fix

Le endpoint d'inscription verifie maintenant l'existence de l'email avant insertion et renvoie `409 EMAIL_ALREADY_EXISTS` avec un message francais clair.

## Evidence

- Test local: `npm test` passe.
- Verification Turso: premiere inscription `201`, deuxieme inscription avec le meme email `409`.

## Regression Test

`tests/register.test.js` demarre un serveur local sur une base libSQL temporaire, inscrit un utilisateur, puis verifie que le doublon retourne `409 EMAIL_ALREADY_EXISTS`.

## Related

La base Turso distante contient un ancien schema camelCase en plus du schema snake_case. Le backend conserve la compatibilite avec les deux conventions.

## Status

DONE
