# Overhead Employees (Cloud SQL)

Overhead employees now persist to Cloud SQL via the `/api/overhead-employees` route. Firebase Auth is required on every request and the server writes to the `overhead_employees` table defined in `cloudsql_schema.sql`.

## How it works
- Client loads data with `useOverheadEmployees`, which calls the API with the current user's Firebase ID token.
- Rows are stored with per-user isolation (`user_id` column) plus audit fields (`created_by`, `updated_by`).
- LocalStorage is no longer used.

## Setup
1. Ensure `.env.local` has Firebase client + admin settings and a Postgres connection string.
2. Apply the schema in `cloudsql_schema.sql` to your Cloud SQL instance (includes `overhead_employees` table and `user_storage` key/value cache).
3. Sign in via Firebase Auth; the UI will sync overhead rows to Cloud SQL automatically.

## API reference
- `GET /api/overhead-employees` → list rows for the authenticated user.
- `POST /api/overhead-employees` with `{ employees: [...] }` → upsert rows.
- `DELETE /api/overhead-employees` with `{ id }` → delete a row.
