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
