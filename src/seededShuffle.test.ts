import { describe, it, expect } from 'vitest';
import { seededShuffle, hashStringToSeed, buildSeedKey, seededShuffleBySeedKey } from './seededShuffle';

describe('hashStringToSeed', () => {
  it('is deterministic for the same input', () => {
    expect(hashStringToSeed('abc')).toBe(hashStringToSeed('abc'));
  });
  it('differs for different input (no trivial collisions on these cases)', () => {
    expect(hashStringToSeed('abc')).not.toBe(hashStringToSeed('abd'));
  });
});

describe('buildSeedKey', () => {
  it('falls back to "preview" when no enrollment id is given', () => {
    expect(buildSeedKey({ stepId: 'step-1', attempt: 0 })).toBe('preview:step-1:0');
  });
  it('includes the question id when given', () => {
    expect(buildSeedKey({ enrollmentId: 'e1', stepId: 's1', questionId: 'q1', attempt: 2 })).toBe('e1:s1:q1:2');
  });
});

describe('seededShuffle', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  it('returns a permutation of the same elements (never loses or duplicates one)', () => {
    const shuffled = seededShuffle(items, 12345);
    expect(shuffled.length).toBe(items.length);
    expect([...shuffled].sort()).toEqual([...items].sort());
  });

  it('does not mutate the input array', () => {
    const copy = [...items];
    seededShuffle(items, 999);
    expect(items).toEqual(copy);
  });

  it('is deterministic: same seed always gives the same order', () => {
    const a = seededShuffle(items, 42);
    const b = seededShuffle(items, 42);
    expect(a).toEqual(b);
  });

  it('gives a different order for a different seed, for this item set', () => {
    const a = seededShuffle(items, 1);
    const b = seededShuffle(items, 2);
    expect(a).not.toEqual(b);
  });

  it('is not the identity function (actually reorders, for this seed)', () => {
    const shuffled = seededShuffle(items, 7);
    expect(shuffled).not.toEqual(items);
  });

  it('handles 0 and 1-length arrays without throwing', () => {
    expect(seededShuffle([], 1)).toEqual([]);
    expect(seededShuffle(['solo'], 1)).toEqual(['solo']);
  });
});

describe('seededShuffleBySeedKey', () => {
  it('two different attempts for the same step produce different orders (retry reshuffles)', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    const attempt0 = seededShuffleBySeedKey(items, { enrollmentId: 'e1', stepId: 's1', attempt: 0 });
    const attempt1 = seededShuffleBySeedKey(items, { enrollmentId: 'e1', stepId: 's1', attempt: 1 });
    expect(attempt0).not.toEqual(attempt1);
  });

  it('the same attempt for the same step is stable (same seed in -> same order out)', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    const first = seededShuffleBySeedKey(items, { enrollmentId: 'e1', stepId: 's1', attempt: 0 });
    const second = seededShuffleBySeedKey(items, { enrollmentId: 'e1', stepId: 's1', attempt: 0 });
    expect(first).toEqual(second);
  });

  it('different learners (different enrollment ids) on the same step can get different orders', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    const learnerA = seededShuffleBySeedKey(items, { enrollmentId: 'learner-a', stepId: 's1', attempt: 0 });
    const learnerB = seededShuffleBySeedKey(items, { enrollmentId: 'learner-b', stepId: 's1', attempt: 0 });
    expect(learnerA).not.toEqual(learnerB);
  });
});
