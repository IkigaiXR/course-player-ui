import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { SortingElement } from './SortingElement';
import { renderWithIntl, stubRect } from './test/testUtils';

const content = {
  instruction: 'Sort the items',
  categories: ['Fruit', 'Vegetable'],
  items: [
    { text: 'Apple', category: 'Fruit' },
    { text: 'Carrot', category: 'Vegetable' },
    { text: 'Banana', category: 'Fruit' },
    { text: 'Potato', category: 'Vegetable' },
  ],
};

function renderStep(onComplete = vi.fn()) {
  renderWithIntl(
    <SortingElement content={content} onComplete={onComplete} enrollmentId="enrollment-1" stepId="step-1" />
  );
  return { onComplete };
}

// A correct placement removes the item from React state after a 600ms
// setTimeout, then AnimatePresence plays a spring exit transition before
// actually unmounting the node -- under jsdom's requestAnimationFrame
// simulation that settle can run well past 1000ms of real test time, so
// this needs a generous timeout. The feedback text itself (asserted
// separately, inline, in each test) appears synchronously and is the real
// correctness signal; this just confirms cleanup eventually completes.
async function waitForRemoved(name: RegExp) {
  await waitFor(() => expect(screen.queryByRole('button', { name })).not.toBeInTheDocument(), { timeout: 5000 });
}

describe('SortingElement — tap-to-select-then-tap-to-assign', () => {
  it('assigns an item to its correct category on tap, and removes it from the reservoir', async () => {
    const user = userEvent.setup();
    renderStep();

    const apple = screen.getByRole('button', { name: /Apple/ });
    await user.click(apple);
    const fruitZone = screen.getByRole('button', { name: /Fruit category/ });
    await user.click(fruitZone);

    // Synchronous correctness signal -- doesn't depend on the exit animation.
    expect(await screen.findByText('Correct')).toBeInTheDocument();
    await waitForRemoved(/Apple/);
  });

  it('wrong placement does not remove the item, and lets the learner try again', async () => {
    const user = userEvent.setup();
    renderStep();

    const apple = screen.getByRole('button', { name: /Apple/ });
    await user.click(apple);
    const vegetableZone = screen.getByRole('button', { name: /Vegetable category/ });
    await user.click(vegetableZone);

    // Still there -- a wrong placement must not remove the item.
    expect(screen.getByRole('button', { name: /Apple/ })).toBeInTheDocument();

    // Selection is still armed after a miss, so it can be retried immediately.
    const fruitZone = screen.getByRole('button', { name: /Fruit category/ });
    await user.click(fruitZone);
    expect(await screen.findByText('Correct')).toBeInTheDocument();
    await waitForRemoved(/Apple/);
  });

  it('tapping a category with nothing selected does nothing', async () => {
    const user = userEvent.setup();
    renderStep();
    const fruitZone = screen.getByRole('button', { name: /Fruit category/ });
    await user.click(fruitZone);
    // All four items still present.
    expect(screen.getAllByRole('button', { name: /draggable item/ })).toHaveLength(4);
  });

  it('tapping a selected item again deselects it', async () => {
    const user = userEvent.setup();
    renderStep();
    const apple = screen.getByRole('button', { name: /Apple/ });
    await user.click(apple);
    expect(apple).toHaveAttribute('aria-pressed', 'true');
    await user.click(apple);
    expect(apple).toHaveAttribute('aria-pressed', 'false');
  });

  it('fires onComplete only once every item has been correctly placed', async () => {
    const user = userEvent.setup();
    const { onComplete } = renderStep();

    const placements: [string, string][] = [
      ['Apple', 'Fruit'], ['Carrot', 'Vegetable'], ['Banana', 'Fruit'],
    ];
    for (const [item, category] of placements) {
      await user.click(screen.getByRole('button', { name: new RegExp(item) }));
      await user.click(screen.getByRole('button', { name: new RegExp(`${category} category`) }));
      await waitForRemoved(new RegExp(item));
    }
    expect(onComplete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Potato/ }));
    await user.click(screen.getByRole('button', { name: /Vegetable category/ }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(screen.getByText('Well Done!')).toBeInTheDocument();
  });
});

describe('SortingElement — keyboard', () => {
  it('completes the whole step with keyboard only (Enter to pick up, Enter to drop)', async () => {
    const user = userEvent.setup();
    const { onComplete } = renderStep();

    const allPlacements: [string, string][] = [
      ['Apple', 'Fruit'], ['Carrot', 'Vegetable'], ['Banana', 'Fruit'], ['Potato', 'Vegetable'],
    ];
    for (const [item, category] of allPlacements) {
      const itemEl = screen.getByRole('button', { name: new RegExp(item) });
      itemEl.focus();
      // Each removal re-triggers a `layout` animation on the remaining
      // items, and this player's own keyboard-press handling goes through
      // framer-motion's internal press-gesture emulation (not a plain
      // onKeyDown) -- confirmed by testing this against a fixed delay that
      // neither of those settle on a single predictable tick count under
      // jsdom's requestAnimationFrame simulation. Polling for the actual
      // outcome, with a real timeout, is the correct tool here, not a
      // longer guessed sleep -- this waits exactly as long as each attempt
      // actually needs, every time.
      await waitFor(() => expect(itemEl).toHaveFocus());
      await user.keyboard('{Enter}');
      await waitFor(() => expect(itemEl).toHaveAttribute('aria-pressed', 'true'), { timeout: 2000 });

      const zoneEl = screen.getByRole('button', { name: new RegExp(`${category} category`) });
      zoneEl.focus();
      await waitFor(() => expect(zoneEl).toHaveFocus());
      await user.keyboard('{Enter}');
      await waitForRemoved(new RegExp(item));
    }
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 5000 });
  });

  it('Escape cancels a keyboard pick-up without assigning anything', async () => {
    const user = userEvent.setup();
    renderStep();
    const apple = screen.getByRole('button', { name: /Apple/ });
    apple.focus();
    await waitFor(() => expect(apple).toHaveFocus());
    await user.keyboard('{Enter}');
    await waitFor(() => expect(apple).toHaveAttribute('aria-pressed', 'true'), { timeout: 2000 });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(apple).toHaveAttribute('aria-pressed', 'false'), { timeout: 2000 });
    // Nothing removed.
    expect(screen.getAllByRole('button', { name: /draggable item/ })).toHaveLength(4);
  });
});

