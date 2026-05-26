# DEBUG REPORT - 2026-05-26

## Symptom

L'utilisateur n'arrivait pas a creer un compte depuis le formulaire d'inscription.

## Root Cause

L'API actuelle cree bien le compte, mais le formulaire pouvait envoyer plusieurs soumissions et afficher ensuite l'erreur du second envoi. Le flux demandait aussi une connexion manuelle apres creation, ce qui rendait le succes peu visible.

## Fix

Le formulaire d'inscription desactive le bouton pendant l'envoi, affiche un message inline stable, connecte automatiquement l'utilisateur apres creation, puis redirige vers l'espace client ou organisateur.

## Evidence

- `npm test` passe.
- Verification Turso: page inscription `200`, creation `201`, login `200`.

## Status

DONE
