import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import { MotionGlobalConfig } from 'framer-motion';

expect.extend(toHaveNoViolations);

// Framer Motion's own documented test escape hatch: resolves every
// animation (layout, exit, whileDrag snap-back, etc.) to its end state
// instantly instead of stepping it over time via requestAnimationFrame.
// This is the root cause of this suite's ~1-in-5 flake rate under jsdom's
// imprecise rAF simulation -- an AnimatePresence exit or a layout
// reflow settling at an unpredictable tick count, racing against a test's
// timeout. Not the same thing as the `MotionConfig reducedMotion="always"`
// approach tried earlier in this PR, which only affects transform-based
// "prefers reduced motion" behaviour and caused a *different* regression
// (it broke the Escape test); `skipAnimations` is a harder, global
// skip-all-animations switch meant specifically for tests.
MotionGlobalConfig.skipAnimations = true;

// jsdom has no matchMedia or ResizeObserver; framer-motion's drag/layout
// internals probe for both. Minimal stubs so components mount cleanly --
// not asserting on either, just preventing "is not a function" crashes.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

if (!('ResizeObserver' in window)) {
  (window as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom defines window.scrollBy but throws "Not implemented" when it's
// actually called (https://github.com/jsdom/jsdom/issues/1670) -- this is
// what the auto-scroll-while-dragging fallback (no stubbed scrollable
// ancestor found -> scroll the window itself) calls once the pointer nears
// the test's simulated viewport edge. In a real browser this is a
// perfectly normal, well-supported call; it's purely a jsdom gap, the same
// category as the matchMedia/ResizeObserver stubs above. Left un-stubbed,
// it was the real root cause behind this suite's drag-test flake (traced
// via a full jsdom stack trace, not assumed) -- not an app bug.
window.scrollBy = () => {};

// jsdom has no PointerEvent constructor at all (a long-standing gap --
// https://github.com/jsdom/jsdom/issues/2527). framer-motion's gesture
// internals construct/dispatch real PointerEvents (not just listen for
// them), including for its own keyboard-activates-press emulation, so
// drag and keyboard-press tests crash without this polyfill.
if (!('PointerEvent' in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    width: number;
    height: number;
    pressure: number;
    tangentialPressure: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  (window as any).PointerEvent = PointerEventPolyfill;
  (globalThis as any).PointerEvent = PointerEventPolyfill;
}
