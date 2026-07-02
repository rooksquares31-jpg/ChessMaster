const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const { getHealth } = require('./controllers/dashboardController');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const homeworkRoutes = require('./routes/homeworkRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const correctionRoutes = require('./routes/correctionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const classroomRoutes = require('./routes/classroomRoutes');

const app = express();

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((url) => url.trim()).filter(Boolean)
  : ['http://localhost:5173'];

const parseHostname = (entry) => {
  try {
    return new URL(entry).hostname;
  } catch {
    return entry.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
};

const allowedHostnames = allowedOrigins.map(parseHostname);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      try {
        const originHostname = new URL(origin).hostname;
        const allowed =
          allowedOrigins.includes(origin) ||
          allowedHostnames.includes(originHostname) ||
          allowedHostnames.some((h) => originHostname === h || originHostname.endsWith('.' + h));
        if (allowed) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      } catch (err) {
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Request logging ───────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ── Health check (no auth required) ──────────────────────────────────────────
app.get('/api/health', getHealth);


// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/corrections', correctionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/classrooms', classroomRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
