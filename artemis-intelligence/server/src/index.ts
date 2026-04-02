import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth';
import { missionRouter } from './routes/mission';
import { newsRouter } from './routes/news';
import { chatRouter } from './routes/chat';
import { errorHandler } from './middleware/errorHandler';
import { initRedis } from './services/redis';

dotenv.config();

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), mission: 'Artemis II 🚀' });
});

app.use('/api/auth', authRouter);
app.use('/api/mission', missionRouter);
app.use('/api/news', newsRouter);
app.use('/api/chat', chatRouter);

app.use(errorHandler);

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('subscribe:mission', () => {
    socket.join('mission-updates');
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

function getMissionElapsedTime(): string {
  const launchDate = new Date('2026-04-01T22:24:00Z');
  const now = new Date();
  const diff = now.getTime() - launchDate.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `T+${hours}h ${minutes}m`;
}

function getCurrentMissionPhase(): string {
  const launchDate = new Date('2026-04-01T22:24:00Z');
  const now = new Date();
  const hoursElapsed = (now.getTime() - launchDate.getTime()) / (1000 * 60 * 60);

  if (hoursElapsed < 0) return 'Pre-Launch';
  if (hoursElapsed < 24) return 'Earth Orbit & Systems Check';
  if (hoursElapsed < 72) return 'Translunar Injection';
  if (hoursElapsed < 96) return 'Lunar Flyby';
  if (hoursElapsed < 216) return 'Return Trajectory';
  return 'Reentry & Splashdown';
}

setInterval(() => {
  io.to('mission-updates').emit('mission:update', {
    timestamp: new Date().toISOString(),
    missionElapsedTime: getMissionElapsedTime(),
    phase: getCurrentMissionPhase(),
  });
}, 30000);

const PORT = process.env.PORT || 4000;

async function main() {
  await initRedis();
  httpServer.listen(PORT, () => {
    console.log(`🚀 Artemis Intelligence Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

main().catch(console.error);
