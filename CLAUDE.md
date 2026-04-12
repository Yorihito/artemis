# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Artemis Mission Tracker** — Multi-mission NASA Artemis dashboard. Live at https://artemis.nyoyapoya.cc/

**Current status (as of 2026-04-12):**
- Artemis II: **Mission Complete** (splashdown ~2026-04-10). Archived and always viewable.
- Artemis III: Placeholder tab in UI. Tracking screen to be built when launch date is announced.
- News is now the default landing view.

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
# Backend: build Docker image and push to Container App
cd backend
az acr build --registry artemis2tracker --image artemis-api:latest --platform linux/amd64 .
DIGEST=$(az acr repository show --name artemis2tracker --image "artemis-api:latest" --query "digest" -o tsv)
az containerapp update --name artemis-api --resource-group artemis-rg --image "artemis2tracker.azurecr.io/artemis-api@$DIGEST"

# Frontend: build then deploy static export
cd frontend
NEXT_PUBLIC_API_BASE_URL=https://artemis-api.calmocean-51582704.japaneast.azurecontainerapps.io npm run build
STATIC_TOKEN=$(az staticwebapp secrets list --name artemis2-frontend --resource-group artemis-rg --query "properties.apiKey" -o tsv)
npx @azure/static-web-apps-cli deploy ./out --deployment-token "$STATIC_TOKEN" --env production
```

No automated tests exist in this codebase.

## Architecture

### Page Navigation (Frontend)
Three top-level tabs in `frontend/src/app/page.tsx`:
- **NEWS** (default): Full-width `NewsPanel` — main focus while between missions
- **ARTEMIS II**: Archive view — orbit canvas + telemetry (mission complete, frozen data)
- **ARTEMIS III**: Placeholder — "launch date not yet announced" message; tracking screen to be added here

### Data Flow
1. **Backend poller** (`app/background/poller.py`) runs every 30 min (cruise) or 1 min (approach) as an asyncio loop
2. Primary source: NASA OEM file — currently disabled via `OEM_DISABLED=true` env var due to coordinate frame mismatch with Horizons (EME2000 vs ICRF, ~22° offset at lunar distance)
3. Active source: JPL Horizons API (NAIF ID `-1024` for Orion, `301` for Moon)
4. Post-splashdown: when Horizons returns no data and current time > `MISSION_SPLASHDOWN_EPOCH`, poller injects a Mission Complete state (surface position, zero velocity)
5. Results cached in `app/services/cache_service.py` (in-memory) and Azure Table Storage (trajectory history, visitor counts)

### Frontend Key Files
| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Main page; top-level nav (NEWS/ARTEMIS II/ARTEMIS III) |
| `src/components/orbit/OrbitCanvas2D.tsx` | D3.js SVG orbit view; zoom/pan; MOON/EARTH/SUN modes |
| `src/lib/i18n.ts` | All UI strings (en/ja); `t()`, `translatePhase()`, `relativeTime()` |
| `src/contexts/LocaleContext.tsx` | Browser language detection; Japanese → "ja", others → "en" |
| `src/components/news/NewsPanel.tsx` | News feed from backend |
| `src/components/layout/MissionHeader.tsx` | Header: "Artemis Mission Tracker" branding + live status |

### Backend Key Services
| File | Purpose |
|------|---------|
| `app/config.py` | All env-var settings; `USE_MOCK=true` for local dev |
| `app/background/poller.py` | Main data fetch loop; trajectory pre-population; post-splashdown injection |
| `app/services/horizons_client.py` | JPL Horizons API client (state vectors) |
| `app/services/nasa_oem_client.py` | NASA OEM ZIP/ASC fetcher (disabled; kept for future use) |
| `app/services/phase_service.py` | Mission phase + approach detection; surface pos (≤6380km) suppresses approach alert |
| `app/services/trajectory_store.py` | Azure Table Storage read/write for trajectory points |
| `app/services/cache_service.py` | In-memory cache (trajectory deque max 6000pts, subsampled to 4-min intervals) |

### Important Constants
- Launch epoch: `2026-04-01T22:35:12Z`
- Splashdown epoch: `2026-04-10T17:00:00Z` (approximate)
- Horizons ephemeris start: `2026-04-02T02:00:00Z`
- Orion NAIF ID: `-1024`; Moon: `301`
- Approach thresholds: Moon < 100,000 km, Earth < 50,000 km
- Max cached trajectory points: 6,000 (subsampled at 4-min intervals to cover full 14-day mission arc)

### Coordinate Frames
JPL Horizons returns vectors in ICRF/J2000 geocentric. NASA OEM uses EME2000 geocentric. These frames differ by ~22° angular offset for the Artemis II trajectory — **do not mix** trajectory points from both sources in storage. This is why OEM is currently disabled.

### What "Artemis III prep" means for next steps
When Artemis III launch date is announced:
1. Add new NAIF ID / Horizons target for Orion III spacecraft
2. Add `MISSION_III_LAUNCH_EPOCH` to `app/config.py`
3. Replace the ARTEMIS III placeholder in `page.tsx` with the same canvas+telemetry layout used for Artemis II
4. Consider adding a `mission` query param to API endpoints to support both missions simultaneously

### Azure Resources (subscription: Musukoyo)
- Resource group: `artemis-rg` (japaneast)
- Container App: `artemis-api` | Registry: `artemis2tracker`
- Static Web App: `artemis2-frontend` | Storage: `artemis2storage`
- Backend URL: `https://artemis-api.calmocean-51582704.japaneast.azurecontainerapps.io`
