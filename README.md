# 🚀 Artemis II Mission Tracker

> Real-time tracking of NASA's Artemis II Orion spacecraft — powered by JPL Horizons ephemeris data.

**Live:** https://artemis.nyoyapoya.cc/
---

## What is this?

A real-time mission dashboard for [Artemis II](https://www.nasa.gov/mission/artemis-ii/), NASA's first crewed lunar mission since Apollo 17. It pulls live trajectory data directly from [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) and visualizes Orion's position, velocity, and path through cislunar space.

---

## Features

- **Live orbit canvas** — 2D top-down view of Orion's position relative to Earth and the Moon, with trajectory history and zoom/pan support
- **Real Moon position** — Moon location fetched from JPL Horizons (NAIF ID 301) at every poll cycle, not an approximation
- **Telemetry panel** — Mission elapsed time (live), velocity, Earth distance, Moon distance, flight phase
- **Mission timeline** — Key milestones with planned vs. actual times, sourced from the NASA press kit
- **Approach alerts** — Automatic notification when Orion is closing in on the Moon or Earth, with suggested polling frequency
- **Visitor counter** — Unique visitors and total visits, persisted in Azure Table Storage
- **Mobile-friendly** — Responsive layout, works on phones and tablets

---

## Data

| Source | Used for |
|---|---|
| [JPL Horizons API](https://ssd.jpl.nasa.gov/horizons/) | Orion position/velocity (NAIF ID `-1024`), Moon position (NAIF ID `301`) |
| [NASA Press Kit](https://www.nasa.gov/artemis-ii-press-kit/) | Mission timeline milestones |

Horizons ephemeris for Artemis II begins at **2026-04-02T02:00 UTC** (approximately T+3h25m after launch). Trajectory history before that time is not available.

Polling schedule:

| Phase | Interval |
|---|---|
| Cruise | 30 min |
| Approaching Moon or Earth | 1 min |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (static export), TypeScript, D3.js, Tailwind CSS |
| Backend | FastAPI (Python), asyncio background poller |
| Data persistence | Azure Table Storage (trajectory cache, visitor counts) |
| Hosting | Azure Static Web Apps (frontend), Azure Container Apps (backend) |
| Container registry | Azure Container Registry |

---

## Architecture

```
Browser
  └── Azure Static Web Apps (Next.js static export)
        └── fetch() ──► Azure Container Apps (FastAPI)
                              ├── Background poller (asyncio)
                              │     ├── JPL Horizons API  (Orion + Moon)
                              │     └── Azure Table Storage (trajectory cache)
                              └── Azure Table Storage (visitor counts)
```

The backend poller runs as a persistent asyncio task. On startup it loads stored trajectory points from Table Storage, fetches any gap since the last stored point from Horizons, then resumes the regular polling loop. Trajectory history survives container restarts.

---

## Local Development

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
USE_MOCK=true uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
# set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 in .env.local
npm run dev
```

With `USE_MOCK=true`, the backend generates simulated trajectory data and skips all Horizons and Azure calls — no credentials needed for local development.

---

## Deploy

**Backend** (Azure Container Apps)
```bash
az acr build --registry <registry> --image artemis-backend:latest ./backend
az containerapp update --name <app> --resource-group <rg> \
  --image <registry>.azurecr.io/artemis-backend:latest \
  --revision-suffix $(date +%m%d%H%M)
```

**Frontend** (Azure Static Web Apps)
```bash
cd frontend
npm run build
npx @azure/static-web-apps-cli deploy ./out \
  --deployment-token <token> --env production
```

---

## Notes

- This is an unofficial fan project. Data is sourced from publicly available NASA/JPL APIs.
- Horizons ephemeris data for Artemis II (NAIF ID `-1024`) is provisional and subject to updates by JPL.
- **NOT official NASA data.**

---

*DATA: JPL HORIZONS · NOT OFFICIAL NASA DATA*
