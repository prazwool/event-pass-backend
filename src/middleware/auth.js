import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { error, wrap } from '../utils/helpers.js';

export const auth = wrap(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw error(401, 'Please sign in to continue.');
  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_SECRET); }
  catch { throw error(401, 'Your session has expired. Please sign in again.'); }
  req.user = await User.findById(decoded.sub);
  if (!req.user) throw error(401, 'Account was not found.');
  next();
});

export const optionalAuth = wrap(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      req.user = await User.findById(decoded.sub);
    } catch { /* Guest access still allowed */ }
  }
  next();
});

export const organizerOnly = (req, _res, next) => {
  if (req.user?.role !== 'organizer') return next(error(403, 'Organizer access required.'));
  next();
};
