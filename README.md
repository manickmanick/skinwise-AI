
# SkinWise AI

A responsive AI-powered skincare web application MVP.

## Technology Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express
- Database: PostgreSQL (planned)
- AI integration: YouCam Skin Analysis API (planned)

## Phase 1 Scope

- Responsive starter interface
- Skin Profile placeholder
- Skin Analysis placeholder
- My Routine placeholder
- Progress Tracking placeholder
- Backend health endpoint
- Frontend-to-backend HTTP communication
- Environment-based configuration

No real skin analysis is implemented in this phase.

## Prerequisites

- Node.js LTS and npm
- Git (optional)

## Project Structure

```text
SkinWise-AI/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── api.ts
│   │   ├── index.css
│   │   └── main.tsx
│   ├── .env.example
│   └── package.json
├── backend/
│   ├── src/
│   │   └── server.js
│   ├── .env.example
│   ├── .gitignore
│   └── package.json
├── .gitignore
└── README.md
```

## Windows Setup

Run the following commands from the project root.

### 1. Install frontend dependencies

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

### 2. Install backend dependencies

Open another PowerShell terminal from the project root:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

If a `.env` file already exists, preserve your existing configuration.

## Run the Applications

### Backend

In a PowerShell terminal:

```powershell
cd backend
npm run dev
```

Backend URL: http://localhost:3000

Health endpoint: http://localhost:3000/api/health

### Frontend

In a second PowerShell terminal:

```powershell
cd frontend
npm run dev
```

Open the local URL printed by Vite, normally:

http://localhost:5173

## Test the Backend

Open this URL in your browser:

http://localhost:3000/api/health

Expected JSON:

```json
{
  "status": "ok",
  "application": "SkinWise AI",
  "message": "Backend is running"
}
```

## Environment Variables

### Frontend

`VITE_API_BASE_URL` is the backend's base URL.

Never put private API keys or database credentials in frontend
environment variables.

### Backend

`PORT` configures the HTTP server port.

`FRONTEND_URL` configures the permitted frontend origin for CORS.

Keep real secrets in local environment variables and exclude them
from Git.

## Future Phases

- Verify the official YouCam API documentation and authentication
- Implement the verified YouCam integration on the backend
- Add PostgreSQL and persistent storage
- Build real skin profile and analysis workflows
- Add routines and progress tracking

## Development Status

Phase 1: Project foundation and connectivity verification.
