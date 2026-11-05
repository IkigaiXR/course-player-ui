'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * Heading that shrinks its font until its longest word fits the container.
 *
 * The size from `className`/`style` is the maximum. Big uppercase titles in
 * narrow containers (carousel slide titles, flip-card fronts, and anything
 * on mobile) otherwise either spill past their box or, with break-words,
 * split mid-word ("OVERBURDE / N"). Words are only broken once `minPx` is
 * reached and the word still doesn't fit.
 *
 * Wrapping between words is untouched — only a single word wider than the
 * line triggers a step down, so multi-word titles keep the authored size.
 */
export const FitText = ({
  as: Tag = 'h3',
  text,
  minPx = 16,
  className,
  style,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
  text: string;
  minPx?: number;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState<number | null>(null);
  const [fitKey, setFitKey] = useState(text);
  const [, setRecheck] = useState(0);

  // New text: re-measure from the authored maximum.
  if (fitKey !== text) {
    setFitKey(text);
    setSize(null);
  }

  // Runs after every render, before paint. Each pass only ever shrinks, so it
  // converges in a couple of renders and stops at minPx.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || el.clientWidth === 0 || el.scrollWidth <= el.clientWidth + 1) return;
    const current = parseFloat(getComputedStyle(el).fontSize);
    if (!(current > minPx)) return;
    setSize(Math.max(minPx, Math.floor((current * el.clientWidth) / el.scrollWidth)));
  });

  // Width changes (rotation, sidebar toggles, breakpoints) and the web font
  // arriving both change the fit — start again from the maximum. Any other
  // resize (styles landing late, say) only re-runs the shrink pass if the
  // text now overflows; resetting there would loop on our own size changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let width = el.clientWidth;
    let alive = true;
    // setSize(null) alone is a no-op when nothing has shrunk yet, so also
    // force a render to get the shrink pass to look again.
    const refit = () => { setSize(null); setRecheck(n => n + 1); };
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        refit();
      } else if (el.scrollWidth > el.clientWidth + 1) {
        setRecheck(n => n + 1);
      }
    });
    ro?.observe(el);
    document.fonts?.ready.then(() => { if (alive) refit(); });
    return () => { alive = false; ro?.disconnect(); };
  }, []);

  return (
    <Tag
      ref={ref as any}
      className={className}
      style={{
        ...style,
        ...(size !== null && { fontSize: `${size}px` }),
        // Break inside a word only as a last resort; breaking earlier would
        // hide the overflow this component measures.
        overflowWrap: size === minPx ? 'anywhere' : 'normal',
        wordBreak: 'normal',
      }}
    >
      {text}
    </Tag>
  );
};
