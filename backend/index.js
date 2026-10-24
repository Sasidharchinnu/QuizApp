import 'dotenv/config'; // must be first so every module sees the env variables
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import studentRouter from './routes/studentRoutes.js';
import teacherRouter from './routes/teacherRoutes.js';

import { swaggerUi, swaggerSpec } from './swagger/swagger.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Needed on Render / behind nginx so req.secure reflects the original HTTPS request
app.set('trust proxy', 1);

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3001',
  'https://quizapp-frontend-8z3w.onrender.com',
  ...(process.env.CLIENT_URLS || '').split(',').map(s => s.trim()).filter(Boolean),
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Swagger UI route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRouter);
app.use('/api/teacher', teacherRouter);

// Unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found' }));

// Central error handler (e.g. invalid JSON body)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 400).json({ error: err.message || 'Something went wrong' });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`API docs at http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
