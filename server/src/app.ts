import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import mongoose from 'mongoose';
import { errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/auth.js';
import { eventRoutes } from './routes/events.js';
import { registrationRoutes } from './routes/registrations.js';
import { organizerRoutes } from './routes/organizers.js';
import { adminRoutes } from './routes/admin.js';
import { statisticsRoutes } from './routes/statistics.js';
import { reportRoutes } from './routes/reports.js';
import './observers/StatisticsObserver.js';

export const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});
const app = express();
export { app };
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', limiter);

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
});
app.use('/api/events', writeLimiter);
app.use('/api/registrations', writeLimiter);
app.use('/api/organizers', writeLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/organizers', organizerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

async function start() {
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
    process.exitCode = 1;
  });

  try {
    await prisma.$connect();
    console.log('Connected to PostgreSQL');
  } catch (e) {
    console.error('PostgreSQL connection failed:', (e as Error).message);
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/uniplan');
    console.log('Connected to MongoDB');
  } catch (e) {
    console.warn('MongoDB auth failed, trying without credentials...');
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/uniplan';
    const noAuthUri = uri.replace(/\/\/[^@]+@/, '//');
    try {
      await mongoose.connect(noAuthUri);
      console.log('Connected to MongoDB (unauthenticated)');
    } catch (e2) {
      console.error('MongoDB connection failed:', (e2 as Error).message);
      process.exit(1);
    }
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

const isTestMode = process.env.NODE_ENV === 'test' || process.argv.includes('--test');
if (!isTestMode) {
  start().catch(console.error);
}
