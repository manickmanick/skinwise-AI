
# SkinWise AI

SkinWise AI is a responsive skincare application with guest YouCam analysis and account-backed skin profiles, routines, checklists and analysis history.

## Stack

- Frontend: React, TypeScript, Vite, React Router
- Backend: Node.js, Express 5, JavaScript ES modules
- Database: MySQL 8 or a compatible MySQL server, accessed with `mysql2`
- Migrations: Knex
- Skin analysis: YouCam Skin Analysis API, called only from the backend
- Optional UV forecasts: Open-Meteo geocoding and forecast APIs

## Local setup (Windows PowerShell)

Prerequisites: Node.js 20 or newer, npm, and a running MySQL server.

Create a database and a local application user in MySQL (choose your own password):

```sql
CREATE DATABASE skinwise_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'skinwise_app'@'localhost' IDENTIFIED BY 'choose-a-local-password';
GRANT ALL PRIVILEGES ON skinwise_ai.* TO 'skinwise_app'@'localhost';
```

Install dependencies and copy the example configurations only when a local `.env` does not already exist:

```powershell
cd backend
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Set the database values and `YOUCAM_API_KEY` in `backend/.env`. Set `SESSION_SECRET` to a random secret of at least 32 bytes. Keep this file private; it is excluded from Git.

Run the versioned database migrations and start the API:

```powershell
npm run migrate
npm run dev
```

In a second terminal:

```powershell
cd frontend
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

The Vite app normally runs at `http://localhost:5173`; the backend listens on port `3000`. The frontend uses `VITE_API_BASE_URL` and must never contain provider keys or database credentials.

## API and database commands

From `backend/`:

- `npm run migrate` applies migrations.
- `npm run rollback` rolls back the most recent migration.
- `npm test` runs deterministic business-logic tests.
- `GET /api/health/live` checks process liveness.
- `GET /api/health/ready` checks MySQL readiness.

The first migration creates the server-side `sessions` table, accounts, preferences, profiles, analysis history, routine versions, and checklist records. Do not edit production schemas manually; add a versioned Knex migration instead.

## Core flows

- Guests can submit a JPEG or PNG photo, preview results and create an account. The backend validates image content, forwards the original bytes to YouCam and polls the provider task. Guest results are held only in the current browser page state.
- Signed-in users can save a self-reported profile, generate conservative morning/night routine steps, check off steps, view adherence and streaks, save analyses and compare compatible provider metrics.
- Profile, routines, analyses and checklist history are scoped to the signed-in account. Mutating requests use a session-bound CSRF token.
- UV guidance is optional. A saved city is used for the forecast, or the user can explicitly request a one-time browser location check. Precise browser coordinates are sent for that forecast request and are not saved by SkinWise. Forecasts are from [Open-Meteo](https://open-meteo.com/) and its [geocoding API](https://open-meteo.com/en/docs/geocoding-api).

## Data collection and retention

- **Face photo:** held in backend memory for the request and transmitted to YouCam over HTTPS for processing. SkinWise does not store the photo. YouCam's separate retention and processing terms apply; configure and disclose those terms for your deployment.
- **Guest analysis:** returned to the browser and kept in React memory while the page remains open. A refresh clears it. It is not inserted into the database.
- **Account analysis:** supported metric fields and timestamp are saved in MySQL. Temporary provider mask URLs are excluded. History remains until the user deletes the account.
- **Profile and routine:** questionnaire answers, timezone, optional city and versioned routine steps are saved for the account until account deletion.
- **Checklist:** completion records are stored by routine step and the user's local calendar date; changing a routine does not rewrite earlier records.
- **Session:** authentication is stored server-side in MySQL and represented in the browser by an HttpOnly cookie. Sessions expire after seven days; logout and account deletion revoke the account's sessions.
- **Deletion:** the profile page provides account deletion. The database cascades account-owned records, and the API removes the account's sessions.

Analysis values are displayed as returned by YouCam. SkinWise does not interpret them as diagnoses or claim that a change is medically meaningful. Routine completion and skin analysis are displayed separately.

## Troubleshooting

- If `/api/health/ready` fails, check that MySQL is running, the database exists, and the `DB_*` values are correct.
- If analysis reports an unavailable provider, check the backend `YOUCAM_API_KEY` and provider account. The key is never read from the frontend.
- If the frontend cannot call the API, confirm `VITE_API_BASE_URL` and ensure `FRONTEND_URL` exactly matches the Vite origin.
- Apply migrations after pulling schema changes with `npm run migrate` from `backend/`.
