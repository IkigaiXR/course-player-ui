import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FitText } from './FitText';

// jsdom has no layout, so fake one: every element is `width` px wide and the
// widest line is the longest word at 0.7em per character.
let width = 300;
const descriptors = {
  clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
  scrollWidth: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth'),
};

beforeEach(() => {
  width = 300;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) {
      const px = parseFloat(this.style.fontSize);
      const longest = Math.max(...(this.textContent || '').split(/\s+/).map(w => w.length));
      return Math.max(width, Math.ceil(longest * 0.7 * px));
    },
  });
});

afterEach(() => {
  delete (HTMLElement.prototype as any).clientWidth;
  delete (HTMLElement.prototype as any).scrollWidth;
  if (descriptors.clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', descriptors.clientWidth);
  if (descriptors.scrollWidth) Object.defineProperty(Element.prototype, 'scrollWidth', descriptors.scrollWidth);
});

const fontSize = (text: string) => parseFloat(screen.getByText(text).style.fontSize);

describe('FitText', () => {
  it('keeps the authored size when every word fits', () => {
    render(<FitText text="Mine extracted ore" style={{ fontSize: '40px' }} />);
    expect(fontSize('Mine extracted ore')).toBe(40);
    expect(screen.getByText('Mine extracted ore').style.overflowWrap).toBe('normal');
  });

  it('shrinks until the longest word fits instead of splitting it', () => {
    // OVERBURDEN: 10 chars * 0.7 * 60px = 420px > 300px.
    render(<FitText text="Mine-extracted ore and overburden" minPx={24} style={{ fontSize: '60px' }} />);
    const px = fontSize('Mine-extracted ore and overburden');
    expect(px).toBeLessThan(60);
    expect(px).toBeGreaterThanOrEqual(24);
    expect(Math.ceil(14 * 0.7 * px)).toBeLessThanOrEqual(300); // "Mine-extracted" is the longest token here
    expect(screen.getByText('Mine-extracted ore and overburden').style.overflowWrap).toBe('normal');
  });

  it('stops at minPx and only then allows breaking inside the word', () => {
    width = 100;
    render(<FitText text="Arbeidsmiljøloven" minPx={14} style={{ fontSize: '24px' }} />);
    expect(fontSize('Arbeidsmiljøloven')).toBe(14);
    expect(screen.getByText('Arbeidsmiljøloven').style.overflowWrap).toBe('anywhere');
  });

  it('re-fits from the authored size when the text changes', () => {
    const { rerender } = render(<FitText text="Overburden" style={{ fontSize: '60px' }} />);
    expect(fontSize('Overburden')).toBeLessThan(60);
    rerender(<FitText text="Ore" style={{ fontSize: '60px' }} />);
    expect(fontSize('Ore')).toBe(60);
  });

  it('renders the requested tag', () => {
    render(<FitText as="h1" text="Title" style={{ fontSize: '20px' }} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title');
  });
});
