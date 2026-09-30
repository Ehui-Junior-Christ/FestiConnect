# Politique de sécurité — FestiConnect

## Signaler une faille

Merci de **ne pas ouvrir d'issue publique** pour une vulnérabilité.

- Écris à l'équipe FestiConnect (adresse de contact sécurité à définir par le propriétaire, par exemple `securite@festiconnect.ci`) ou utilise la fonction *Private vulnerability reporting* de GitHub (onglet **Security** du dépôt).
- Décris la faille, l'impact, les étapes de reproduction (requêtes HTTP, captures) et la version / le commit concerné.
- N'accède pas aux données d'autres utilisateurs au-delà du strict nécessaire pour démontrer le problème, n'effectue pas de test de déni de service, et ne teste pas l'ingénierie sociale.
- Nous accusons réception sous 72 h et visons un correctif sous 30 jours pour les failles graves. Les découvreurs qui le souhaitent sont crédités.

## Protections en place (côté serveur)

### Authentification et sessions
- Mots de passe hachés avec **scrypt** (module natif `node:crypto`), paramètres OWASP `N=2^15, r=8, p=3`, sel aléatoire de 16 octets, format auto-descriptif `scrypt$N$r$p$hash`. Le calcul est **asynchrone** (threadpool libuv) pour ne pas bloquer le serveur.
- Comparaison en **temps constant** (`crypto.timingSafeEqual`). Pour un email inconnu, une vérification factice est exécutée afin que le temps de réponse ne révèle pas l'existence du compte.
- Les anciens hachages (scrypt `N=2^14`) restent valides et sont **re-hachés automatiquement** au prochain login réussi.
- Politique de mot de passe : 8 à 128 caractères, au moins une lettre et un chiffre, refus des mots de passe courants et de ceux contenant l'email.
- Jetons de session : 256 bits aléatoires ; seul un **HMAC-SHA256 (clé `APP_SECRET`)** du jeton est stocké en base. Expiration 14 jours, 10 sessions actives max par utilisateur, purge horaire des sessions expirées.
- **Rotation** : un login révoque la session présentée avec la requête. **Logout** supprime la session côté serveur (Bearer et cookie) ; `POST /api/auth/logout-all` révoque toutes les sessions de l'utilisateur.
- Cookie `fc_session` : `HttpOnly; SameSite=Strict; Path=/`, plus `Secure` en production ou derrière un proxy HTTPS de confiance.
- Login : message d'erreur identique pour « email inconnu » et « mauvais mot de passe ». L'inscription renvoie toujours `409 EMAIL_ALREADY_EXISTS` (choix UX assumé), compensé par la limitation de débit.

### Limitation de débit (en mémoire, par processus)
| Cible | Limite |
| --- | --- |
| Toute l'API, par IP | 300 requêtes / minute |
| Login, par IP | 30 tentatives / 15 min |
| Login, échecs par compte + IP | 5 / 15 min |
| Login, échecs par compte (toutes IP) | 20 / 15 min |
| Inscription, par IP | 10 / heure |
| Achats (billets + commandes), par utilisateur | 30 / 10 min |
| Vérification de code promo, par utilisateur / par IP | 20 / 10 min, 40 / 10 min |
| Création de codes promo, par utilisateur | 60 / heure |
| Contrôle d'entrée (check-in), par utilisateur | 120 / minute |
| Demandes de retrait, par organisateur | 10 / heure |
| Avis, par utilisateur | 10 / heure |
| Inscriptions en liste d'attente, par utilisateur | 30 / 10 min |
| Création d'événements, par utilisateur | 20 / heure |
| `logout-all`, par utilisateur | 10 / 15 min |

Réponse `429 RATE_LIMITED` avec `Retry-After`. L'IP cliente n'est lue dans `X-Forwarded-For` que si `TRUST_PROXY` ≥ 1, en partant de la **droite** (entrée ajoutée par le proxy de confiance) : les valeurs injectées par le client sont ignorées.

