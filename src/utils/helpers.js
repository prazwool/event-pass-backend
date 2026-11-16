import jwt from 'jsonwebtoken';

export const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
export const error = (status, message) => Object.assign(new Error(message), { status });
export { ticketToken, normalizeQr } from './qr.js';
export const publicTicket = (ticket) => ({
  id: ticket._id?.toString(), event: ticket.event, attendee: ticket.attendee,
  qrToken: ticket.qrToken, status: ticket.status, checkedInAt: ticket.checkedInAt,
  createdAt: ticket.createdAt,
});
export const makeJwt = (userId) => jwt.sign({ sub: userId.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
export const validate = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw error(400, `${first.path.join('.') || 'Request'}: ${first.message}`);
  }
  return result.data;
};
