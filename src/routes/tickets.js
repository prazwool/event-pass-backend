import express from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event.js';
import Ticket from '../models/Ticket.js';
import { auth } from '../middleware/auth.js';
import { error, ticketToken, wrap } from '../utils/helpers.js';

const router = express.Router();
router.use(auth);

router.get('/mine', wrap(async (req, res) => {
  const tickets = await Ticket.find({ attendee: req.user._id }).select('+qrToken').populate({ path: 'event', select: 'title category city venue startsAt endsAt tone status organizer' }).sort({ createdAt: -1 }).lean();
  res.json({ tickets });
}));

router.get('/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw error(400, 'Invalid ticket ID.');
  const ticket = await Ticket.findOne({ _id: req.params.id, attendee: req.user._id }).select('+qrToken').populate('event').lean();
  if (!ticket) throw error(404, 'Ticket not found.');
  res.json({ ticket });
}));

router.delete('/:id', wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw error(400, 'Invalid ticket ID.');
  const ticket = await Ticket.findOne({ _id: req.params.id, attendee: req.user._id });
  if (!ticket) throw error(404, 'Ticket not found.');
  if (ticket.status === 'checked_in') throw error(409, 'Checked-in tickets cannot be cancelled.');
  const event = await Event.findById(ticket.event);
  if (event && event.startsAt <= new Date()) throw error(409, 'Registration cannot be cancelled after the event begins.');
  const deleted = await Ticket.findOneAndDelete({ _id: ticket._id, status: 'registered' });
  if (!deleted) throw error(409, 'Ticket was already checked in.');
  await Event.updateOne({ _id: ticket.event, registeredCount: { $gt: 0 } }, { $inc: { registeredCount: -1 } });
  res.json({ message: 'Registration cancelled.' });
}));

router.post('/event/:eventId', wrap(async (req, res) => {
  const { eventId } = req.params;
  if (!mongoose.isValidObjectId(eventId)) throw error(400, 'Invalid event ID.');
  const prior = await Ticket.findOne({ event: eventId, attendee: req.user._id });
  if (prior) throw error(409, 'You are already registered for this event.');
  const event = await Event.findOneAndUpdate(
    {
      _id: eventId, status: 'published', startsAt: { $gt: new Date() },
      $expr: { $lt: ['$registeredCount', '$capacity'] },
    },
    { $inc: { registeredCount: 1 } },
    { new: true },
  );
  if (!event) {
    const existing = await Event.findById(eventId);
    if (!existing) throw error(404, 'Event not found.');
    if (existing.status === 'cancelled') throw error(409, 'This event was cancelled.');
    if (existing.startsAt <= new Date()) throw error(409, 'Registration has closed.');
    throw error(409, 'This event is fully booked.');
  }
  try {
    const ticket = await Ticket.create({ event: eventId, attendee: req.user._id, qrToken: ticketToken() });
    res.status(201).json({ ticket: { ...ticket.toObject(), qrToken: ticket.qrToken } });
  } catch (err) {
    await Event.updateOne({ _id: eventId, registeredCount: { $gt: 0 } }, { $inc: { registeredCount: -1 } });
    if (err.code === 11000) throw error(409, 'You are already registered for this event.');
    throw err;
  }
}));

export default router;
