# FestiConnect

FestiConnect est une plateforme SaaS evenementielle moderne pour le marche ivoirien et africain.
Le projet contient un frontend HTML/CSS/JS responsive et un backend Node.js connecte a Turso/libSQL.

## Installation

```bash
npm install
copy .env.example .env
```

Renseigne ensuite `TURSO_AUTH_TOKEN` dans `.env`.

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

Les tests utilisent une base SQLite locale temporaire (`file:`) : aucun token Turso n'est necessaire. Ils tournent aussi automatiquement sur GitHub Actions a chaque push et a chaque pull request (`.github/workflows/ci.yml`).

## Deploiement

FestiConnect se deploie gratuitement et sans carte bancaire sur **Render** (plan Free, region Frankfurt), avec la base **Turso** (plan Free). **Zeabur** sert d'alternative grace au `Dockerfile`.

👉 Guide complet pas a pas : **[DEPLOIEMENT.md](DEPLOIEMENT.md)**

Fichiers utiles :

- `render.yaml` : Blueprint Render (build + migrations, health check `/api/health`, variables d'environnement) ;
- `Dockerfile` : image de production pour Zeabur ou tout hebergeur Docker ;
- `npm run start:prod` : applique les migrations (idempotentes) puis demarre le serveur ;
- `npm run db:setup` : migrations puis donnees de demonstration.

Variables d'environnement en production : `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `APP_SECRET`, `NODE_ENV=production` (`PORT` est fourni par l'hebergeur).

## Comptes de demonstration

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
