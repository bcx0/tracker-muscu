# ForgeOS

ForgeOS est une application web personnelle de suivi fitness pens�e pour un athl�te solo en home gym. L'application met la s�ance du jour au centre, applique des suggestions d�terministes de progression et affiche en permanence la streak, le volume hebdomadaire et une recommandation coach unique.

## Stack

- Next.js 14 App Router
- TypeScript strict
- Tailwind CSS
- Supabase Auth + PostgreSQL
- Recharts
- react-hot-toast
- uuid

## Installation locale

1. Copier `.env.local.example` vers `.env.local`
2. Renseigner `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Ex�cuter `npm install`
4. Appliquer le sch�ma SQL dans Supabase avec `supabase/schema.sql`
5. Ex�cuter `npm run dev`

## Structure

- `app/` : routes App Router (`/today`, `/week`, `/session/[sessionId]`, `/progress`, `/exercises`, `/settings`, `/auth`)
- `components/` : navigation, garde d'authentification, design system UI
- `lib/` : logique m�tier pure, helpers de dates, optimisation, gamification, client Supabase
- `types/` : types TypeScript partag�s
- `supabase/` : sch�ma SQL et seed de r�f�rence

## Flux principal

1. Connexion ou cr�ation de compte sur `/auth`
2. Setup initial sur `/settings`
3. G�n�ration du programme hebdomadaire fixe sur 5 jours
4. Consultation de la s�ance du jour sur `/today`
5. Saisie de s�ance sur `/session/[sessionId]`
6. Analyse de progression sur `/progress`

## Logique m�tier

- e1RM : formule d'Epley arrondie � 2 d�cimales
- Suggestions : progression d�terministe bas�e sur les 3 derniers logs et le RIR
- Streak : `done` et `partial` prolongent, `abandoned` casse, `rest` n'interrompt pas
- Volume : suivi par muscle avec cibles min/max visibles sur le dashboard et la progression

## Sch�ma Supabase

Tables principales :
- `user_settings`
- `exercises`
- `workout_templates`
- `weekly_plans`
- `workout_sessions`
- `exercise_logs`
- `muscle_volume_cache`

Les politiques RLS limitent l'acc�s � l'utilisateur propri�taire via `auth.uid() = user_id`.

## Donn�es par d�faut

La V1 utilise un template fixe de 5 s�ances :
- Push
- Pull
- UpperChest
- ShouldersArms
- AbsLegs

Les exercices par d�faut sont inject�s au premier setup si la biblioth�que est vide.

## Utilisation mobile

L'interface est mobile-first � partir de 375px, avec un conteneur centr� `max-w-md` sur desktop, une navigation basse fixe et des cartes condens�es pour logguer une s�ance rapidement.
