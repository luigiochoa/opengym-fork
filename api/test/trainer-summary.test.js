import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPupilSummaryReader, summarizePupil, weekStart } from '../trainer-summary.js';
test('compact summary follows the current week and ignores malformed workouts', () => {
  assert.equal(weekStart('2026-11-01'), '2026-10-26');
  const summary = summarizePupil({ workouts: [null, { d: '2026-10-26', entries: [] }, { d: '2026-10-26', entries: [] }, { d: '2026-10-25', entries: [] }, { d: '2026-10-27', entries: [] }] }, Symbol(), '2026-10-26');
  assert.equal(summary.workouts, 4); assert.equal(summary.completedDays, 1);
});
test('cache avoids rereading history and invalidation handles writes with unchanged stat values', () => {
  let reads = 0, count = 1, stamp = 1;
  const reader = createPupilSummaryReader({ stat: () => ({ mtimeMs: stamp, ctimeMs: stamp, size: 100, ino: 1 }), readState: () => { reads++; return { workouts: Array.from({ length: count }, () => ({ d: '2026-10-26', entries: [] })) }; }, unreadable: Symbol() });
  assert.equal(reader('pupil', '2026-10-26').workouts, 1);
  reader('pupil', '2026-10-26'); assert.equal(reads, 1);
  count = 2; reader.invalidate('pupil'); assert.equal(reader('pupil', '2026-10-26').workouts, 2);
  count = 3; stamp++; assert.equal(reader('pupil', '2026-10-26').workouts, 3);
  reader('pupil', '2026-10-27'); assert.equal(reads, 4);
});
test('summary preserves unreadable state and bounds the cache', () => {
  const bad = Symbol(); let reads = 0;
  const reader = createPupilSummaryReader({ stat: () => ({ mtimeMs: 1, size: 1 }), readState: () => { reads++; return bad; }, unreadable: bad, max: 1 });
  assert.equal(reader('a', '2026-10-26').unavailable, true);
  reader('b', '2026-10-26'); reader('a', '2026-10-26'); assert.equal(reads, 3);
});
