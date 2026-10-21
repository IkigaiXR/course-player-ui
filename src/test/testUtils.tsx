import React from 'react';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

// Keep in sync with xr2train-lms/src/messages/en.json's "SortingElement"
// section -- duplicated here deliberately rather than imported, since this
// package has no dependency on that app's file layout and shouldn't reach
// across the repo boundary to read it.
export const SORTING_ELEMENT_MESSAGES = {
  SortingElement: {
    wellDone: 'Well Done!',
    closeoutFallback: 'Classification complete.',
    restartAssessment: 'Restart Exercise',
    instructionFallback: 'Logic Classification',
    interactionHint: 'Drag each item into the right category (or tap an item, then tap a category).',
    correct: 'Correct',
    incorrect: 'Try Again',
    tapToAssign: 'Tap to assign',
    wordOptions: 'Items',
    sortedCounter: '{sorted} / {total} sorted',
    loading: 'Loading...',
    itemAriaLabel: '{item}, draggable item',
    categoryAriaLabel: '{category} category, drop zone',
    announcePickedUp: '{item} picked up',
    announceOverZone: 'Over {category}',
    announceCancelled: '{item} placement cancelled',
    announceCorrect: '{item} placed correctly in {category}',
    announceIncorrect: '{item} does not belong in {category}, try again',
  },
};

// Keep in sync with xr2train-lms/src/messages/en.json's "FillBlanksElement"
// section, same rationale as SORTING_ELEMENT_MESSAGES above.
export const FILL_BLANKS_MESSAGES = {
  FillBlanksElement: {
    interactionHint: 'Drag each word into a blank (or tap a word, then tap a blank).',
    correct: 'Correct',
    protocolBreach: 'Not Quite Right',
    resetInteraction: 'Try Again',
    tapSlot: 'Tap to fill',
    availableOptions: 'Word Bank',
    checkAnswers: 'Check Answers',
    wordAriaLabel: '{word}, draggable word',
    placedWordAriaLabel: '{word}, placed in blank {number}. Activate to remove.',
    blankAriaLabel: 'Blank {number}, drop zone',
    bankAriaLabel: 'Word bank, drop zone',
    announcePickedUp: '{word} picked up',
    announcePlaced: '{word} placed in blank {number}',
    announceRemoved: '{word} returned to the word bank',
    announceCancelled: '{word} placement cancelled',
    announceOverBlank: 'Over blank {number}',
    announceOverBank: 'Over word bank',
  },
};

const ALL_MESSAGES = { ...SORTING_ELEMENT_MESSAGES, ...FILL_BLANKS_MESSAGES };

export function renderWithIntl(ui: React.ReactElement, opts?: { locale?: string; dir?: 'ltr' | 'rtl' }) {
  const locale = opts?.locale ?? 'en';
  return render(
    <div dir={opts?.dir ?? 'ltr'}>
      <NextIntlClientProvider locale={locale} messages={ALL_MESSAGES}>
        {ui}
      </NextIntlClientProvider>
    </div>
  );
}

/** Stubs getBoundingClientRect on a real DOM node, so drop-zone geometry
 * checks (which read real rects) are deterministic under jsdom, which
 * otherwise always returns an all-zero rect. */
export function stubRect(el: Element, rect: { left: number; top: number; right: number; bottom: number }) {
  el.getBoundingClientRect = () => ({
    ...rect,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    x: rect.left,
    y: rect.top,
    toJSON() { return this; },
  });
}

/** Makes an element look like a scrollable ancestor to
 * findScrollableAncestor (overflow-y + scrollHeight > clientHeight), none
 * of which jsdom computes from real layout -- plus a rect for the
 * auto-scroll edge-distance check, and a spy-able scrollBy. */
export function stubScrollable(
  el: HTMLElement,
  opts: { top: number; bottom: number; scrollHeight?: number; clientHeight?: number }
) {
  el.style.overflowY = 'auto';
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: opts.scrollHeight ?? 2000 });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: opts.clientHeight ?? 600 });
  stubRect(el, { left: 0, top: opts.top, right: 800, bottom: opts.bottom });
  el.scrollBy = () => {};
}
