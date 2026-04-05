# 🚀 Artemis Intelligence

> A real-time mission control dashboard for NASA's Artemis II — the first crewed cislunar voyage since Apollo 17 in 1972.

![Artemis Intelligence Dashboard](https://artemis-intelligence.vercel.app)

**Live Demo → [artemis-intelligence.vercel.app](https://artemis-intelligence.vercel.app)**

---

## What Is This?

Artemis Intelligence is a full-stack, real-time mission control interface built for NASA's Artemis II mission. It pulls live data from multiple NASA APIs, renders a 3D trajectory visualization, tracks Deep Space Network ground station activity, shows crew profiles, monitors space weather radiation alerts, and includes an AI chat assistant powered by Google Gemini.

This is not an official NASA product. It is an independent public engagement project built to make space exploration accessible and exciting for everyone.

---

## Features

- **Live Telemetry** — Real spacecraft position, velocity, distance from Earth, and signal delay pulled directly from JPL Horizons
- **3D Trajectory Visualization** — WebGL globe with animated trajectory arc, Moon, spacecraft dot, and solar flares (Three.js)
- **Deep Space Network Tracker** — Live map showing which ground station (Goldstone, Madrid, Canberra) is in contact with Orion
- **Mission Replay** — Full-screen immersive replay of the entire mission with scrubbing, speed controls (1×/2×/3×/4×), and a seekable timeline
- **Space Weather Alerts** — Solar flares, CMEs, and geomagnetic storm data from NASA DONKI
- **AI Mission Assistant** — Streaming chat powered by Google Gemini 2.5 Flash with full mission context
- **Crew Profiles** — Bios and stats for Reid Wiseman, Victor Glover, Christina Koch, and Jeremy Hansen
- **Anomaly Log** — Real mission anomalies with OPEN/CLOSED status
- **Spacecraft Systems Monitor** — GO/CAUTION/FAULT status for 9 Orion systems
- **Splashdown Monitor** — Live Pacific weather for the splashdown zone
- **Solar Eclipse Countdown** — Crew-perspective eclipse tracker

---

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite 5
- Three.js (WebGL 3D rendering)
- Zustand + TanStack React Query
- Socket.IO client
- Recharts + Framer Motion

### Backend
- Node.js + TypeScript + Express 4
- Socket.IO (real-time WebSocket updates)
- PostgreSQL via Prisma ORM
- Redis (ioredis) for caching
- Google Gemini 2.5 Flash (AI chat)
- JWT authentication + bcryptjs
- Helmet, rate limiting, CORS

### Infrastructure
- Frontend: Vercel
- Backend + Database + Redis: Railway
- Docker + GitHub Actions CI

---

## External APIs

| API | Purpose |
|-----|---------|
| JPL Horizons (NASA/Caltech) | Live spacecraft position + velocity |
| NASA DONKI | Solar flares, CMEs, geomagnetic storms |
| NASA APOD | Astronomy Picture of the Day |
| NASA DSN Now | Live ground station contact data |
| Spaceflight News API | Artemis news articles |
| Google Gemini 2.5 Flash | AI mission assistant |

---

## Getting Started

### Prerequisites
- Node.js 22+
- PostgreSQL
- Redis
- NASA API Key (free at [api.nasa.gov](https://api.nasa.gov))
- Google Gemini API Key (free at [aistudio.google.com](https://aistudio.google.com))

### Clone & Install

```bash
git clone https://github.com/Branavan2004/artemis-intelligence.git
cd artemis-intelligence

# Install backend
cd server && npm install

# Install frontend
cd ../client && npm install
```

### Environment Variables

Create `server/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/artemis
REDIS_URL=redis://localhost:6379
NASA_API_KEY=your_nasa_api_key
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_32_char_secret_here
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:5173
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

### Run Migrations

```bash
cd server
npx prisma migrate deploy
```

### Start Development

```bash
# Backend (from /server)
npm run dev

# Frontend (from /client)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deployment

- **Frontend** → Vercel (root directory: `client`)
- **Backend** → Railway (root directory: `server`)
- **Database** → Railway PostgreSQL
- **Cache** → Railway Redis

---

## Security

- JWT authentication with timing-safe login
- Zod environment validation at startup
- 3-tier rate limiting (auth / chat / general)
- Helmet security headers
- PostgreSQL Row-Level Security on sensitive tables
- CORS locked to allowed origins
- 100KB body size cap
- No stack traces exposed to client in production

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Main mission control dashboard |
| `/replay` | Immersive 3D mission replay with timeline scrubber |
| `/news` | Latest Artemis news from Spaceflight News API |
| `/crew` | Crew profiles — Wiseman, Glover, Koch, Hansen |

---

## Note on Mission Status

Artemis II launched in April 2026. After splashdown, live telemetry feeds from JPL Horizons and NASA DSN will no longer update. The dashboard will fall back to the last recorded mission snapshot, and the `/replay` page will serve as the primary feature — showing the complete recorded trajectory of humanity's return to cislunar space.

---

## Disclaimer

This is an independent project and is not affiliated with, endorsed by, or connected to NASA or any government agency. All data is sourced from publicly available NASA APIs.

---

## Author

Built by [Branavan](https://github.com/Branavan2004) — passionate about space, real-time systems, and making NASA data accessible to everyone.

---

*"We choose to go to the Moon not because it is easy, but because it is hard." — JFK*

*Artemis II — humanity's return to cislunar space, April 2026.*
