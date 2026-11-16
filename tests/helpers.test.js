import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQr, ticketToken } from '../src/utils/qr.js';

test('QR normalizer supports scanner prefix and pasted raw codes', () => {
  assert.equal(normalizeQr(' EVENTPASS:abc123 '), 'abc123');
  assert.equal(normalizeQr('abc123'), 'abc123');
});

test('ticket tokens are random 48-character lowercase hexadecimal strings', () => {
  const a = ticketToken();
  const b = ticketToken();
  assert.match(a, /^[0-9a-f]{48}$/);
  assert.notEqual(a, b);
});
