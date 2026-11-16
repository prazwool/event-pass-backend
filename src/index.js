import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import ticketRoutes from './routes/tickets.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('Set JWT_SECRET in backend/.env to at least 32 characters.');
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error('Set MONGO_URI in backend/.env.');
  process.exit(1);
}
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()) }));
app.use(express.json({ limit: '128kb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'eventpass', time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api', (_req, res) => res.status(404).json({ message: 'API route not found.' }));
app.use((err, _req, res, _next) => {
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier.' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
  if (err.code === 11000) return res.status(409).json({ message: 'An existing record conflicts with this request.' });
  if (err.status >= 500 || !err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Something went wrong. Please try again.' });
});

const port = Number(process.env.PORT || 5000);
mongoose.connect(process.env.MONGO_URI).then(() => {
  app.listen(port, () => console.log(`EventPass API running at http://localhost:${port}`));
}).catch(err => {
  console.error('MongoDB connection failed:', err.message);
  process.exit(1);
});
