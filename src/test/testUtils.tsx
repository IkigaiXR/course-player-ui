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

export function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={SORTING_ELEMENT_MESSAGES}>
      {ui}
    </NextIntlClientProvider>
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
