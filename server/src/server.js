import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, getDBStatus } from './config/db.js';

// Route imports
import camerasRouter from './routes/cameras.js';
import detectionsRouter from './routes/detections.js';
import vehiclesRouter from './routes/vehicles.js';
import blacklistRouter from './routes/blacklist.js';
import alertsRouter from './routes/alerts.js';
import commandCenterRouter from './routes/commandCenter.js';
import analyticsRouter from './routes/analytics.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

// Pass io instance to app
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static directory for uploaded images/videos
const uploadsDir = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// System Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'City-Wide ANPR Engine & Traffic Analytics',
    version: '1.0.0',
    db: getDBStatus(),
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mount Core API Routes
app.use('/api/cameras', camerasRouter);
app.use('/api/detections', detectionsRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/blacklist', blacklistRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/command-center', commandCenterRouter);
app.use('/api/analytics', analyticsRouter);




// Socket.IO event handling
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  
  socket.emit('system:status', {
    status: 'CONNECTED',
    serverTime: new Date().toISOString(),
    db: getDBStatus()
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`=======================================================`);
  console.log(` ANPR & Traffic Intelligence Engine - Node.js Server `);
  console.log(` Running on port: http://localhost:${PORT}`);
  console.log(` Health Check   : http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);
  await connectDB();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Server] Port ${PORT} busy, retrying in 1s...`);
    setTimeout(() => {
      server.close();
      server.listen(PORT, '0.0.0.0');
    }, 1000);
  } else {
    console.error('[Server Error]', err);
  }
});

export { app, server, io };
