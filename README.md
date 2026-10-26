# Proximo CI — plateforme artisans & prestataires (React + API + base de données)

Projet reconstruit à partir de la maquette Figma Make « Combine Pages into Website ».
Le front React est conservé à l'identique ; toutes les données (catalogue, artisans, demandes, offres,
comptes, back-office) viennent désormais d'une **base SQLite** via une **API Node sans dépendance**.

## Démarrage

Prérequis : **Node ≥ 22.13** (SQLite est intégré à Node, rien d'autre à installer côté serveur).

```bash
npm install
cp .env.example .env      # facultatif
npm run dev               # API :3001 + site :5173  → ouvrir http://localhost:5173
```

Au **premier lancement**, la base `data/proximo.db` est créée et remplie (6 sections de services, 24 artisans/clients,
demandes, offres, journal d'audit). Les **3 comptes admin** sont créés avec un mot de passe et un secret TOTP
aléatoires, **affichés une seule fois dans la console** : ajoutez le secret dans Google Authenticator / Authy,
puis connectez-vous sur `/backoffice-login`.

| Commande | Rôle |
|---|---|
| `npm run dev` | développement (API + Vite avec proxy `/api`) |
| `npm run build && npm start` | production : l'API sert aussi le site compilé sur `:3001` |
| `npm test` | 8 tests d'intégration de l'API (2FA, droits, verrouillage, audit…) |
| `npm run seed` | réinitialise la base (⚠ efface tout) |

**Logo** : copiez `Logo_Proximo_modernis_.png` (export Figma) dans `public/logo.png`.

## Icônes

Plus aucun emoji dans l'interface : les icônes sont des SVG vectoriels (bibliothèque **react-icons** : Lucide pour
l'interface, Font Awesome pour le logo WhatsApp), colorables par CSS et nettes à toutes les tailles.
`src/components/Icon.tsx` contient la correspondance : `<I e="📍" />` affiche l'icône, `<Rich text="…" />` convertit
les emojis d'une chaîne (ex. les titres de services stockés en base). Pour changer une icône, modifiez la table `MAP`.
Le drapeau 🇨🇮 (mal rendu sous Windows) est remplacé par un SVG orange · blanc · vert.

## Architecture

```
server/   index.js (démarrage) · app.js (routes REST) · db.js (schéma SQL) · seed.js
          crypto.js (scrypt, jetons signés, TOTP RFC 6238) · notify.js (envoi des OTP)
src/      App.tsx (routes) · pages/ · components/ · lib/api.ts (client typé) · lib/admin.ts
```

Tables : `users`, `artisans`, `services`, `artisan_services`, `reviews`, `portfolio`, `requests` (demandes de devis),
`jobs` (offres d'emploi), `contact_messages`, `otp_challenges`, `admins`, `admin_sessions`, `audit_log`.

## Ce qui a changé par rapport à la maquette

| Maquette (données factices) | Maintenant |
|---|---|
| Listes d'artisans / services codées en dur | `GET /api/artisans`, `/api/services`, `/api/home`… |
| Formulaires « Poster une offre », « Publier une offre », « Contact » → simple `setSubmitted(true)` | enregistrés en base (`POST /api/requests`, `/api/jobs`, `/api/contact`) avec validation serveur |
| Inscription / connexion / 2FA simulées (« tout code à 6 chiffres passe ») | comptes réels, mots de passe hachés (scrypt), OTP à usage unique, 5 essais max, expiration 10 min |
| Comptes admin + mots de passe + OTP **écrits dans le code JS** (visibles par tout visiteur) | comptes en base, TOTP réel, verrouillage après 3 échecs, session serveur expirant après 15 min d'inactivité |
| Droits (RBAC) vérifiés uniquement côté navigateur | vérifiés **côté serveur** à chaque requête (403 sinon) |
| Journal d'audit en `sessionStorage` | table `audit_log` immuable (triggers SQL interdisant UPDATE/DELETE) |
| Statistiques du back-office inventées | calculées depuis la base |
| Page `/admin` (doublon de maquette, données factices) | redirige vers `/backoffice-login` |
| Page `/tableau-de-bord` inexistante (404 dans la maquette) | espace perso artisan/client (statut, disponibilité, demandes) |

Parcours d'un nouvel artisan : inscription → code OTP → compte **« En attente »** → un admin clique « Approuver »
dans le back-office → le profil apparaît dans la recherche.

## Points à connaître avant la mise en production

1. **Envoi des OTP** : en dev le code est affiché dans la console et dans la page 2FA. En production, mettez
   `OTP_MODE=provider` et implémentez l'envoi dans `server/notify.js` (WhatsApp Business API, SMS Orange/MTN, Twilio…).
2. **Mot de passe artisan** : la maquette imposait 4 à 8 caractères, ce qui est trop faible ; le serveur exige **6 à 64**
   (modifiable dans `validatePassword`, `server/app.js`).
3. **HTTPS obligatoire** en production (reverse proxy Caddy/nginx) ; mettez `TRUST_PROXY=1` derrière un proxy.
4. Le compteur `pros_count` du catalogue (ex. « 148 pros ») est une valeur marketing de départ, pas un comptage réel.
   Les chiffres de la page d'accueil (« 2 400+ artisans ») restent statiques.
5. Les photos sont des URL Unsplash de démonstration. Pour de vraies photos d'artisans, ajoutez un envoi de fichiers
   (stockage objet) — non inclus.
6. Les comptes artisans/clients de démonstration ont un mot de passe aléatoire inconnu : créez le vôtre via l'inscription.
7. Limitation de débit en mémoire (un seul processus). Pour plusieurs instances, déplacez-la dans Redis/la base.
8. Sauvegardes : copiez régulièrement `data/proximo.db` (mode WAL : utilisez `sqlite3 .backup` à chaud).
