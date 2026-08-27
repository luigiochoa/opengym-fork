import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInviteCode,
  highestInviteSequence,
  normalizeInvitePrefix,
} from './invite-code.js';

test('normalizes a branded invite prefix', () => {
  assert.equal(normalizeInvitePrefix(' Forta-gym! '), 'FORTAGYM');
});

test('recognizes bootstrap and secure sequential formats', () => {
  const invites = [
    { code: 'FORTA001' },
    { code: 'FORTA-007-ABCDEFGHJK' },
    { code: 'OTHER-999-ABCDEFGHJK' },
  ];
  assert.equal(highestInviteSequence(invites, 'FORTA'), 7);
});

test('creates the next branded code with a secure suffix', () => {
  const result = createInviteCode([{ code: 'FORTA001' }], 'FORTA');
  assert.equal(result.sequence, 2);
  assert.match(result.code, /^FORTA-002-[A-HJ-NP-Z2-9]{10}$/);
});

test('persistent counter prevents reusing a revoked last number', () => {
  const result = createInviteCode([], 'FORTA', 12);
  assert.equal(result.sequence, 13);
  assert.match(result.code, /^FORTA-013-/);
});

test('keeps the original random format when no prefix is configured', () => {
  const result = createInviteCode([], '');
  assert.equal(result.sequence, null);
  assert.match(result.code, /^[A-F0-9]{16}$/);
});

