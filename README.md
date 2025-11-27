# Salt XC Quote Hub — Frontend (Next.js)

Next.js 15 App Router UI that authenticates with Firebase and calls the FastAPI backend on port 5010. All data (pipeline, quotes, storage, overhead, roles/metadata) lives in Postgres/Cloud SQL behind the backend.

## Features
- Firebase Authentication (client SDK + ID token forward to backend).
- Pipeline table and changelog, quote creation/review, overhead employee management.
- Cloud storage sync for user preferences and cached data.
- PDF/HTML export helpers (html2canvas + jspdf) for quote previews.
- Responsive dashboards for PMs and administrators with role-aware behaviors.

## Technical Details
- Next.js 15 (App Router), React 19, TypeScript 5.
- Styling via Tailwind 4 + Radix UI primitives.
- Firebase Web SDK for auth; tokens injected via `authFetch` and `cloudStorageClient`.
- API base is configurable via `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:5010`).
- Local API routes under `app/api/*` exist to proxy to backend or handle server-side needs; prefer hitting the FastAPI service directly.

## Setup
1) Install dependencies
```bash
npm install
```
2) Configure environment
```bash
cp env.example .env.local
```
Fill in Firebase client keys and set `NEXT_PUBLIC_API_BASE_URL` to the FastAPI host (e.g., `http://localhost:5010`). Only keep server-only secrets (if any) in `.env` — don’t check them in.

3) Run the frontend
```bash
npm run dev   # serves on http://localhost:3000
```
Ensure the backend is reachable on 5010 so API calls succeed.

## Deployment Notes
- The frontend is meant to be its own container/service (port 3000) talking to the FastAPI service (port 5010).
- Provide the same Firebase client config and `NEXT_PUBLIC_API_BASE_URL` at build/runtime.
- If using Next.js API routes that require database access, you must also supply Postgres env vars, but the recommended path is to route through the FastAPI backend.