describe('SortingElement — drag', () => {
  it('a drag release over the correct zone assigns the item (same marking path as tap)', async () => {
    renderStep();

    const apple = screen.getByRole('button', { name: /Apple/ });
    const fruitZone = screen.getByRole('button', { name: /Fruit category/ });
    stubRect(fruitZone, { left: 500, top: 500, right: 700, bottom: 700 });

    const start = apple.getBoundingClientRect();
    fireEvent.pointerDown(apple, { pointerId: 1, clientX: start.left + 5, clientY: start.top + 5, button: 0 });
    await new Promise((r) => setTimeout(r, 0));
    // Move in two steps, past the zone's rect and framer-motion's own
    // drag-start threshold, then release inside the zone. A single large
    // jump from pointerdown straight to the release point is not how a
    // real drag reports movement (framer-motion's gesture engine processes
    // pointermove deltas, and seems to need at least one intermediate
    // sample between down and up to register the gesture as a drag at
    // all under jsdom -- a single down/up pair with no intervening move
    // reads as a tap, not a drag, regardless of final coordinates).
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 300, clientY: 300 });
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 600, clientY: 600 });
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 600, clientY: 600 });

    expect(await screen.findByText('Correct', {}, { timeout: 3000 })).toBeInTheDocument();
    await waitForRemoved(/Apple/);
  });

  it('a drag release outside any zone leaves the item in place', async () => {
    renderStep();
    const apple = screen.getByRole('button', { name: /Apple/ });
    const fruitZone = screen.getByRole('button', { name: /Fruit category/ });
    const vegZone = screen.getByRole('button', { name: /Vegetable category/ });
    stubRect(fruitZone, { left: 0, top: 0, right: 100, bottom: 100 });
    stubRect(vegZone, { left: 0, top: 0, right: 100, bottom: 100 });

    const start = apple.getBoundingClientRect();
    fireEvent.pointerDown(apple, { pointerId: 2, clientX: start.left + 5, clientY: start.top + 5, button: 0 });
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 4500, clientY: 4500 });
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 9000, clientY: 9000 });
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.pointerUp(window, { pointerId: 2, clientX: 9000, clientY: 9000 });

    // Give any pending state updates a tick, then confirm Apple is still there.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole('button', { name: /Apple/ })).toBeInTheDocument();
  });
});

describe('SortingElement — accessibility', () => {
  it('has no axe violations in its initial state', async () => {
    const { container } = renderWithIntl(
      <SortingElement content={content} enrollmentId="e1" stepId="s1" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('every item and category zone is keyboard-focusable', () => {
    renderStep();
    for (const name of [/Apple/, /Carrot/, /Banana/, /Potato/]) {
      expect(screen.getByRole('button', { name })).not.toHaveAttribute('tabindex', '-1');
    }
    for (const name of [/Fruit category/, /Vegetable category/]) {
      expect(screen.getByRole('button', { name })).not.toHaveAttribute('tabindex', '-1');
    }
  });

  it('announces pick-up and placement via a live region', async () => {
    const user = userEvent.setup();
    renderStep();
    const apple = screen.getByRole('button', { name: /Apple/ });
    await user.click(apple);
    expect(screen.getByText('Apple picked up')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Fruit category/ }));
    await waitFor(() => expect(screen.getByText('Apple placed correctly in Fruit')).toBeInTheDocument());
  });
});

describe('SortingElement — item order', () => {
  it('shuffles order based on the enrollment+step seed (not always authored order)', () => {
    // Authored order is Apple, Carrot, Banana, Potato. With this seed the
    // rendered order should differ from authored order for at least one
    // position -- if this ever becomes flaky because a given seed happens
    // to round-trip to the identity permutation, change the seed inputs,
    // not the assertion's intent.
    renderWithIntl(<SortingElement content={content} enrollmentId="enrollment-xyz" stepId="step-xyz" />);
    const rendered = screen.getAllByRole('button', { name: /draggable item/ }).map((el) => el.textContent);
    expect(rendered).not.toEqual(['Apple', 'Carrot', 'Banana', 'Potato']);
  });

  it('the same enrollment+step+attempt renders the same order on remount (stable within an attempt)', () => {
    const { unmount } = renderWithIntl(<SortingElement content={content} enrollmentId="e-stable" stepId="s-stable" />);
    const first = screen.getAllByRole('button', { name: /draggable item/ }).map((el) => el.textContent);
    unmount();

    renderWithIntl(<SortingElement content={content} enrollmentId="e-stable" stepId="s-stable" />);
    const second = screen.getAllByRole('button', { name: /draggable item/ }).map((el) => el.textContent);
    expect(second).toEqual(first);
  });
});