### CSRF
Pour toute requête `POST/PUT/PATCH/DELETE` sur l'API :
- si `Origin` est présent, il doit correspondre à `APP_ORIGIN` (ou à défaut à l'en-tête `Host`) ; `Origin: null` est refusé ;
- sinon `Referer` est vérifié de la même manière ; `Sec-Fetch-Site: cross-site/same-site` est refusé ;
- une requête authentifiée **uniquement par cookie** sans `Origin` ni `Referer` est refusée ;
- les corps non vides doivent être en `application/json` (un formulaire HTML cross-site ne peut pas en envoyer sans pré-vol CORS, et aucun CORS n'est accordé).

### Autorisation
- Chaque route vérifie le rôle **et** la propriété : un client ne voit que ses billets/commandes, un organisateur que ses événements et ses ventes (`organizer_id` n'est accepté que pour un admin), l'administration est réservée au rôle `admin`.
- Le rôle `admin` ne peut pas être choisi à l'inscription (seuls `client` et `organisateur`).
- Les événements non validés (`pending`, `rejected`) ne sont visibles que par leur organisateur et les admins (liste publique limitée aux événements `approved`).
- Le statut et l'organisateur d'un événement créé sont fixés par le serveur.

### Validation des entrées et intégrité métier
- Types, longueurs maximales, formats (email, téléphone, dates `AAAA-MM-JJTHH:MM`, URL d'image locale ou `https`), entiers bornés, whitelists (rôles, statuts, moyens de paiement).
- Les caractères `<` et `>` et les caractères de contrôle sont refusés dans les champs texte (défense en profondeur contre le XSS stocké).
- **Prix toujours calculés côté serveur** depuis la base ; prix/total envoyés par le client ignorés.
- **Pas de survente** : réservation de places et de stock par `UPDATE ... WHERE tickets_sold + ? <= capacity` / `stock >= ?` (atomique), avec compensation si l'écriture suivante échoue. Quantités bornées (10 billets par achat, 50 unités et 50 lignes par commande).

### Injection SQL
- Toutes les valeurs passent par des requêtes paramétrées.
- Les noms de tables interpolés (`pragma table_info`, insertions dynamiques pour l'ancien schéma camelCase) passent par une **whitelist** ; les noms de colonnes sont validés par une expression stricte (`src/db/schema.js`).

### Fichiers statiques
- Résolution confinée à `public/` (protection contre `..`, encodages `%2e%2e`, `%2f`, `\`, octets nuls, préfixes de dossiers voisins).
- Fichiers et dossiers cachés (`.env`, `.git`, ...) refusés ; les dossiers ne sont jamais lus (l'ancien plantage `EISDIR` du processus est corrigé).
- `Content-Type` explicite par extension, `X-Content-Type-Options: nosniff`, seules les méthodes `GET`/`HEAD` sont acceptées.

### En-têtes HTTP (toutes les réponses)
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
  (mode observation possible via `CSP_REPORT_ONLY=true`, uniquement pour une transition).
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (production).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictive (seule la caméra est autorisée, `camera=(self)`, pour le scanner de billets ; micro, géolocalisation, paiement... restent bloqués), `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Cache-Control: no-store` sur l'API. Aucun `X-Powered-By`.

### Robustesse
- Corps JSON limité à **100 Ko** (`413`), JSON invalide → `400`, mauvais `Content-Type` → `415`, méthode non supportée → `405` avec `Allow`.
- Délais serveur : `headersTimeout` 15 s, `requestTimeout` 30 s, `keepAliveTimeout` 5 s.
- Les erreurs `500` renvoient un message générique ; le détail (pile, SQL) n'est journalisé que côté serveur.
- `unhandledRejection` journalisé ; `uncaughtException` journalisé puis arrêt propre (redémarrage par la plateforme) ; arrêt gracieux sur `SIGTERM`.

### Secrets et configuration
- `APP_SECRET` (≥ 32 caractères) et `TURSO_AUTH_TOKEN` ne sont jamais journalisés ni renvoyés ; les messages d'erreur ne citent que le **nom** de la variable.
- En production (`NODE_ENV=production`) le serveur **refuse de démarrer** si `APP_SECRET` manque, est trop court ou est une valeur d'exemple, si `TURSO_AUTH_TOKEN` est une valeur d'exemple, ou si la base est locale (`file:`) ou non chiffrée.
- Le seed de démonstration est refusé en production (sauf `SEED_ALLOW_PRODUCTION=true` avec des mots de passe fournis via `SEED_*_PASSWORD`). Au démarrage en production, une alerte est journalisée si un compte de démonstration utilise encore son mot de passe public.
- `.env` et variantes, bases locales, clés privées sont ignorés par git.

## Variables d'environnement liées à la sécurité

| Variable | Rôle |
| --- | --- |
| `NODE_ENV` | `production` active Secure/HSTS et les contrôles stricts de configuration. |
| `APP_SECRET` | Clé HMAC des sessions (obligatoire en production, ≥ 32 caractères). La changer déconnecte tout le monde. |
| `TRUST_PROXY` | Nombre de proxys de confiance (Render/Koyeb : `1`). `0` = en-têtes `X-Forwarded-*` ignorés. |
| `APP_ORIGIN` | Origine(s) autorisée(s) pour les requêtes mutantes, séparées par des virgules. |
| `CSP_REPORT_ONLY` | `true` = CSP en mode observation (transition). |
| `SEED_ALLOW_PRODUCTION`, `SEED_ADMIN_PASSWORD`, `SEED_ORGANIZER_PASSWORD`, `SEED_CLIENT_PASSWORD` | Contrôle du seed de démonstration. |
| `PLATFORM_COMMISSION_PERCENT` | Commission de la plateforme (0 à 50 %, deux décimales, `0` par défaut) déduite du solde retirable. Valeur invalide = refus de démarrer. |

## Tests

`npm test` exécute les tests unitaires et d'intégration (`tests/*.test.js`) : le serveur réel est démarré sur une base SQLite locale temporaire (`file:`), migrée et seedée, puis attaqué avec `fetch` (en-têtes, traversal, taille des corps, CSRF, brute force, IDOR, validation, survente concurrente, configuration de production).

### Fonctionnalités V1 : garde-fous
- **Montants** : prix des catégories, remises des codes promo, commission et solde retirable sont toujours calculés côté serveur ; les montants envoyés par le client sont ignorés.
- **Atomicité** : places par catégorie puis par événement, utilisations de code promo, check-in, annulation de billet, alerte de liste d'attente, traitement d'un retrait et demande de retrait (`INSERT ... SELECT` conditionnel sur le solde) reposent sur des écritures conditionnelles uniques en base ; une étape refusée restitue les précédentes. Contraintes `CHECK` en base (quota de code promo, note 1 à 5, ventes positives).
- **Propriété** : codes promo, statistiques, export CSV, duplication, édition, annulation de billet et check-in ne concernent que les événements de l'organisateur connecté (réponse « introuvable » sinon, identique à un identifiant inexistant) ; favoris, notifications, listes d'attente et avis ne concernent que leur auteur.
- **Check-in** : un billet ne passe qu'une fois ; un code d'un autre organisateur reçoit la même réponse qu'un code inconnu.
- **Export CSV** : cellules commençant par `=`, `+`, `-`, `@`, tabulation ou retour chariot préfixées d'une apostrophe (injection de formules), guillemets échappés.
- **Export `.ics`** : textes échappés selon la RFC 5545 (aucune injection de composant), lignes pliées à 75 octets.
- **Avis** : réservés aux détenteurs d'un billet payé après l'événement ; nom affiché abrégé (« Prénom I. »), jamais l'email ; modération par l'administration.
- **Numéros Mobile Money** : format ivoirien validé et normalisé (`+225` puis 10 chiffres en 01, 05 ou 07).
- **Bibliothèques tierces** : servies localement (`public/assets/js/vendor/`, licences jointes) : qrcode-generator (MIT) et jsQR (Apache-2.0, chargé uniquement sur le scanner). Aucun CDN, CSP inchangée.

## Limites connues

- La limitation de débit est **en mémoire** : elle est propre à chaque instance et remise à zéro au redémarrage.
- Aucun paiement réel n'est vérifié : les billets et commandes sont marqués `paid` immédiatement. Une intégration de paiement (Wave, Orange Money, Moov Money) devra valider les montants et les notifications côté serveur (signature des webhooks).
- Le frontend conserve le jeton de session dans `localStorage` (exposé en cas de XSS) ; à terme, s'appuyer uniquement sur le cookie `HttpOnly`.
- Les retraits sont validés manuellement par l'administration après un transfert Mobile Money effectué hors de l'application ; aucun remboursement automatique n'est déclenché lors de l'annulation d'un billet.
- Le QR code contient le code du billet : une capture d'écran partagée donne accès à l'entrée, une seule fois (premier scanné, premier entré).
