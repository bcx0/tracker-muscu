# ForgeOS — Tracker de musculation personnel

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript) ![Supabase](https://img.shields.io/badge/Supabase-Auth+DB-3ECF8E?logo=supabase) ![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38BDF8?logo=tailwindcss) ![Recharts](https://img.shields.io/badge/Recharts-visualisation-red)

Application web mobile-first de suivi d'entraînement musculaire pour athlètes solo en home gym. Planifie automatiquement les séances hebdomadaires, calcule la progression via e1RM (formule Epley), affiche le volume par groupe musculaire et gamifie l'adhérence au programme.

---

## Stack technique

- **Framework** — Next.js 14 (App Router)
- **Base de données** — Supabase (PostgreSQL + Auth + Row Level Security)
- **Style** — Tailwind CSS 3.4 (dark mode natif)
- **Graphiques** — Recharts
- **Icônes** — Lucide React
- **Notifications** — React Hot Toast

---

## Prérequis

- Node.js ≥ 18
- Compte Supabase

---

## Installation

```bash
git clone <repo-url>
cd tracker-muscu
npm install
cp .env.local.example .env.local
# Remplir les variables d'environnement
```

Appliquer le schéma Supabase :

```bash
# Via le dashboard Supabase SQL Editor ou la CLI Supabase
# Exécuter le contenu de supabase/schema.sql
```

---

## Variables d'environnement

| Variable | Description | Requis |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique (anon) Supabase | ✅ |

---

## Lancement en développement

```bash
npm run dev
```

Application disponible sur [http://localhost:3000](http://localhost:3000).

---

## Structure des dossiers

```
tracker-muscu/
├── app/
│   ├── auth/           # Connexion / inscription
│   ├── onboarding/     # Paramétrage initial (niveau, objectif, planning)
│   ├── today/          # Dashboard du jour — séance en cours
│   ├── week/           # Planning de la semaine
│   ├── session/[id]/   # Logger une séance (exercices, séries, poids, RIR)
│   ├── progress/       # Graphiques de progression
│   ├── exercises/      # Bibliothèque d'exercices personnels
│   ├── rapport/        # Rapport hebdomadaire
│   └── settings/       # Paramètres utilisateur
├── components/
│   ├── AuthGuard.tsx
│   ├── BottomNav.tsx
│   └── ui/             # Design system (Badge, Card, Modal, ProgressBar…)
├── lib/
│   ├── calculations.ts       # Formule e1RM (Epley)
│   ├── suggestion.ts         # Progression déterministe (3 derniers logs + RIR)
│   ├── gamification.ts       # Points, niveaux, streak
│   ├── muscle-fatigue.ts     # Fatigue musculaire estimée
│   ├── program-generator.ts  # Génération automatique du programme
│   └── weeklyReport.ts       # Rapport hebdomadaire
├── supabase/
│   ├── schema.sql       # Schéma complet de la base de données
│   └── migrations/
└── types/
    └── index.ts         # Types TypeScript partagés
```

---

## Fonctionnalités principales

- **Dashboard quotidien** : séance du jour avec groupes musculaires et statut
- **Log de séance** : poids, reps, séries, RIR → e1RM calculé automatiquement (formule Epley)
- **Progression déterministe** : suggestions basées sur les 3 derniers logs et le RIR
- **Volume hebdomadaire** : suivi par groupe musculaire avec cibles min/max visibles
- **Génération de programme** : planification automatique des semaines d'entraînement
- **Gamification** : points par séance, niveaux, streak (interrompu uniquement par "abandonné")
- **Rapports** : insights hebdomadaires et tendances de progression
- **Bibliothèque d'exercices** : gestion personnelle des exercices
- **Onboarding** : paramétrage du niveau, objectif et jours d'entraînement

---

## Programme par défaut (5 séances)

| Séance | Groupes ciblés |
|---|---|
| Push | Pectoraux, épaules, triceps |
| Pull | Dos, biceps |
| UpperChest | Pectoraux hauts, épaules |
| ShouldersArms | Épaules, bras |
| AbsLegs | Abdos, jambes |

---

## Schéma de base de données (Supabase)

| Table | Rôle |
|---|---|
| `user_settings` | Préférences (sessions/semaine, jours, objectif, niveau) |
| `exercises` | Bibliothèque d'exercices personnelle |
| `workout_templates` | Templates de séances |
| `weekly_plans` | Plannings hebdomadaires |
| `workout_sessions` | Séances (statut: upcoming / done / partial / abandoned / rest) |
| `exercise_logs` | Logs d'exercices (poids, reps, séries, RIR, e1RM) |
| `muscle_volume_cache` | Cache du volume hebdomadaire par groupe musculaire |

Toutes les tables sont protégées par RLS — accès limité aux données de l'utilisateur connecté.

---

## Déploiement

```bash
npm run build
```

Vercel recommandé. Configurer les variables d'environnement Supabase dans le dashboard Vercel.

---

## Statut du projet

**MVP** — Application fonctionnelle en usage personnel actif.
