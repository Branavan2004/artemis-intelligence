// DIAGNOSTIC - remove after debugging
process.stdout.write('PROCESS STARTED\n');

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

// ── Startup Diagnostics ───────────────────────────────────────────────────────
console.log('🚀 Artemis Intelligence Server starting...', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  PWD: process.cwd(),
});

const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
  'https://artemis-intelligence.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  env.CLIENT_URL,
].filter((origin): origin is string => Boolean(origin));

export const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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

// Wrap entire startup in try/catch to ensure hidden validation/init errors are logged
try {
  main().catch((err) => {
    console.error('SERVER STARTUP ERROR (Async):', err);
    process.exit(1);
  });
} catch (err) {
  console.error('SERVER STARTUP ERROR (Sync):', err);
  process.exit(1);
}
