import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Event, { CATEGORIES, TONES } from '../models/Event.js';
import Ticket from '../models/Ticket.js';
import { auth, optionalAuth, organizerOnly } from '../middleware/auth.js';
import { error, normalizeQr, validate, wrap } from '../utils/helpers.js';

const router = express.Router();
const eventSchema = z.object({
  title: z.string().trim().min(4).max(110),
  description: z.string().trim().min(15).max(4000),
  category: z.enum(CATEGORIES),
  venue: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  capacity: z.coerce.number().int().min(1).max(100000),
  tone: z.enum(TONES).default('violet'),
});
const ensureId = (id) => { if (!mongoose.isValidObjectId(id)) throw error(400, 'Invalid event ID.'); };
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ownsEvent = wrap(async (req, _res, next) => {
  ensureId(req.params.id);
  const event = await Event.findById(req.params.id);
  if (!event) throw error(404, 'Event not found.');
  if (event.organizer.toString() !== req.user._id.toString()) throw error(403, 'You can manage only your events.');
  req.event = event;
  next();
});

router.get('/', wrap(async (req, res) => {
  const page = Math.max(1, Math.min(500, parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(30, parseInt(req.query.limit, 10) || 9));
  const query = { status: 'published' };
  if (req.query.upcoming !== 'false') query.startsAt = { $gte: new Date() };
  if (CATEGORIES.includes(req.query.category)) query.category = req.query.category;
  if (req.query.city && typeof req.query.city === 'string') query.city = new RegExp(escapeRegex(req.query.city.slice(0, 80)), 'i');
  if (req.query.search && typeof req.query.search === 'string') {
    const search = new RegExp(escapeRegex(req.query.search.slice(0, 100)), 'i');
    query.$or = [{ title: search }, { description: search }, { venue: search }, { city: search }];
  }
  const [events, total] = await Promise.all([
    Event.find(query).populate('organizer', 'name').sort({ startsAt: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Event.countDocuments(query),
  ]);
  res.json({ events, total, page, pages: Math.ceil(total / limit) });
}));

router.get('/mine', auth, organizerOnly, wrap(async (req, res) => {
  const events = await Event.find({ organizer: req.user._id }).sort({ startsAt: 1 }).lean();
  const ids = events.map(event => event._id);
  const counts = await Ticket.aggregate([
    { $match: { event: { $in: ids } } },
    { $group: { _id: '$event', checkIns: { $sum: { $cond: [{ $eq: ['$status', 'checked_in'] }, 1, 0] } } } },
  ]);
  const map = new Map(counts.map(item => [item._id.toString(), item.checkIns]));
  res.json({ events: events.map(event => ({ ...event, checkIns: map.get(event._id.toString()) || 0 })) });
}));

router.get('/:id', optionalAuth, wrap(async (req, res) => {
  ensureId(req.params.id);
  const event = await Event.findById(req.params.id).populate('organizer', 'name').lean();
  if (!event) throw error(404, 'Event not found.');
  let myTicket = null;
  if (req.user) myTicket = await Ticket.findOne({ event: event._id, attendee: req.user._id }).select('_id status').lean();
  res.json({ event, myTicket });
}));

router.post('/', auth, organizerOnly, wrap(async (req, res) => {
  const data = validate(eventSchema, req.body);
  if (new Date(data.startsAt) <= new Date()) throw error(400, 'Start time must be in the future.');
  if (new Date(data.endsAt) <= new Date(data.startsAt)) throw error(400, 'End time must be later than start time.');
  const event = await Event.create({ ...data, organizer: req.user._id });
  res.status(201).json({ event });
}));

router.patch('/:id', auth, organizerOnly, ownsEvent, wrap(async (req, res) => {
  const data = validate(eventSchema.partial(), req.body);
  const current = req.event;
  const start = new Date(data.startsAt || current.startsAt);
  const end = new Date(data.endsAt || current.endsAt);
  if (start <= new Date()) throw error(400, 'Start time must be in the future.');
  if (end <= start) throw error(400, 'End time must be later than start time.');
  if (data.capacity !== undefined && data.capacity < current.registeredCount) throw error(400, 'Capacity cannot be smaller than existing registrations.');
  Object.assign(current, data);
  await current.save();
  res.json({ event: current });
}));

router.delete('/:id', auth, organizerOnly, ownsEvent, wrap(async (req, res) => {
  if (req.event.status === 'cancelled') return res.json({ message: 'Event was already cancelled.' });
  req.event.status = 'cancelled';
  await req.event.save();
  res.json({ message: 'Event cancelled. Existing tickets remain visible as cancelled.' });
}));

router.get('/:id/attendees', auth, organizerOnly, ownsEvent, wrap(async (req, res) => {
  const tickets = await Ticket.find({ event: req.event._id }).select('+qrToken').populate('attendee', 'name email').sort({ createdAt: -1 }).lean();
  res.json({ attendees: tickets, event: req.event });
}));

router.post('/:id/checkin', auth, organizerOnly, ownsEvent, wrap(async (req, res) => {
  if (req.event.status !== 'published') throw error(400, 'Cannot check in guests to a cancelled event.');
  const qrToken = normalizeQr(req.body?.qrCode);
  if (!/^[0-9a-f]{48}$/.test(qrToken)) throw error(400, 'Invalid QR code format.');
  const updated = await Ticket.findOneAndUpdate(
    { event: req.event._id, qrToken, status: 'registered' },
    { $set: { status: 'checked_in', checkedInAt: new Date() } },
    { new: true },
  ).populate('attendee', 'name email');
  if (updated) return res.json({ message: `${updated.attendee.name} checked in successfully.`, ticket: updated });
  const existing = await Ticket.findOne({ event: req.event._id, qrToken });
  if (existing) throw error(409, 'This ticket has already been checked in.');
  throw error(404, 'No valid ticket found for this event.');
}));

export default router;
