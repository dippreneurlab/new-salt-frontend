# Salt XC Quote Hub

Next.js 15 app with Firebase Auth, Firebase Hosting, and Cloud SQL (Postgres) persistence for pipeline, quotes, and overheads.

## Stack
- Next.js (app router)
- Firebase Auth (client + admin)
- Firebase Hosting (frameworks backend enabled in `firebase.json`)
- Cloud SQL / Postgres via `pg`

## Setup
1. Copy environment template
   ```bash
   cp env.example .env.local
   ```
2. Fill in Firebase client + admin keys and a Postgres connection string (or `POSTGRES_*` vars).
3. Install dependencies and run dev server
   ```bash
   npm install
   npm run dev
   ```

## Cloud SQL
- Schema lives in `cloudsql_schema.sql` (`user_storage` key/value cache + `overhead_employees` table).
- The app hydrates data after Firebase login; all `localStorage` usage has been replaced by Cloud SQL–backed storage.

## Firebase Hosting
- Configured in `firebase.json` with `frameworksBackend` for SSR.
- Deploy after authenticating with the Firebase CLI:
  ```bash
  firebase use your-firebase-project-id
  firebase deploy
  ```

## Notes
- Authentication is required for all API routes (`/api/storage`, `/api/overhead-employees`).
- To clear test data, remove rows from `user_storage`/`overhead_employees` for your Firebase `uid`.
