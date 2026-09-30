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

Les tests utilisent une base SQLite locale temporaire (`file:`) : aucun token Turso n'est necessaire. Ils tournent aussi automatiquement sur GitHub Actions a chaque push et a chaque pull request (`.github/workflows/ci.yml`).

## Deploiement

FestiConnect se deploie gratuitement et sans carte bancaire sur **Render** (plan Free, region Frankfurt), avec la base **Turso** (plan Free). **Zeabur** sert d'alternative grace au `Dockerfile`.

Guide complet pas a pas : **[DEPLOIEMENT.md](DEPLOIEMENT.md)**

Fichiers utiles :

- `render.yaml` : Blueprint Render (build + migrations, health check `/api/health`, variables d'environnement) ;
- `Dockerfile` : image de production pour Zeabur ou tout hebergeur Docker ;
- `npm run start:prod` : applique les migrations (idempotentes) puis demarre le serveur ;
- `npm run db:setup` : migrations puis donnees de demonstration.

Variables d'environnement en production : `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `APP_SECRET` (>= 32 caracteres aleatoires), `NODE_ENV=production`, `TRUST_PROXY=1` (`PORT` est fourni par l'hebergeur). Optionnelle : `PLATFORM_COMMISSION_PERCENT` (commission de la plateforme sur les ventes de billets, 0 a 50, `0` par defaut), deduite du solde retirable des organisateurs.

### Securite en production

- Ne pas lancer `npm run db:seed` en production (refuse par defaut) et changer/supprimer les comptes de demonstration.

Voir [SECURITY.md](SECURITY.md) pour les protections en place et le signalement des failles.

## Comptes de demonstration (developpement uniquement)

- Admin: `admin@festiconnect.ci` / `Admin123!`
- Organisateur: `organisateur@festiconnect.ci` / `Orga123!`
- Client: `client@festiconnect.ci` / `Client123!`

## Fonctionnalités

**Côté public et clients**

- Agenda des événements à venir (recherche, catégorie, ville) ; une fiche passée reste consultable pour ses avis.
- Catégories de billets par événement (Early bird, Standard, VIP…) avec prix et jauge propres, choix sur la fiche ; les événements sans catégorie gardent leur tarif unique.
- Codes promo (pourcentage ou montant fixe) vérifiés et recalculés par le serveur.
- Achat refusé dès que l'événement a commencé ; paiement Wave, Orange Money ou Moov Money (simulé).
- Billet avec **QR code** dans l'espace client, affichage plein écran pour le contrôle.
- « Garder » un événement (cœur) : favoris conservés sur l'appareil hors connexion, synchronisés avec le compte à la connexion.
- Partage (feuille native du téléphone, sinon WhatsApp ou copie du lien) et ajout à l'agenda (`.ics`, rappel la veille).
- Liste d'attente sur un événement ou une catégorie complète, avec alerte quand des places se libèrent.
- Centre de notifications (cloche dans l'en-tête) : validation d'événement, retraits, places libérées, billet annulé, changement d'horaire, rappel la veille.
- Avis (note de 1 à 5 et commentaire) réservés aux détenteurs d'un billet payé, après l'événement.
- Boutique de merch et panier.

**Côté organisateurs**

- Création, modification et duplication d'événements, avec catégories de billets.
- Tableau de bord : courbe des ventes par jour (7, 30 ou 90 jours), remplissage par catégorie, liste d'attente, export CSV des participants.
- Codes promo : création, suivi des utilisations, désactivation.
- Contrôle d'entrée `/controle.html` : lecture du QR code à la caméra (BarcodeDetector, sinon décodeur jsQR embarqué, sinon saisie manuelle), un billet ne passe qu'une fois.
- Annulation d'un billet (places remises en vente, client et liste d'attente prévenus).
- Solde et demandes de retrait Mobile Money (Wave, Orange Money, Moov Money), commission configurable.

**Côté administration**

- Validation des événements, traitement des retraits (envoyé ou refusé avec motif), modération des avis.

## Pages principales

- Portail public: `/`
- Recherche: `/evenements.html`
- Detail evenement: `/evenement.html?id=...`
- Boutique: `/boutique.html`
- Detail produit: `/produit.html?id=...`
- Panier et paiement: `/panier.html`
- Espace client: `/client.html`
- Espace organisateur: `/organisateur.html`
- Contrôle d'entrée (scanner): `/controle.html`
- Notifications: `/notifications.html`
- Administration: `/admin.html`

## Données de démonstration

`npm run db:seed` crée des dates **relatives au jour du seed** : un événement demain (rappel J-1 du client), d'autres dans les semaines suivantes, un en attente de validation et un événement passé (Nuit du Zouglou) pour tester les avis. Il ajoute des catégories (Early bird complet sur Abissa), des codes promo (`BASSAM10`, `MAQUIS2000`, `ZOUGLOU500` expiré), des favoris, une liste d'attente, un historique de ventes sur 28 jours, des retraits, des avis (dont un masqué) et quatre participants fictifs (`@demo.festiconnect.ci`, mots de passe aléatoires, non connectables).

Billets du client de démonstration : `FC-DEMO-MAQUIS` (demain), `FC-DEMO-2026` (Abissa, 2 places), `FC-DEMO-ZOUGLOU` (passé, déjà scanné).
