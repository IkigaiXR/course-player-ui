import { describe, it, expect } from 'vitest';
import { getEventPoint, resolveTargetAtPoint } from './dragInteraction';

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
