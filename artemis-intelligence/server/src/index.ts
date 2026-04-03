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
import { getMissionUpdate } from './constants/mission';

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
    socket.emit('mission:update', getMissionUpdate());
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

setInterval(() => {
  io.to('mission-updates').emit('mission:update', getMissionUpdate());
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
