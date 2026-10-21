import { useCallback, useEffect, useRef } from 'react';
import { DragControls } from 'framer-motion';

/**
 * Shared drag/press-delay/auto-scroll machinery, extracted from
 * SortingElement so FillBlanksElement (and anything after it) builds on
 * the same, once-fixed implementation instead of a second copy. See
 * SortingElement.tsx's file-level comment for the full history of why each
 * piece exists; this module only restates the essentials.
 */

// A touch that holds roughly in place for this long is a drag; one that
// moves more than MOVE_TOLERANCE_PX before then is left alone as a native
// scroll/pan gesture. 150ms is faster than the browser's own long-press
// (~500ms, used for text selection/context menus) since this is a
// deliberate in-app gesture, not an accidental hold; 8px matches typical
// OS touch-slop thresholds.
export const PRESS_DELAY_MS = 150;
export const MOVE_TOLERANCE_PX = 8;

// How close the pointer needs to be to the scroll container's visible edge
// (in px) before auto-scroll kicks in, and the fastest it will scroll (px
// per animation frame) right at that edge, easing to 0 at the threshold.
export const AUTO_SCROLL_EDGE_PX = 60;
export const AUTO_SCROLL_MAX_SPEED = 14;

export function getEventPoint(event: MouseEvent | TouchEvent | PointerEvent): { x: number; y: number } {
  // The DOM Touch interface has clientX/clientY, not x/y -- a real bug
  // caught by tsc, not by a test, the first time this existed only in
  // SortingElement (jsdom's synthetic touch events in that suite all went
  // through clientX/clientY directly on the event, so a {x,y}-shaped read
  // here would have silently resolved to `undefined` on every real
  // touchscreen without a single test catching it).
  const touch = 'touches' in event ? (event.touches[0] || event.changedTouches[0]) : null;
  return touch
    ? { x: touch.clientX, y: touch.clientY }
    : { x: (event as MouseEvent | PointerEvent).clientX, y: (event as MouseEvent | PointerEvent).clientY };
}

/** Finds the nearest scrollable ancestor so auto-scroll works regardless of
 * which app embeds this component -- it never assumes a specific parent
 * structure. Falls back to the window itself if none is found. */
export function findScrollableAncestor(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement || null;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Resolves which of several candidate drop-zone elements (if any) a point
 * falls inside, from their live getBoundingClientRect(). Direction-agnostic
 * (RTL included): browser-reported left/right are always min/max X in
 * standard pixel space regardless of text direction, so no special-casing
 * is needed for right-to-left layouts. */
export function resolveTargetAtPoint<K>(
  refs: Map<K, HTMLElement>,
  point: { x: number; y: number }
): K | null {
  for (const [key, el] of refs) {
    const r = el.getBoundingClientRect();
    if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) return key;
  }
  return null;
}

/** Auto-scroll-while-dragging: the primary mobile-reachability mechanism
 * (NOT `position: sticky` alone -- see SortingElement.tsx's file-level
 * comment on why that isn't trustworthy under a transform-bearing
 * ancestor). Call `start(originEl)` from your onDragStart, `reportY(y)`
 * from onDrag, and `stop()` from onDragEnd / unmount. */
export function useAutoScrollOnDrag() {
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const pointerYRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    const y = pointerYRef.current;
    if (y == null) {
      frameRef.current = null;
      return;
    }
    const container = scrollContainerRef.current;
    const rect = container ? container.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    let speed = 0;
    if (y < rect.top + AUTO_SCROLL_EDGE_PX) {
      speed = -AUTO_SCROLL_MAX_SPEED * (1 - Math.max(0, y - rect.top) / AUTO_SCROLL_EDGE_PX);
    } else if (y > rect.bottom - AUTO_SCROLL_EDGE_PX) {
      speed = AUTO_SCROLL_MAX_SPEED * (1 - Math.max(0, rect.bottom - y) / AUTO_SCROLL_EDGE_PX);
    }
    if (speed !== 0) {
      if (container) container.scrollBy(0, speed);
      else window.scrollBy(0, speed);
    }
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback((originEl: HTMLElement) => {
    scrollContainerRef.current = findScrollableAncestor(originEl);
    if (frameRef.current == null) frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const reportY = useCallback((y: number) => {
    pointerYRef.current = y;
  }, []);

  const stop = useCallback(() => {
    pointerYRef.current = null;
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  return { start, reportY, stop };
}

/** Press-delay + movement-tolerance drag activation, with one DragControls
 * instance per draggable key -- a single shared instance's .start()
 * broadcasts to every subscribed `motion` component at once (that's
 * literally how DragControls.start is implemented), which would start a
 * drag on every item simultaneously instead of just the one pressed. */
export function usePressDelayDragControls<K extends string>() {
  const controlsRef = useRef<Map<K, DragControls>>(new Map());
  const getDragControls = useCallback((key: K): DragControls => {
    let dc = controlsRef.current.get(key);
    if (!dc) {
      dc = new DragControls();
      controlsRef.current.set(key, dc);
    }
    return dc;
  }, []);

  const pressTimerRef = useRef<number | null>(null);
  const cancelPendingPressRef = useRef<(() => void) | null>(null);
  const dragOriginElRef = useRef<HTMLElement | null>(null);

  useEffect(() => () => cancelPendingPressRef.current?.(), []);

  const handlePointerDown = useCallback((event: React.PointerEvent, key: K) => {
    cancelPendingPressRef.current?.(); // only one pending press at a time
    dragOriginElRef.current = event.currentTarget as HTMLElement;
    const { clientX, clientY, pointerId } = event;
    const state = { x: clientX, y: clientY, pointerId, cancelled: false };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      cancelPendingPressRef.current = null;
    };
    const cancelPress = () => {
      state.cancelled = true;
      if (pressTimerRef.current != null) {
        window.clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
      cleanup();
    };
    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== state.pointerId || state.cancelled) return;
      const dx = moveEvent.clientX - state.x;
      const dy = moveEvent.clientY - state.y;
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) cancelPress();
    };
    // Any release/cancel clears the pending press, not just one matching
    // this exact pointerId -- there's only ever one press pending at a
    // time (a fresh pointerdown cancels any prior one above).
    const onUp = () => cancelPress();

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    cancelPendingPressRef.current = cancelPress;

    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = null;
      if (state.cancelled) return;
      cleanup();
      getDragControls(key).start(event, { snapToCursor: false });
    }, PRESS_DELAY_MS);
  }, [getDragControls]);

  return { getDragControls, handlePointerDown, dragOriginElRef };
}
