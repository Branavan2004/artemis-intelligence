# 🚀 Artemis Intelligence

> Real-time mission control dashboard for NASA's Artemis II — the first crewed cislunar mission since Apollo 17 in 1972.

![Artemis Intelligence Dashboard](https://artemis-intelligence.vercel.app)

🔴 **Live** → [artemis-intelligence.vercel.app](https://artemis-intelligence.vercel.app)

---

## 🌕 What Is This?

Artemis Intelligence is a full-stack real-time mission control dashboard tracking four real astronauts — **Reid Wiseman, Victor Glover, Christina Koch, and Jeremy Hansen** — as they travel 406,000+ km from Earth. Further than any human has been since 1972.

Every number on screen is real. Not seeded. Not mocked. **Live.**

---

## ✨ Features

### 🛰️ Live Telemetry Dashboard
- Real-time spacecraft position, velocity, and distance from Earth
- Mission Elapsed Time (MET) clock ticking every second
- Client-side position interpolation between API calls so numbers are always accurate
- One-way signal delay — actual light-speed communication time to Orion
- Spacecraft systems monitor — GO / CAUTION / FAULT for all 9 Orion systems
- Real mission anomaly log (toilet malfunction, environmental smell — actual reported incidents)
- Current mission phase with progress bar and countdown to next milestone
- Orion porthole view simulating what the crew sees based on real distance

### 📡 Deep Space Network Tracker
- Live map showing which ground station is actively tracking Orion
- Goldstone (California) · Madrid (Spain) · Canberra (Australia)
- Spaced 120° apart so at least one always has line of sight to deep space
- Live XML feed from NASA DSN Now · cached in Redis · refreshed every 8 seconds

### 🌍 Mission Replay (3D WebGL)
- Full 3D Earth and Moon rendered with Three.js / WebGL
- Real trajectory coordinates from JPL Horizons ephemeris data
- Play, pause, scrub through the entire mission timeline
- Playback speed: 1x · 2x · 3x · 4x
- 5 mission phases fully seekable — Launch, Translunar Coast, Lunar Flyby, Return, Splashdown
- 2D SVG fallback for mobile devices where WebGL is not supported

### 👨‍🚀 Crew Profiles
- All four Artemis II astronauts with real bios, mission stats, and photos
- Christina Koch — first woman in cislunar space
- Jeremy Hansen — first Canadian in cislunar space

### 🌤️ Space Weather
- Live solar flare and geomagnetic storm alerts from NASA DONKI
- NASA Astronomy Picture of the Day
- Live spaceflight news feed

### 📊 Mission History (Post-Splashdown)
- Telemetry snapshots collected every 30 minutes throughout the mission
- Full historical record of distance, velocity, and phase over time
- Dashboard falls back to recorded mission data after splashdown with a "Mission Complete" banner

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Three.js / WebGL | 3D trajectory visualization |
| Zustand | Global state management |
| TanStack Query | Server state + caching |
| Socket.IO client | Real-time WebSocket updates |
| Vite | Build tool |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | API server |
| Socket.IO | WebSocket server |
| Prisma ORM | Database access |
| PostgreSQL | Primary database |
| Redis | Caching layer (graceful degradation) |
| JWT + bcrypt | Authentication |
| Helmet | Security headers |
| Rate limiting | API protection |
| node-cron | Telemetry history collection |
| Row-level security | Database security |

### External APIs
| API | Data |
|---|---|
| NASA JPL Horizons | Spacecraft position, velocity, trajectory |
| NASA DSN Now | Deep Space Network ground station status |
| NASA DONKI | Space weather alerts |
| NASA APOD | Astronomy Picture of the Day |
| Spaceflight News API | Live mission news |

### Deployment
| Service | Purpose |
|---|---|
| Railway | Backend + PostgreSQL + Redis |
| Vercel | Frontend |
| GitHub | CI/CD — auto-deploy on push to main |

---

## 🔧 Technical Highlights

**Position Interpolation** — JPL Horizons doesn't update every second. Built a client-side extrapolation system using last known velocity to estimate real-time position between API calls. The MET clock and distance counter are always accurate.

**Real-time WebSocket Architecture** — Socket.IO pushes telemetry updates to all connected clients simultaneously. Multiple browser tabs update in sync.

**Redis Caching Layer** — DSN data cached and refreshed every 8 seconds to avoid hammering NASA's servers. Graceful degradation if Redis goes down — app continues working.

**3D WebGL Trajectory** — Three.js renders real JPL ephemeris coordinates as a bezier arc around Earth and Moon. Mobile fallback serves a 2D SVG version automatically.

**Telemetry History Collection** — node-cron job saves a snapshot to PostgreSQL every 30 minutes throughout the mission, building a complete historical record of the entire Artemis II flight.

**Post-Mission Fallback** — After splashdown, the dashboard serves the last recorded snapshot with a Mission Complete banner. The replay page becomes a permanent interactive archive.

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis (optional — app degrades gracefully)

### Setup

```bash
# Clone the repo
git clone https://github.com/Branavan2004/artemis-intelligence.git
cd artemis-intelligence

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Environment Variables

Create `server/.env`:

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-32-char-secret
NASA_API_KEY=your-nasa-api-key
NODE_ENV=development
PORT=8080
CLIENT_URL=http://localhost:5173
```

Get your free NASA API key at [api.nasa.gov](https://api.nasa.gov)

### Run

```bash
# Run database migrations
cd server
npx prisma migrate deploy

# Start backend (from /server)
npm run dev

# Start frontend (from /client)
npm run dev
```

Frontend → [http://localhost:5173](http://localhost:5173)
Backend → [http://localhost:8080](http://localhost:8080)

---

## 📁 Project Structure

```
artemis-intelligence/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── pages/           # Dashboard, Replay, Crew, News
│   │   ├── services/        # API calls
│   │   └── store/           # Zustand state
│   └── vercel.json
├── server/                  # Node.js backend
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── services/        # JPL, DSN, telemetry services
│   │   ├── middleware/       # Auth, rate limiting
│   │   └── index.ts         # Entry point + cron jobs
│   └── prisma/
│       └── schema.prisma    # Database schema
└── README.md
```

---

## 🌕 About Artemis II

Artemis II is NASA's first crewed mission beyond low Earth orbit since Apollo 17 in 1972. The four-person crew performs a free-return trajectory around the Moon — traveling further from Earth than any human in over 50 years — without landing. It is the proving flight for the Orion spacecraft and Space Launch System before the lunar landing of Artemis III.

**Crew:**
- **Reid Wiseman** — Commander
- **Victor Glover** — Pilot
- **Christina Koch** — Mission Specialist · First woman in cislunar space
- **Jeremy Hansen** — Mission Specialist · First Canadian in cislunar space

---

## 📄 License

MIT License — open source, free to use.

---

<p align="center">Built with 🚀 by <a href="https://github.com/Branavan2004">Branavan</a></p>
<p align="center">
  <a href="https://artemis-intelligence.vercel.app">Live Demo</a> ·
  <a href="https://github.com/Branavan2004/artemis-intelligence/issues">Report Bug</a>
</p>
