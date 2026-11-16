import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  attendee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  qrToken: { type: String, required: true, unique: true, select: false },
  status: { type: String, enum: ['registered', 'checked_in'], default: 'registered' },
  checkedInAt: { type: Date, default: null },
}, { timestamps: true });

ticketSchema.index({ event: 1, attendee: 1 }, { unique: true });

export default mongoose.model('Ticket', ticketSchema);
