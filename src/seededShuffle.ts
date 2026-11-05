/**
 * Deterministic, seeded shuffle shared by every interactive element that
 * needs to randomise authored order without letting a learner memorise "it
 * was always the third one" -- and without breaking anything that depends
 * on knowing an item's ORIGINAL position (e.g. quiz marking by
 * correctIndex). Stable within one attempt (same seed in -> same order
 * out), different across retries (the caller changes the seed's attempt
 * counter).
 *
 * Used by SortingElement today; the quiz-answer-position-bias work will
 * import this same module rather than duplicating it.
 */

// mulberry32: a small, fast, good-enough (not cryptographic) seeded PRNG.
// Deterministic for a given 32-bit seed, which is all this needs.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a: turns an arbitrary string seed (enrollment id + step id + ... )
// into the 32-bit integer mulberry32 needs. Deterministic, good enough
// distribution for this -- not a security context.
export function hashStringToSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Builds the seed string this project's convention expects: enrollment +
 * step (+ optional question/sub-item) + attempt counter, falling back
 * gracefully when a piece isn't available (e.g. no enrollment in the
 * builder preview/simulator). */
export function buildSeedKey(parts: {
  enrollmentId?: string | null;
  stepId: string;
  questionId?: string | null;
  attempt?: number;
}): string {
  const enrollment = parts.enrollmentId || 'preview';
  const question = parts.questionId ? `:${parts.questionId}` : '';
  const attempt = parts.attempt ?? 0;
  return `${enrollment}:${parts.stepId}${question}:${attempt}`;
}

/** Fisher-Yates, driven by the seeded PRNG -- an unbiased permutation,
 * unlike `.sort(() => Math.random() - 0.5)` (which this replaces). Returns
 * a new array; the input is never mutated. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const result = items.slice();
  const rand = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Convenience: shuffle directly from the seed-key parts, in one call. */
export function seededShuffleBySeedKey<T>(items: T[], seedParts: Parameters<typeof buildSeedKey>[0]): T[] {
  return seededShuffle(items, hashStringToSeed(buildSeedKey(seedParts)));
}
