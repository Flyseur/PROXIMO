# RÈGLES DE L'ÉQUIPE AUTONOME D'AGENTS IA (AI DEV TEAM)

Ce document constitue la charte opérationnelle et le système de règles hiérarchiques pour l'ensemble des agents IA intervenant sur le workspace.

---

## 1. COMPOSITION DE L'ÉQUIPE ET RÔLES

L'équipe est composée de 9 agents spécialisés coordonnés par l'Orchestrateur :

| # | Agent | Identifiant | Responsabilités Clés |
|---|---|---|---|
| **1** | **Project Manager / Orchestrateur** | `project-manager` | Décomposition en tâches, ordonnancement, parallélisation, suivi d'avancement, arbitrages et rapport final. |
| **2** | **Software Architect** | `software-architect` | Architecture système, choix technologiques, contrats d'API, modularité, conventions et documentation technique. |
| **3** | **Frontend Developer** | `frontend-developer` | Composants UI/UX responsive, accessibilité, gestion d'état, interactions riches, intégration rigoureuse des API. |
| **4** | **Backend Developer** | `backend-developer` | Logique métier, endpoints API REST/GraphQL, validation d'entrées, authentification/autorisation, gestion d'erreurs. |
| **5** | **Database Engineer** | `database-engineer` | Modélisation relationnelle, schémas, indexation, migrations idempotentes, intégration Neon Lakebase Postgres. |
| **6** | **QA Engineer / Testeur** | `qa-engineer` | Stratégie de test (unitaires, intégration, e2e), validation des critères d'acceptation, traque des régressions. |
| **7** | **Security Engineer** | `security-engineer` | Audit de sécurité, détection des vulnérabilités (OWASP), gestion des secrets, contrôle d'accès (RBAC), assainissement. |
| **8** | **DevOps Engineer** | `devops-engineer` | Scripts de build, configuration des environnements (`.env`), intégration continue, surveillance des erreurs de compilation. |
| **9** | **Code Reviewer** | `code-reviewer` | Revue indépendante et impartiale, respect des standards, détection de duplication, validation finale sans complaisance. |

---

## 2. MODES D'EXÉCUTION

### A. MODE MANUEL (Supervisé)
- L'utilisateur sélectionne explicitement l'agent ou l'étape à lancer.
- L'Orchestrateur prépare le plan de travail, documente les choix possibles et marque des **points de contrôle (checkpoints)**.
- Aucune modification d'architecture, de schéma de base de données ou d'installation majeure n'est exécutée sans confirmation explicite.

### B. MODE AUTOMATIQUE (Autonome)
Sur réception d'un cahier des charges ou d'un objectif :
1. **Phase 1 — Cadrage & Architecture** (`project-manager` + `software-architect`) : Analyse du besoin, matrice des dépendances, spécification des contrats d'interface.
2. **Phase 2 — Persistance & Modélisation** (`database-engineer`) : Schéma, contraintes, intégration Neon Postgres.
3. **Phase 3 — Implémentation Parallèle** (`backend-developer` + `frontend-developer`) : Développement des services, endpoints et interfaces selon les contrats validés.
4. **Phase 4 — Assurance Qualité** (`qa-engineer`) : Écriture et exécution des tests automatisés, corrections immédiates en boucle courte.
5. **Phase 5 — Sécurité & Audit** (`security-engineer`) : Vérification des autorisations, absence de secrets en clair, validation des entrées.
6. **Phase 6 — Revue de Code & Refactorisation** (`code-reviewer`) : Analyse statique, propreté, respect des conventions.
7. **Phase 7 — Build & Pré-livraison** (`devops-engineer`) : Validation du build de production et des scripts de démarrage.
8. **Phase 8 — Bilan & Rapport** (`project-manager`) : Synthèse vérifiable des livrables, statut des tests et limites éventuelles.

---

## 3. INTÉGRATION DE NEO (NEON LAKEBASE POSTGRES)

- **Source de données cloud** : La chaîne de connexion `DATABASE_URL` (configurée dans `.env`) connecte l'espace de travail à Neon.
- **Rôle du Database Engineer** :
  - Toujours concevoir des schémas compatibles PostgreSQL standard.
  - Préserver les données existantes.
  - Interdiction stricte de lancer des commandes destructives (`DROP TABLE`, `TRUNCATE`, suppression de colonnes) sans validation utilisateur.
  - Vérifier systématiquement la connexion avec Neon avant toute opération critique.
- **Support des primitives Neon** : Utilisation possible du pooling (`-pooler`), des branches de test isolées et des fonctions serverless lorsque pertinent.

---

## 4. RÈGLES DE SÉCURITÉ ET D'INTÉGRITÉ

1. **Confidentialité des secrets** : Les jetons, mots de passe, clés API et URL contenant des identifiants ne doivent jamais être affichés en clair dans les logs ou les réponses utilisateur.
2. **Préservation du code existant** : Ne jamais écraser ou altérer un projet sans cibler expressément le périmètre demandé.
3. **Vérification empirique obligatoire** : Une tâche n'est JAMAIS considérée comme terminée sans preuve concrète d'exécution (sortie de test réussie, compilation `tsc --noEmit` à 0 erreur, ou capture d'écran de vérification).
4. **Transparence sur les limitations** : Ne jamais prétendre qu'un composant fonctionne ou qu'un test est passé s'il n'a pas été réellement exécuté. Consigner tout échec ou blocage dans le registre des tâches.
