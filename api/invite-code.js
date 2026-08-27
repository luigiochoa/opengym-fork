import crypto from 'node:crypto';

// Crockford-like alphabet: avoids ambiguous 0/O and 1/I characters.
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeInvitePrefix(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

export function highestInviteSequence(invites, prefix) {
  if (!prefix) return 0;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Supports the bootstrap/legacy FORTA001 and new FORTA-002-TOKEN formats.
  const pattern = new RegExp(`^${escaped}-?(\\d+)(?:-|$)`);
  return (invites || []).reduce((highest, invite) => {
    const match = pattern.exec(String(invite?.code || '').toUpperCase());
    return match ? Math.max(highest, Number(match[1]) || 0) : highest;
  }, 0);
}

function secureToken(length = 10) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, byte => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join('');
}

export function createInviteCode(invites, rawPrefix, lastSequence = 0) {
  const prefix = normalizeInvitePrefix(rawPrefix);

  // No prefix preserves upstream's original 64-bit random format.
  if (!prefix) {
    let code;
    do {
      code = crypto.randomBytes(8).toString('hex').toUpperCase();
    } while ((invites || []).some(invite => invite.code === code));
    return { code, sequence: null };
  }

  const sequence = Math.max(lastSequence || 0, highestInviteSequence(invites, prefix)) + 1;
  const number = String(sequence).padStart(3, '0');
  let code;
  do {
    code = `${prefix}-${number}-${secureToken()}`;
  } while ((invites || []).some(invite => invite.code === code));

  return { code, sequence };
}

