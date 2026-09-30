# Déployer FestiConnect gratuitement

Ce guide explique, pas à pas, comment mettre FestiConnect en ligne **sans payer** et, pour la solution principale, **sans carte bancaire**.

- **Hébergement principal : [Render](https://render.com)**, plan *Free*, région **Frankfurt**.
- **Alternative : [Zeabur](https://zeabur.com)**, plan *Free*, région **Frankfurt**, avec le `Dockerfile` du projet.
- **Base de données : [Turso](https://turso.tech)**, plan *Free* (déjà utilisé par le projet).

> Offres vérifiées le **30 septembre 2026**. Les offres gratuites changent souvent : si un écran ne correspond plus au guide, regarde la page de tarifs de l'hébergeur.

---

## Sommaire

1. [Pourquoi Render (et Zeabur en secours) ?](#1-pourquoi-render-et-zeabur-en-secours-)
2. [Ce qu'il te faut](#2-ce-quil-te-faut)
3. [Préparer la base Turso](#3-préparer-la-base-turso)
4. [Déployer sur Render (méthode Blueprint)](#4-déployer-sur-render-méthode-blueprint)
5. [Remplir la base (données de démonstration)](#5-remplir-la-base-données-de-démonstration)
6. [Vérifier que tout marche](#6-vérifier-que-tout-marche)
7. [Mises à jour automatiques à chaque push](#7-mises-à-jour-automatiques-à-chaque-push)
8. [Mise en veille : la limiter (optionnel)](#8-mise-en-veille--la-limiter-optionnel)
9. [Nom de domaine personnalisé (optionnel)](#9-nom-de-domaine-personnalisé-optionnel)
10. [Limites du plan gratuit](#10-limites-du-plan-gratuit)
11. [Alternative : Zeabur (Docker)](#11-alternative--zeabur-docker)
12. [Dépannage](#12-dépannage)
13. [Pour les curieux : ce qui a été préparé dans le code](#13-pour-les-curieux--ce-qui-a-été-préparé-dans-le-code)

---

## 1. Pourquoi Render (et Zeabur en secours) ?

FestiConnect est un **serveur HTTP Node.js qui tourne en continu** (`server.js`). Il faut donc un hébergeur qui fait tourner un vrai processus Node, et pas seulement des « fonctions » à courte durée de vie.

| Hébergeur | Gratuit aujourd'hui ? | Carte bancaire | Mise en veille | Europe | Verdict |
|---|---|---|---|---|---|
| **Render** (Free web service) | Oui : 750 h/mois par espace de travail, 512 Mo RAM | **Non** | Après 15 min sans visite, réveil en ~1 min | Frankfurt | ✅ **Choix principal** |
| **Zeabur** (Free) | Oui, avec mise en veille | **Non** | Oui (réveil en quelques secondes) | Frankfurt (AWS) | ✅ **Alternative** |
| Northflank (Sandbox) | Oui : 2 services toujours actifs | Demandée à l'inscription (anti-abus) | Non | Oui | Possible si tu as une carte |
| Koyeb | Une instance gratuite reste possible | **Oui** (pré-autorisation de 29 $), plan Hobby sans carte supprimé en février 2026 | Après 1 h | Frankfurt | ❌ carte obligatoire |
| Fly.io | Non : essai de 2 h de VM ou 7 jours | **Oui** | — | Oui | ❌ plus d'offre gratuite |
| Railway | Essai de 5 $ pendant 30 jours, puis 1 $/mois de crédit | Non pour l'essai | — | Oui | ❌ pas viable dans la durée |
| Vercel / Netlify | Oui, mais en *serverless* | Non | — | Oui | ❌ il faudrait réécrire le serveur en fonctions |
| Glitch | Hébergement fermé le 8 juillet 2025 | — | — | — | ❌ n'existe plus |

**Pourquoi Render ?** C'est gratuit sans carte, l'app se déploie depuis GitHub, le HTTPS et une adresse `*.onrender.com` sont fournis, et le projet contient un fichier `render.yaml` qui fait presque toute la configuration à ta place. Frankfurt est la seule région européenne de Render, donc la plus proche d'Abidjan.

**Pourquoi Zeabur en secours ?** C'est aussi gratuit sans carte, il y a une région à Frankfurt, et Zeabur utilise directement le `Dockerfile` du projet.

---

## 2. Ce qu'il te faut

- Un compte **GitHub** avec le dépôt `Ehui-Junior-Christ/FestiConnect` (branche `main`).
- Un compte **Turso** (gratuit) : <https://app.turso.tech>.
- Un compte **Render** (gratuit) : <https://dashboard.render.com/register>. Choisis **« Sign up with GitHub »** pour ne pas avoir à relier GitHub plus tard.
- Sur ton PC : Node.js 20 ou plus récent (22 conseillé) et le projet cloné, avec `npm install` déjà lancé. Ça sert uniquement à l'étape 5 (données de démonstration).

---

## 3. Préparer la base Turso

Il te faut deux valeurs : **l'URL de la base** (`libsql://…`) et **un jeton d'accès** (token).

### ⚠️ Conseil important : mets la base en Europe

Dans `.env.example`, la base actuelle est à **Tokyo** (`aws-ap-northeast-1`). Or le serveur Render sera à **Frankfurt**. Chaque requête SQL ferait alors l'aller-retour Europe ↔ Japon (environ 250 ms à chaque fois), et une page qui lance plusieurs requêtes deviendrait lente.

👉 Crée plutôt une nouvelle base en **AWS EU West (Irlande), `aws-eu-west-1`**, à environ 25 ms de Frankfurt. Comme la base actuelle ne contient que des données de démonstration, il suffit de relancer les migrations (automatiques) et le seed (étape 5).

### Option A : avec le site Turso (le plus simple, marche sous Windows)

1. Va sur <https://app.turso.tech> et connecte-toi avec GitHub.
2. **Create Database** : nom `festiconnect`, région **AWS EU West (Ireland)**. Si Turso te demande d'abord de créer un *group*, choisis cette même région pour le group.
3. Ouvre la base et copie l'**URL** (elle commence par `libsql://`).
4. Clique sur **Create Token** (ou **Generate Token**). Choisis **aucune expiration** et un accès **lecture + écriture** (*full access*), puis copie le jeton. Il ne sera affiché **qu'une seule fois**.

### Option B : avec la CLI `turso` (Linux, macOS, ou Windows avec WSL)

```bash
# Installation
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login

# Création de la base en Irlande
turso db create festiconnect --location aws-eu-west-1

# URL (libsql://...)
turso db show festiconnect --url

# Jeton d'accès (sans expiration par défaut)
turso db tokens create festiconnect
```

> Si la CLI refuse `--location aws-eu-west-1`, tape `turso db locations` pour voir les régions proposées, ou crée la base avec l'option A.

🔒 **Ne commite jamais le token.** Le fichier `.env` est déjà ignoré par Git (`.gitignore`), et sur Render le token se saisit uniquement dans le tableau de bord.

---

## 4. Déployer sur Render (méthode Blueprint)

Le fichier [`render.yaml`](render.yaml) décrit tout le service :

- plan gratuit, région Frankfurt ;
- build : `npm ci && npm run db:migrate` ;
- démarrage : `npm start` ;
- vérification de santé (health check) sur `/api/health` ;
- `NODE_ENV=production` et Node 22 ;
- `APP_SECRET` **générée automatiquement** par Render.

Étapes :

1. Dans Render, clique sur **New +** puis **Blueprint**.
2. Connecte GitHub si ce n'est pas déjà fait, puis choisis le dépôt **`Ehui-Junior-Christ/FestiConnect`**, branche **`main`**.
3. Render lit `render.yaml` et affiche le service `festiconnect`. Il te demande deux valeurs :
   - `TURSO_DATABASE_URL` : colle l'URL `libsql://…` de l'étape 3 ;
   - `TURSO_AUTH_TOKEN` : colle le jeton de l'étape 3.
4. Clique sur **Apply** (ou **Deploy Blueprint**).
5. Suis les logs. Tu dois voir successivement :
   - `Migrations appliquees.` : la base est prête (les migrations tournent pendant le build) ;
   - `FestiConnect lance sur http://localhost:10000` : le serveur a démarré. Ne t'inquiète pas du « localhost » : c'est normal, Render redirige le trafic vers ce port.
6. Ton site est disponible à l'adresse affichée en haut, du type `https://festiconnect.onrender.com` (Render ajoute un suffixe si le nom est déjà pris). Le **HTTPS est automatique**.

### Si le Blueprint n'est pas accepté : méthode manuelle (mêmes réglages)

**New +** → **Web Service** → choisis le dépôt, puis :

| Champ | Valeur |
|---|---|
| Name | `festiconnect` |
| Region | **Frankfurt (EU Central)** |
| Branch | `main` |
| Runtime / Language | Node |
| Build Command | `npm ci && npm run db:migrate` |
| Start Command | `npm start` |
| Instance Type | **Free** |
| Health Check Path (Advanced) | `/api/health` |
| Auto-Deploy | On Commit |

Ensuite, dans **Environment**, ajoute ces variables :

| Clé | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `APP_SECRET` | clique sur **Generate** ou colle une longue chaîne aléatoire (voir ci-dessous) |
| `TURSO_DATABASE_URL` | `libsql://…` |
| `TURSO_AUTH_TOKEN` | ton jeton |

Pour générer une clé aléatoire sur ton PC :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> Ne définis **pas** `PORT` : Render le fournit tout seul (10000), et le serveur lit `process.env.PORT`.

---

## 5. Remplir la base (données de démonstration)

Les **tables** sont créées automatiquement à chaque déploiement (`npm run db:migrate`, qu'on peut relancer sans risque). En revanche, les **données de démonstration** (événements, produits, comptes de test) sont à ajouter **une seule fois, depuis ton PC**, car le plan gratuit de Render n'a pas de console (*shell*).

1. Dans le dossier du projet sur ton PC, ouvre le fichier `.env` et mets **les mêmes valeurs que sur Render** :

   ```env
   TURSO_DATABASE_URL=libsql://festiconnect-xxxx.aws-eu-west-1.turso.io
   TURSO_AUTH_TOKEN=ton-jeton
   APP_SECRET=nimporte-quoi-de-long-en-local
   ```

2. Lance :

   ```bash
   npm run db:setup    # = npm run db:migrate puis npm run db:seed
   ```

   Tu dois voir `Migrations appliquees.` puis `Donnees de demonstration inserees.`

> 🔐 **Sécurité :** le seed crée des comptes aux mots de passe **publics** (ils sont écrits dans le README). Par exemple `admin@festiconnect.ci` / `Admin123!`. C'est très bien pour une démo, mais si le site est ouvert à de vrais utilisateurs : ne lance pas le seed, ou change tout de suite le mot de passe du compte admin.

---

## 6. Vérifier que tout marche

1. Ouvre `https://<ton-service>.onrender.com/api/health`. Tu dois lire :

   ```json
   {"status":"ok","service":"FestiConnect"}
   ```

2. Ouvre la page d'accueil `https://<ton-service>.onrender.com/` et la page `/evenements.html`.
3. Crée un compte sur `/inscription.html` puis connecte-toi.
4. Dans Render, l'onglet **Events** doit afficher **Deploy live**, et l'onglet **Logs** ne doit pas contenir d'erreur.

> La première visite après une période d'inactivité peut prendre **environ 1 minute** (voir la section 8).

---

## 7. Mises à jour automatiques à chaque push

Il n'y a rien à faire de plus. Chaque `git push` sur `main` déclenche automatiquement :

1. **GitHub Actions** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)), qui lance `npm ci` puis `npm test` avec Node 22 (onglet **Actions** du dépôt). Aucun secret n'est nécessaire : les tests utilisent une base SQLite locale temporaire.
2. **Render**, qui reconstruit, applique les migrations et redéploie. Si le build échoue (erreur de code, base injoignable…), **l'ancienne version reste en ligne**.

💡 Pour que Render ne déploie que si les tests passent : dans le service Render, **Settings → Build & Deploy → Auto-Deploy**, choisis **« After CI Checks Pass »** (si l'option est proposée). Dans `render.yaml`, cela correspond à `autoDeployTrigger: checksPass`.

---

## 8. Mise en veille : la limiter (optionnel)

Sur le plan gratuit, Render **endort le service après 15 minutes sans visite**. La visite suivante le réveille, mais elle attend **environ 1 minute**. Pendant ce temps, le navigateur affiche une page de chargement Render.

### Solution : un « ping » gratuit toutes les 10 à 14 minutes

Avec **[cron-job.org](https://cron-job.org)** (gratuit, permet de choisir des horaires) ou **[UptimeRobot](https://uptimerobot.com)** (gratuit, contrôle toutes les 5 minutes) :

1. Crée un compte gratuit.
2. Ajoute une tâche ou un moniteur **HTTP GET** vers `https://<ton-service>.onrender.com/api/health`.
3. Choisis la fréquence :
   - **toutes les 14 minutes, de 7 h à 23 h (heure d'Abidjan, GMT)** avec cron-job.org. C'est le réglage recommandé : environ 500 h par mois, donc une bonne marge ;
   - ou toutes les 5 à 10 minutes, 24 h/24.

### À savoir avant de le faire

- **Le quota d'heures.** Le quota gratuit est de **750 heures par mois pour tout l'espace de travail Render**, et un mois compte au plus 744 heures. Un service réveillé en permanence consomme donc **presque tout le quota**. Ça passe **uniquement si FestiConnect est ton seul service gratuit** sur ce compte. Si le quota est épuisé, Render **suspend tes services gratuits jusqu'au mois suivant**. D'où le conseil de pinguer seulement la journée.
- **Les conditions d'utilisation.** À notre connaissance (septembre 2026), Render n'interdit pas explicitement les pings de maintien, et la pratique est très répandue. Mais ce n'est pas l'usage prévu du plan gratuit, et Render peut changer ses règles ou suspendre un service jugé abusif. Relis la *Acceptable Use Policy* et la page *Free* de Render avant d'activer un ping. Si tu veux un site toujours réveillé de façon « officielle », il faut passer à une offre payante.
- Le ping sur `/api/health` est très léger (moins d'1 Mo par mois) : il ne consomme pas ta bande passante.

---

## 9. Nom de domaine personnalisé (optionnel)

- **Gratuit et immédiat :** l'adresse `https://festiconnect.onrender.com` (ou proche), avec HTTPS inclus.
- **Ton propre domaine :** Render accepte les domaines personnalisés **même en gratuit** et fournit le certificat HTTPS automatiquement. Voici comment faire :
  1. Dans le service Render, va dans **Settings → Custom Domains → Add Custom Domain** et saisis par exemple `www.mondomaine.com`.
  2. Chez ton registrar (là où tu as acheté le domaine), crée l'enregistrement DNS que Render t'indique. En général, c'est un **CNAME** `www` qui pointe vers `festiconnect.onrender.com`.
  3. Attends la validation, qui prend de quelques minutes à quelques heures. Render active alors le HTTPS.
- **Obtenir un domaine sans payer :** un vrai domaine (`.com`, `.ci`…) est en général payant. Il existe quelques pistes étudiantes, à vérifier au moment où tu les demandes :
  - le **[GitHub Student Developer Pack](https://education.github.com/pack)** inclut souvent un domaine offert pendant 1 an (par exemple un `.me` ou un `.tech` chez un partenaire). Attention, il devient payant au renouvellement ;
  - **[eu.org](https://nic.eu.org)** propose des sous-domaines gratuits, mais la validation est manuelle et peut prendre plusieurs semaines.

---

## 10. Limites du plan gratuit

| | Render Free (sept. 2026) |
|---|---|
| Prix | 0 €, sans carte bancaire |
| Machine | 512 Mo de RAM, 0,1 CPU partagé |
| Heures | 750 h/mois pour tout l'espace de travail |
| Mise en veille | après 15 min sans trafic, réveil en ~1 min |
| Bande passante | **5 Go/mois** pour les espaces créés depuis le 23 avril 2026 (avant : 100 Go) |
| Pre-deploy / Shell | ❌ non disponibles : c'est pour ça que les migrations tournent pendant le build |
| Disque | éphémère : tout fichier écrit sur le serveur est perdu au redémarrage. Ce n'est pas un problème ici, car toutes les données sont dans Turso |
| HTTPS / domaine perso | ✅ inclus |

**Turso Free** (sept. 2026) : 5 Go de stockage, 100 bases, 500 millions de lignes lues et 10 millions de lignes écrites par mois. C'est largement suffisant pour un projet étudiant.

> Le site est servi par le même serveur Node, y compris les pages HTML, le CSS et les images de `public/`. Il pèse environ 200 Ko, donc 5 Go correspondent à des dizaines de milliers de visites. N'ajoute pas de grosses images ou vidéos dans `public/` : héberge-les ailleurs, par exemple sur un CDN d'images gratuit.

---

## 11. Alternative : Zeabur (Docker)

Si Render ne convient pas (quota épuisé, compte suspendu, conditions modifiées…), utilise Zeabur, qui se sert du `Dockerfile` du projet.

1. Crée un compte sur <https://zeabur.com> avec GitHub (plan **Free**, sans carte).
2. **Create Project** et choisis une région gratuite **Frankfurt**.
3. **Add Service → Git** puis choisis le dépôt `Ehui-Junior-Christ/FestiConnect`. Zeabur détecte le `Dockerfile` et l'utilise.
4. Dans l'onglet **Variables** du service, ajoute :

   | Clé | Valeur |
   |---|---|
   | `TURSO_DATABASE_URL` | `libsql://…` |
   | `TURSO_AUTH_TOKEN` | ton jeton |
   | `APP_SECRET` | une longue chaîne aléatoire (voir la section 4) |
   | `PORT` | `3000` |

   `NODE_ENV=production` est déjà défini dans l'image.
5. Dans **Networking**, génère un domaine gratuit `*.zeabur.app` (HTTPS inclus). Le port à exposer est **3000**.
6. Au démarrage, le conteneur lance `scripts/start-prod.js`, qui applique les migrations puis démarre le serveur. Pour sauter les migrations, ajoute `RUN_MIGRATIONS=false`.
7. Le seed se fait comme à l'étape 5, depuis ton PC.

Le même `Dockerfile` fonctionne aussi sur Northflank, Koyeb, Fly.io, ou sur n'importe quel VPS :

```bash
docker build -t festiconnect .
docker run --rm -p 3000:3000 --env-file .env festiconnect
```

---

## 12. Dépannage

| Symptôme (logs Render) | Cause probable | Solution |
|---|---|---|
| `Variable d'environnement manquante: TURSO_DATABASE_URL` (ou `TURSO_AUTH_TOKEN`) | Variable absente | Ajoute-la dans **Environment**, puis **Manual Deploy → Deploy latest commit** |
| `Variable d'environnement non configuree: …` | La valeur d'exemple (`colle-ton-token…`, `remplace-moi…`) a été collée telle quelle | Remplace-la par la vraie valeur |
| `SERVER_ERROR: … 401` / `Unauthorized` / `invalid token` pendant `db:migrate` | Jeton Turso faux, expiré, ou créé pour une autre base | Recrée un jeton pour **cette** base (étape 3) et remplace `TURSO_AUTH_TOKEN` |
| `ENOTFOUND` / `fetch failed` vers `turso.io` | URL mal copiée, ou base supprimée | Vérifie l'URL avec `turso db show festiconnect --url` ou dans le dashboard |
| `pre-deploy command is not supported for free tier` | Un `preDeployCommand` a été ajouté à `render.yaml` | Retire-le : les migrations tournent déjà dans `buildCommand` |
| Le déploiement reste sur « In progress » puis `Timed out` / health check en échec | Le serveur n'a pas démarré ou `/api/health` ne répond pas | Lis les logs *runtime*. Vérifie que `PORT` n'est **pas** forcé à une autre valeur |
| `npm ci` échoue : `package-lock.json` désynchronisé | `package.json` a été modifié sans mettre à jour le lock | Sur ton PC : `npm install`, puis commite `package-lock.json` et pousse |
| Site très lent à chaque clic | Base Turso loin du serveur (Tokyo ↔ Frankfurt) | Crée la base en `aws-eu-west-1` (section 3) |
| Première page très lente (~1 min), puis normale | Réveil après la mise en veille | Normal en gratuit. Voir la section 8 |
| `Service suspended` / plus d'heures gratuites | Quota de 750 h épuisé | Attends le mois suivant, réduis le ping (section 8), ou utilise Zeabur |
| Les utilisateurs sont déconnectés ou les comptes ont disparu après un redéploiement | `TURSO_DATABASE_URL` pointe vers une autre base, ou `APP_SECRET` a été régénérée (si elle sert à signer les sessions) | Garde la même base, et ne régénère pas `APP_SECRET` sans raison |
| Échec dans l'onglet **Actions** de GitHub | Un test ne passe plus | Lance `npm test` sur ton PC pour voir l'erreur exacte |

Pour relancer un déploiement à la main, va dans **Manual Deploy → Deploy latest commit**. En cas de doute après un changement de cache, utilise **Clear build cache & deploy**.

---

## 13. Pour les curieux : ce qui a été préparé dans le code

| Fichier | Rôle |
|---|---|
| `render.yaml` | Blueprint Render (plan gratuit, Frankfurt, build + migrations, health check, variables) |
| `Dockerfile`, `.dockerignore` | Image Docker minimale : `node:22-alpine`, utilisateur non-root, `npm ci --omit=dev`, healthcheck |
| `scripts/start-prod.js` (`npm run start:prod`) | Applique les migrations puis lance le serveur **dans un seul processus**, pour que l'arrêt propre fonctionne. `RUN_MIGRATIONS=false` pour sauter les migrations |
| `.node-version` | Fixe Node 22 pour les hébergeurs qui le lisent |
| `.github/workflows/ci.yml` | Tests automatiques à chaque push et à chaque pull request |
| `server.js` (fin du fichier) | **Arrêt gracieux** sur `SIGTERM`/`SIGINT` : le serveur termine les requêtes en cours avant de s'arrêter (10 s maximum) |

Le serveur écoute sur `process.env.PORT` et sur **toutes les interfaces réseau** (`0.0.0.0`, et `::` quand l'IPv6 est disponible), ce que demandent Render, Zeabur et Docker.

Les migrations (`src/db/migrate.js`) sont **idempotentes** : `create table if not exists`, ajout d'une colonne seulement si elle manque, `create index if not exists`. On peut donc les relancer à chaque déploiement sans risque.

### Sources (consultées le 30 septembre 2026)

- Render, plan gratuit (750 h, veille à 15 min, sans carte) : <https://render.com/docs/free>, <https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026>
- Render, bande passante réduite à 5 Go en avril 2026 : <https://bex.co/blog/2026/07/09/render-april-2026-egress-repricing-hobby>, <https://snapdeploy.dev/state-of-free-hosting>
- Render, pas de pre-deploy sur le plan gratuit : <https://github.com/MagdiHajjaj/gymlens/pull/47>
- Render, spécification Blueprint : <https://render.com/docs/blueprint-spec>
- Koyeb, carte obligatoire depuis février 2026 : <https://www.koyeb.com/docs/faqs/pricing>, <https://snapdeploy.dev/state-of-free-hosting>
- Fly.io, fin de l'offre gratuite : <https://www.saaspricepulse.com/blog/flyio-free-tier-2026>
- Railway, essai de 5 $ : <https://dev.to/nayankyada/railway-pricing-2026-free-tier-limits-usage-costs-when-to-upgrade-1acm>
- Northflank Sandbox : <https://freetier.co/directory/products/northflank>
- Zeabur, plan gratuit : <https://zeabur.com/docs/en-US/pricing/free-plan>
- Fermeture de Glitch : <https://news.ycombinator.com/item?id=44064230>
- Vercel et les serveurs longs : <https://northflank.com/blog/vercel-backend-limitations>
- Turso, plan gratuit et régions : <https://costbench.com/software/database-as-service/turso/free-plan/>, <https://docs.turso.tech/api-reference/locations/list>
