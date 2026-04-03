# Gig Shield (Devtrails Phase 2)

Full-stack web application for **Automation & Protection** with dynamic premiums, proactive triggers, and zero-touch claims.

## Stack

- Frontend: React + Vite
- Backend: Express.js + JWT auth
- API data: Open-Meteo weather API (with mock fallback)

## Features Delivered

- Worker registration/login with JWT auth
- Policy catalog with dynamic weekly premiums
- Premium formula visible in UI: `basePremium * jobRisk * locationRisk * weatherRisk`
- Purchase policy and view active coverage
- Manual claim creation + claim status tracking
- Automated trigger engine (5 triggers):
  - Heavy rain alert
  - Flood warning
  - High wind alert
  - Traffic disruption forecast
  - Heatwave alert
- Zero-touch claims:
  - Auto-submits weather claims when severe triggers are active
  - Auto-approval for predefined conditions
- Dashboard with user details, premium factors, weather signals, triggers, and claims history

## Project Structure

- `backend/` Express API server
- `frontend/` React client

## Run Locally

### 1) Backend

```bash
cd backend
npm install
copy .env.example .env
# Edit .env and set valid MongoDB Atlas credentials before running.
npm run dev
```

API runs at `http://localhost:5000`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`.

## Demo Script (2 minutes)

1. Register a worker with a risky job + location.
2. Show dynamic premiums and formula factors in policy cards.
3. Purchase a policy.
4. Open automation panel to show weather-trigger notifications.
5. Show auto-generated claim (if severe weather exists) or submit a manual claim.
6. Highlight claim status and auto-approval logic.

## Deploy On Netlify (Frontend)

This project is full-stack. Netlify should host the `frontend/` app, while backend API should be deployed to a Node host (for example Render, Railway, or Fly.io).

### 1) Deploy backend first

- Deploy `backend/` to a Node runtime host.
- Ensure it is publicly accessible, for example `https://your-backend.example.com/api`.

### 2) Deploy frontend to Netlify

- Push repo to GitHub (already done).
- In Netlify, choose **Add new site** -> **Import from Git**.
- Select this repository.
- Netlify auto-reads `netlify.toml`:
  - Base directory: `frontend`
  - Build command: `npm run build`
  - Publish directory: `dist`

### 3) Add required Netlify env var

In Netlify Site Settings -> Environment variables, add:

- `VITE_API_BASE_URL` = `https://your-backend-host/api`

Then trigger redeploy.

### 4) SPA routing

`netlify.toml` already includes redirect rules so React Router routes load correctly.
