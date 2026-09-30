# FestiConnect

FestiConnect est une plateforme SaaS evenementielle moderne pour le marche ivoirien et africain.
Le projet contient un frontend HTML/CSS/JS responsive et un backend Node.js connecte a Turso/libSQL.

## Installation

```bash
npm install
copy .env.example .env
```

Renseigne ensuite `TURSO_AUTH_TOKEN` et `APP_SECRET` dans `.env`.

Pour developper sans Turso, une base SQLite locale suffit (refusee en production) :

```bash
TURSO_DATABASE_URL=file:./festiconnect-dev.db
```

## Base de donnees

```bash
npm run db:migrate
npm run db:seed
```

## Lancement

```bash
npm run dev
```

Ouvre `http://localhost:3000`.

## Tests

```bash
npm test
```

Les tests demarrent le serveur reel sur une base SQLite temporaire (aucun acces a Turso).

## Production

- `NODE_ENV=production`, `APP_SECRET` (>= 32 caracteres aleatoires), `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
- Derriere Render/Koyeb : `TRUST_PROXY=1`.
- Ne pas lancer `npm run db:seed` en production (refuse par defaut) et changer/supprimer les comptes de demonstration.

Voir [SECURITY.md](SECURITY.md) pour les protections en place et le signalement des failles.

## Comptes de demonstration (developpement uniquement)

- Admin: `admin@festiconnect.ci` / `Admin123!`
- Organisateur: `organisateur@festiconnect.ci` / `Orga123!`
- Client: `client@festiconnect.ci` / `Client123!`

## Pages principales

- Portail public: `/`
- Recherche: `/evenements.html`
- Detail evenement: `/evenement.html?id=...`
- Boutique: `/boutique.html`
- Detail produit: `/produit.html?id=...`
- Panier et paiement: `/panier.html`
- Espace client: `/client.html`
- Espace organisateur: `/organisateur.html`
- Administration: `/admin.html`
