# Artemis Intelligence

Artemis Intelligence is a full-stack real-time mission control dashboard for monitoring Artemis II mission telemetry. It features a Node.js/Express backend, Socket.IO WebSocket server, PostgreSQL database, Redis caching, and a React 18/Three.js frontend.

## 🚀 Choreo Deployment (Backend)

The backend service is configured for deployment on **Choreo**.

### Connecting to Choreo
1. Log in to the [Choreo Console](https://console.choreo.dev/).
2. Create a new **Project**.
3. Create a new **Service** component.
4. Connect your GitHub repository and select the root directory (or use the Dockerfile in `server/`).
5. Choreo will detect the configuration in `.choreo/` and `server/Dockerfile`.

### Endpoints
The backend exposes two separate endpoints in Choreo:
- **REST API**: Exposed at `/api` (Type: REST). Used for authentication, mission data, and general API requests.
- **WebSocket**: Exposed at `/socket.io` (Type: WS). Used for real-time mission updates and telemetry streams.

### Environment Variables
Configure the following environment variables in the Choreo component settings:
- `NODE_ENV`: Set to `production`.
- `PORT`: Set to `4000`.
- `DATABASE_URL`: Connection string for the managed PostgreSQL service.
- `REDIS_URL`: Connection string for the managed Redis service.
- `JWT_SECRET`: A strong random secret for token signing.
- `NASA_API_KEY`: Your NASA Open API key.
- `ANTHROPIC_API_KEY`: (Optional) For AI mission analysis.
- `GEMINI_API_KEY`: (Optional) For AI mission analysis.
- `CLIENT_URL`: The URL of your deployed frontend (e.g., Vercel URL).

### Managed Services
For production reliability, add the following as **Managed Services** in your Choreo project:
- **PostgreSQL**: Used for user accounts and mission history.
- **Redis**: Used for rate limiting and real-time state management.

---

## 🛠 Tech Stack
- **Frontend**: React 18, TypeScript, Three.js, Tailwind CSS, Vite.
- **Backend**: Node.js, Express, Socket.IO, Prisma ORM.
- **Database**: PostgreSQL, Redis.
- **Authentication**: JWT.

---

## 📡 WSO2 Streaming Integrator

Artemis Intelligence leverages **WSO2 Streaming Integrator** for real-time complex event processing (CEP). This models our telemetry pipeline as a formal event-driven integration.

- **Siddhi Pipeline**: Located in `streaming-integrator/telemetry-stream.siddhi`.
- **Key Features**:
  - Real-time anomaly detection for system faults.
  - 5-minute sliding window aggregates for velocity and distance.
  - Seamless integration with the existing backend via HTTP hooks.

Refer to the [Streaming Integrator README](streaming-integrator/README.md) for detailed configuration and setup instructions.
