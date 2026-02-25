const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes          = require('./routes/auth');
const medicineRoutes      = require('./routes/medicines');
const doseLogRoutes       = require('./routes/doseLogs');
const aiRoutes            = require('./routes/ai');
const notificationsRoutes = require('./routes/notifications');

const app = express();

const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL]
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5000'
    ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); 

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));

app.use(express.json());

app.use('/api/auth',          authRoutes);
app.use('/api/medicines',     medicineRoutes);
app.use('/api/dose-logs',     doseLogRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/notifications', notificationsRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  try {
    const uri =
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/medicine-companion';

    await mongoose.connect(uri);

    isConnected = true;
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('MongoDB error:', err.message);
  }
}

connectDB();

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;

  try {
    const cron = require('node-cron');
    const {
      checkMissedDoses,
      checkRefills
    } = require('./utils/scheduler');

    cron.schedule('*/5 * * * *', () => {
      console.log('Running missed dose check...');
      checkMissedDoses();
      checkRefills();
    });

    console.log('⏰ Scheduler running');
  } catch (err) {
    console.warn('Scheduler skipped:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`🚀 http://localhost:${PORT}`);
  });
}

module.exports = app;