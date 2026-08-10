/**
 * Shared visual constants for the course-player lesson renderer, matching the
 * marketing website's (xr2train-web) actual current design language.
 *
 * Every element in src/components/player/elements/* should import LMS_THEME
 * for color/typography instead of reading template?.branding or hand-rolling
 * its own defaults — per-course branding overrides are intentionally ignored
 * for visual properties so every lesson renders consistently. Structural
 * fields (layout_config.bullet_align, image_fit, etc.) are unrelated to this
 * file and keep being read from content/template as before.
 *
 * Sizes use px/vw only (no rem) because globals.css sets `html { font-size: 85% }`
 * for this app only — a rem-based clamp() would render ~15% smaller here than
 * on the website, which has no such rule.
 */

export const LMS_THEME = {
  colors: {
    heading: '#0b3a5d',
    headingOnDark: '#FFFFFF',
    body: '#64748b',
    bodyStrong: '#475569',
    accent: '#2563EB',
    // A toned-down blue for accent text sitting directly on the dark panel
    // background — the full accent reads as too vivid/glowing there, but
    // still needs to stay light enough to read clearly against near-black.
    accentMuted: '#7C93C9',
    darkPanel: '#0B1120',
    success: '#10B981',
    danger: '#EF4444',
    calloutBg: '#f8fafc',
    lightTint: '#f1f5f9',
    imageFrameBorder: '#f1f5f9',
  },
  type: {
    h1: {
      fontSize: 'clamp(40px, 6vw, 72px)',
      fontWeight: 900,
      textTransform: 'uppercase' as const,
      letterSpacing: '-0.04em',
      lineHeight: 0.95,
      fontStyle: 'normal' as const,
    },
    h2: {
      fontSize: 'clamp(32px, 4vw, 48px)',
      fontWeight: 900,
      textTransform: 'uppercase' as const,
      letterSpacing: '-0.03em',
      lineHeight: 0.95,
      fontStyle: 'normal' as const,
    },
    h3: {
      fontSize: '24px',
      fontWeight: 900,
      textTransform: 'uppercase' as const,
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
      fontStyle: 'normal' as const,
    },
    body: {
      fontSize: '16px',
      fontWeight: 500,
      fontStyle: 'normal' as const,
    },
    label: {
      fontSize: '10px',
      fontWeight: 900,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.3em',
      fontStyle: 'normal' as const,
    },
    // The "you passed / well done / correct" result-screen header used by
    // every interactive block (quiz, sorting, fill-blanks, simulations,
    // closeout) — h2's weight/case/tracking at h3's more compact size.
    resultHeader: {
      fontSize: '24px',
      fontWeight: 900,
      textTransform: 'uppercase' as const,
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
      fontStyle: 'normal' as const,
    },
    // The emphasised "pull quote" treatment (slide/card quotes, hotspot
    // callouts, fill-blanks reveal, quiz feedback) — one consistent size
    // instead of each block picking its own.
    quote: {
      fontSize: '24px',
      fontWeight: 500,
      fontStyle: 'italic' as const,
    },
  },
  callout: {
    background: '#f8fafc',
    borderLeftWidth: '16px',
    borderLeftStyle: 'solid' as const,
    borderLeftColor: '#0b3a5d',
  },
  layout: {
    // Single canonical content width for the lesson renderer. Previously every
    // element wrapped itself in its own `max-w-[1400px]` (and CoursePlayer's
    // outer wrapper used the non-existent Tailwind class `max-w-8xl`, a no-op)
    // so nothing was actually constraining width consistently — content read
    // as too wide and misaligned between step types. 1024px matches the
    // max-w-5xl already used for prose/callout content in this app and in
    // the website's TextContent callout.
    contentWidth: 'max-w-5xl',
  },
  classes: {
    // Matches the website's TextContent.tsx image container: thin border,
    // shadow, no grayscale filter (the LMS's prior chunky white-frame +
    // grayscale-hover treatment is being retired for visual consistency).
    imageFrame: 'relative overflow-hidden shadow-2xl border border-slate-100',
    resultCard: 'p-16 border-l-[16px] shadow-xl',
  },
} as const;

/**
 * Text/image column fractions for a given ratio preset (Text/Welcome/Closeout's
 * split sections), swapped when the text column is on the right so "wideText"
 * always means the text column gets the larger share regardless of which
 * physical grid track it lands in. Pair with a `lg:grid-cols-[var(--split)]`
 * className and `style={{ '--split': getGridTemplate(...) }}` — Tailwind's
 * arbitrary-value class is static so it still generates at build time, only
 * the CSS variable's value is dynamic.
 */
export function getGridTemplate(ratio: string | undefined, alignRight: boolean): string {
  const fractions: Record<string, [string, string]> = {
    wideText: ['1.4fr', '0.6fr'],
    balanced: ['1fr', '1fr'],
    wideImage: ['0.6fr', '1.4fr'],
  };
  const [a, b] = fractions[ratio || 'balanced'] || fractions.balanced;
  return alignRight ? `${b} ${a}` : `${a} ${b}`;
}

/**
 * The gap between major sections on Welcome/Closeout (briefing, outcomes,
 * assessment, pathway, etc.) — was a hardcoded `space-y-32`; 'relaxed' keeps
 * that exact value as the default so existing content renders unchanged.
 * Literal object (not string interpolation) so Tailwind's static analysis
 * picks up all three classes at build time.
 */
export const LAYER_GAP_CLASS: Record<string, string> = {
  compact: 'space-y-16',
  standard: 'space-y-24',
  relaxed: 'space-y-32',
};
