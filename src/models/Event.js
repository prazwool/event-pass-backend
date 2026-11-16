import mongoose from 'mongoose';

export const CATEGORIES = ['Technology', 'Business', 'Music', 'Arts', 'Community', 'Sports'];
export const TONES = ['violet', 'coral', 'emerald', 'blue', 'amber', 'rose'];

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 110 },
  description: { type: String, required: true, trim: true, maxlength: 4000 },
  category: { type: String, required: true, enum: CATEGORIES },
  venue: { type: String, required: true, trim: true, maxlength: 120 },
  city: { type: String, required: true, trim: true, maxlength: 80 },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 1, max: 100000 },
  registeredCount: { type: Number, default: 0, min: 0 },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['published', 'cancelled'], default: 'published' },
  tone: { type: String, enum: TONES, default: 'violet' },
  seedKey: { type: String, unique: true, sparse: true, select: false },
}, { timestamps: true });

eventSchema.index({ startsAt: 1, status: 1 });

export default mongoose.model('Event', eventSchema);
