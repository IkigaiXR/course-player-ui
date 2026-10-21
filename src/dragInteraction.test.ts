import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { getEventPoint, resolveTargetAtPoint, useScrollLockWhileDragging } from './dragInteraction';

describe('getEventPoint', () => {
  it('reads clientX/clientY directly from a mouse/pointer event', () => {
    const event = { clientX: 10, clientY: 20 } as MouseEvent;
    expect(getEventPoint(event)).toEqual({ x: 10, y: 20 });
  });

  it('reads clientX/clientY from touches, not a non-existent {x,y} on Touch', () => {
    const event = {
      touches: [{ clientX: 30, clientY: 40 }],
      changedTouches: [],
    } as unknown as TouchEvent;
    expect(getEventPoint(event)).toEqual({ x: 30, y: 40 });
  });

  it('falls back to changedTouches when touches is empty (touchend)', () => {
    const event = {
      touches: [],
      changedTouches: [{ clientX: 50, clientY: 60 }],
    } as unknown as TouchEvent;
    expect(getEventPoint(event)).toEqual({ x: 50, y: 60 });
  });
});

describe('resolveTargetAtPoint', () => {
  function stubEl(rect: { left: number; top: number; right: number; bottom: number }) {
    return { getBoundingClientRect: () => ({ ...rect, width: 0, height: 0, x: rect.left, y: rect.top, toJSON() { return this; } }) } as HTMLElement;
  }

  it('returns the key of the zone containing the point', () => {
    const refs = new Map([
      ['a', stubEl({ left: 0, top: 0, right: 100, bottom: 100 })],
      ['b', stubEl({ left: 200, top: 0, right: 300, bottom: 100 })],
    ]);
    expect(resolveTargetAtPoint(refs, { x: 250, y: 50 })).toBe('b');
  });

  it('returns null when the point is outside every zone', () => {
    const refs = new Map([['a', stubEl({ left: 0, top: 0, right: 100, bottom: 100 })]]);
    expect(resolveTargetAtPoint(refs, { x: 500, y: 500 })).toBeNull();
  });
});

describe('useScrollLockWhileDragging', () => {
  // Dispatches a touchmove on document and reports whether THIS specific
  // event's preventDefault was called -- not whether some other dispatch
  // elsewhere happened to call it, so "not called" assertions are a real
  // negative, not a stale spy left over from a previous dispatch.
  function dispatchTouchMoveAndCheckPrevented(): boolean {
    const event = new Event('touchmove', { cancelable: true });
    document.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it('does not call preventDefault on touchmove before start() -- native scrolling is untouched at rest', () => {
    const onForceEnd = vi.fn();
    renderHook(() => useScrollLockWhileDragging(onForceEnd));
    expect(dispatchTouchMoveAndCheckPrevented()).toBe(false);
  });

  it('calls preventDefault on touchmove once a drag is active (start() called)', () => {
    const onForceEnd = vi.fn();
    const { result } = renderHook(() => useScrollLockWhileDragging(onForceEnd));
    result.current.start();
    expect(dispatchTouchMoveAndCheckPrevented()).toBe(true);
  });

  it('stops calling preventDefault once the drag ends (stop() called)', () => {
    const onForceEnd = vi.fn();
    const { result } = renderHook(() => useScrollLockWhileDragging(onForceEnd));
    result.current.start();
    expect(dispatchTouchMoveAndCheckPrevented()).toBe(true);
    result.current.stop();
    expect(dispatchTouchMoveAndCheckPrevented()).toBe(false);
  });

  it('on pointercancel during an active drag, stops blocking scroll and runs onForceEnd (nothing left stuck)', () => {
    const onForceEnd = vi.fn();
    const { result } = renderHook(() => useScrollLockWhileDragging(onForceEnd));
    result.current.start();

    document.dispatchEvent(new Event('pointercancel'));
    expect(onForceEnd).toHaveBeenCalledTimes(1);
    // The session tore itself down as part of handling the cancel -- a
    // further touchmove is no longer prevented.
    expect(dispatchTouchMoveAndCheckPrevented()).toBe(false);
  });

  it('unmounting mid-drag tears down both listeners (no leak into later tests/dispatches)', () => {
    const onForceEnd = vi.fn();
    const { result, unmount } = renderHook(() => useScrollLockWhileDragging(onForceEnd));
    result.current.start();
    unmount();
    expect(dispatchTouchMoveAndCheckPrevented()).toBe(false);
  });
});
