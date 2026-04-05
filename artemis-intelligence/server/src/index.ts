import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Load .env before importing anything that reads process.env
dotenv.config();

// Validate environment at startup — throws if any required secret is missing/weak
import { env } from './config/env';

import { authRouter } from './routes/auth';
import { missionRouter } from './routes/mission';
import { newsRouter } from './routes/news';
import { chatRouter } from './routes/chat';
import { telemetryRoutes } from './routes/telemetry';
import dsnRoutes from './routes/dsn';
import splashdownWeatherRoutes from './routes/splashdownWeather';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter, chatLimiter } from './middleware/rateLimiter';
import { initRedis } from './services/redis';
import { getMissionUpdate } from './constants/mission';

const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
  env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter((origin): origin is string => Boolean(origin));

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

export const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin ?? 'unknown'} not allowed by Socket.IO CORS`));
    },
    methods: ['GET', 'POST'],
  },
});

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin ?? 'unknown'} not allowed by CORS`));
    },
    credentials: true,
  }),
);

// ── Logging ────────────────────────────────────────────────────────────────────
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Body parsing with size limits (guards against payload-based DoS) ──────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));

// ── Health check (no rate limit — used by load balancers) ─────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), mission: 'Artemis II 🚀' });
});

// ── API routes ─────────────────────────────────────────────────────────────────
// Auth routes have their own authLimiter (applied inside authRouter)
app.use('/api/auth', authRouter);

// Chat stream gets its own stricter limiter
app.use('/api/chat', chatLimiter, chatRouter);

// All remaining API routes share the general limiter
app.use('/api/mission', generalLimiter, missionRouter);
app.use('/api/news', generalLimiter, newsRouter);
app.use('/api/telemetry', generalLimiter, telemetryRoutes);
app.use('/api/dsn', generalLimiter, dsnRoutes);
app.use('/api/splashdown-weather', generalLimiter, splashdownWeatherRoutes);

// ── Error handler (must be last) ───────────────────────────────────────────────
app.use(errorHandler);

// ── WebSocket ──────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('subscribe:mission', () => {
    socket.join('mission-updates');
    socket.emit('mission:update', getMissionUpdate());
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

setInterval(() => {
  io.to('mission-updates').emit('mission:update', getMissionUpdate());
}, 30000);

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = env.PORT;

async function main() {
  await initRedis();
  httpServer.listen(PORT, () => {
    console.log(`🚀 Artemis Intelligence Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🌍 Environment: ${env.NODE_ENV}`);
  });
}

main().catch(console.error);
