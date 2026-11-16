import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';
import { error, makeJwt, validate, wrap } from '../utils/helpers.js';

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
const credentials = z.object({ email: z.string().email().max(255).transform(s => s.toLowerCase()), password: z.string().min(8).max(128) });
const registerSchema = credentials.extend({
  name: z.string().trim().min(2).max(80),
  role: z.enum(['attendee', 'organizer']).default('attendee'),
});

router.post('/register', limiter, wrap(async (req, res) => {
  const data = validate(registerSchema, req.body);
  if (await User.exists({ email: data.email })) throw error(409, 'Email already in use.');
  try {
    const user = await User.create(data);
    res.status(201).json({ user: user.safe(), token: makeJwt(user._id) });
  } catch (err) { if (err.code === 11000) throw error(409, 'Email already in use.'); throw err; }
}));

router.post('/login', limiter, wrap(async (req, res) => {
  const { email, password } = validate(credentials, req.body);
  const user = await User.findOne({ email }).select('+password');
  if (!user || !await user.comparePassword(password)) throw error(401, 'Invalid email or password.');
  res.json({ user: user.safe(), token: makeJwt(user._id) });
}));

router.get('/me', auth, (req, res) => res.json({ user: req.user.safe() }));
export default router;
