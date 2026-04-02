cat > README.md << 'DONE'
# 🚀 Artemis Intelligence

An AI-powered real-time mission tracking platform for NASA's Artemis II — humanity's first crewed lunar mission since Apollo 17 in 1972.

Built as a full-stack project to demonstrate modern web development skills.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18-blue)
![Node.js](https://img.shields.io/badge/Node.js-20-green)

## ✨ Features

- 🤖 **AI Mission Assistant** — Claude-powered chatbot with streaming responses
- 📡 **Live Mission Dashboard** — Real-time mission phase tracking via WebSockets
- 📰 **AI News Aggregator** — Space news with AI-generated summaries
- 🧑‍🚀 **Crew Profiles** — Interactive astronaut cards with mission records
- 🔐 **User Auth** — JWT authentication with personal saved articles
- 🌍 **NASA API Integration** — Live imagery and mission data

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express, TypeScript |
| AI | Anthropic Claude API (streaming) |
| Real-time | Socket.io WebSockets |
| Database | PostgreSQL + Prisma ORM |
| Caching | Redis |
| Deployment | Railway + Vercel |

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis

### Installation
```bash
# Clone the repo
git clone https://github.com/Branavan2004/artemis-intelligence.git
cd artemis-intelligence

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### Environment Setup
```bash
# Server
cp server/.env.example server/.env
# Add your API keys to server/.env
```

Required keys:
- `NASA_API_KEY` — free at [api.nasa.gov](https://api.nasa.gov)
- `ANTHROPIC_API_KEY` — at [console.anthropic.com](https://console.anthropic.com)

### Database Setup
```bash
cd server
npx prisma migrate dev
```

### Run Locally
```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## 📁 Project Structure
```
artemis-intelligence/
├── client/          # React + TypeScript frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── services/
├── server/          # Node.js + Express backend
│   └── src/
│       ├── routes/
│       ├── middleware/
│       ├── services/
│       └── prisma/
└── docker-compose.yml
```

## 🌍 Deployment

This project is deployed using:
- **Backend** → Railway
- **Frontend** → Vercel

## 📄 License

MIT © Branavan 2026
DONE
