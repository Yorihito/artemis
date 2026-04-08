# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Artemis II Mission Tracker** — Real-time NASA Artemis II dashboard showing Orion spacecraft position, velocity, and trajectory. Live at https://artemis.nyoyapoya.cc/

## Commands

### Frontend (Next.js 15, TypeScript, static export)
```bash
cd frontend
npm run dev                          # Local dev server
npm run build                        # Build static export to ./out
NEXT_PUBLIC_API_BASE_URL=https://artemis-api.calmocean-51582704.japaneast.azurecontainerapps.io npm run build  # Production build
npm run lint                         # ESLint
```

### Backend (FastAPI, Python 3.12)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
USE_MOCK=true uvicorn app.main:app --reload   # Local dev (no Azure credentials needed)
```

### Deploy
```bash
# Backend: build Docker image and restart Container App
az acr build --registry artemis2tracker --image artemis-api:latest --platform linux/amd64 .
DIGEST=$(az acr repository show --name artemis2tracker --image "artemis-api:latest" --query "digest" -o tsv)
az containerapp update --name artemis-api --resource-group artemis-rg --image "artemis2tracker.azurecr.io/artemis-api@$DIGEST"

# Frontend: deploy static export to Azure Static Web Apps
STATIC_TOKEN=$(az staticwebapp secrets list --name artemis2-frontend --resource-group artemis-rg --query "properties.apiKey" -o tsv)
npx @azure/static-web-apps-cli deploy ./out --deployment-token "$STATIC_TOKEN" --env production
```

No automated tests exist in this codebase.

## Architecture

### Data Flow
1. **Backend poller** (`app/background/poller.py`) runs every 30 min (cruise) or 1 min (approach) as an asyncio loop
2. Primary source: NASA OEM file (ZIP from NASA tracking page, CCSDS OEM 2.0 format, EME2000 frame) — currently disabled via `OEM_DISABLED=true` env var due to coordinate frame mismatch with Horizons
3. Fallback: JPL Horizons API (NAIF ID `-1024` for Orion, `301` for Moon)
4. Results cached in `app/services/cache_service.py` (in-memory) and Azure Table Storage (trajectory history, visitor counts)

### Frontend
- Next.js App Router with `output: "export"` — purely static, no SSR
- `OrbitCanvas2D` (D3.js SVG): main orbit view with Earth/Moon/trajectory, zoom/pan, approach modes, heliocentric SUN view
- Star background: pre-generated `frontend/public/starfield.png` (Hipparcos catalog, 30° FOV ecliptic north pole) — regenerate with `python scripts/generate_starfield.py`
- Language detection: `LocaleContext` reads `navigator.language` on mount; Japanese browsers get Japanese UI, others get English
- SWR polls `/api/mission/current` at configurable intervals (default 30 min, auto-switch to 1 min on approach)
- `NEXT_PUBLIC_API_BASE_URL` env var points to the FastAPI backend

### Backend Key Services
| File | Purpose |
|------|---------|
| `app/config.py` | All env-var settings; `USE_MOCK=true` for local dev |
| `app/background/poller.py` | Main data fetch loop; OEM → Horizons priority; trajectory pre-population |
| `app/services/horizons_client.py` | JPL Horizons API client (state vectors) |
| `app/services/nasa_oem_client.py` | NASA OEM ZIP/ASC fetcher with rate-limit handling and negative cache |
| `app/services/phase_service.py` | Mission phase detection (Ascent/TranslunarCoast/LunarFlyby/ReturnCoast/Reentry) |
| `app/services/trajectory_store.py` | Azure Table Storage read/write for trajectory points |
| `app/services/cache_service.py` | In-memory cache (trajectory, current state) |

### Important Constants
- Launch epoch: `2026-04-01T22:35:12Z`
- Horizons ephemeris start: `2026-04-02T02:00:00Z`
- Orion NAIF ID: `-1024`; Moon: `301`
- Approach thresholds: Moon < 100,000 km, Earth < 50,000 km
- Max cached trajectory points: 2,880

### Coordinate Frames
JPL Horizons returns vectors in ICRF/J2000 geocentric. NASA OEM uses EME2000 geocentric. These frames differ by ~22° angular offset for the Artemis II trajectory — **do not mix** trajectory points from both sources in storage. This is why OEM is currently disabled.

### Azure Resources (subscription: Musukoyo)
- Resource group: `artemis-rg` (japaneast)
- Container App: `artemis-api` | Registry: `artemis2tracker`
- Static Web App: `artemis2-frontend` | Storage: `artemis2storage`
- Backend URL: `https://artemis-api.calmocean-51582704.japaneast.azurecontainerapps.io`
