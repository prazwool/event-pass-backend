import crypto from 'node:crypto';

export const ticketToken = () => crypto.randomBytes(24).toString('hex');
export const normalizeQr = (raw) => String(raw ?? '').trim().replace(/^EVENTPASS:/i, '').trim();
