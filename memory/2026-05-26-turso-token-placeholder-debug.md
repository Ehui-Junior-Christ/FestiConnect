# DEBUG REPORT - 2026-05-26

## Symptom

La creation de compte retournait `Erreur interne du serveur` sur `localhost:3000`.

## Root Cause

Le fichier local `.env` contenait encore `TURSO_AUTH_TOKEN=colle-ton-token-turso-ici`. Le serveur demarrait, mais Turso rejetait les requetes SQL avec HTTP 400.

## Fix

Le `.env` local a ete corrige avec le token Turso fourni. Le chargeur d'environnement refuse maintenant les placeholders (`colle-ton-token`, `remplace-moi`) afin de bloquer ce probleme au demarrage au lieu de produire un 500 plus tard.

## Evidence

- `POST /api/auth/register` sur `localhost:3000` retourne `201`.
- `POST /api/auth/login` sur le compte cree retourne `200`.
- `npm test` passe.

## Status

DONE
