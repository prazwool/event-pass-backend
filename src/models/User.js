import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['attendee', 'organizer'], default: 'attendee' },
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (password) { return bcrypt.compare(password, this.password); };
userSchema.methods.safe = function () {
  return { id: this._id.toString(), name: this.name, email: this.email, role: this.role };
};

export default mongoose.model('User', userSchema);
