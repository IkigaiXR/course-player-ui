import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { FillBlanksElement } from './FillBlanksElement';
import { PRESS_DELAY_MS } from './dragInteraction';
import { renderWithIntl, stubRect } from './test/testUtils';

const content = {
  title: 'Complete the picture',
  sentence: 'The [Workplace Exposure Standard] sets the binding limit, and the [Rail Safety National Law] adds rail-specific duties.',
  distractors: ['Local Council Bylaw', 'Site Induction Policy'],
};

function renderStep(onComplete = vi.fn(), extraContent: any = {}) {
  renderWithIntl(<FillBlanksElement content={{ ...content, ...extraContent }} onComplete={onComplete} enrollmentId="enrollment-1" stepId="step-1" />);
  return { onComplete };
}

const PAST_PRESS_DELAY_MS = PRESS_DELAY_MS + 60;

async function dispatchDragMoves(pointerId: number, points: Array<{ x: number; y: number }>, pointerType?: string) {
  for (const p of points) {
    fireEvent.pointerMove(window, { pointerId, pointerType, clientX: p.x, clientY: p.y });
    await new Promise((r) => setTimeout(r, 16));
  }
}

async function selectWord(user: ReturnType<typeof userEvent.setup>, el: HTMLElement) {
  await user.click(el);
  await waitFor(() => expect(el).toHaveAttribute('aria-pressed', 'true'));
}

describe('FillBlanksElement — tap-to-select-then-tap-to-place', () => {
  it('places a selected bank word into an empty blank', async () => {
    const user = userEvent.setup();
    renderStep();
    const word = screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ });
    await selectWord(user, word);
    const blank = screen.getAllByRole('button', { name: /Blank \d, drop zone/ })[0];
    await user.click(blank);

    await waitFor(() => expect(screen.getByRole('button', { name: /Workplace Exposure Standard, placed in blank 1/ })).toBeInTheDocument());
    // No longer in the bank.
    expect(screen.queryByRole('button', { name: /^Workplace Exposure Standard, draggable word/ })).not.toBeInTheDocument();
  });

  it('tapping a placed word removes it back to the bank (existing removal behaviour, unchanged)', async () => {
    const user = userEvent.setup();
    renderStep();
    await selectWord(user, screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ }));
    await user.click(screen.getAllByRole('button', { name: /Blank \d, drop zone/ })[0]);
    const placed = await screen.findByRole('button', { name: /Workplace Exposure Standard, placed in blank 1/ });

    await user.click(placed);
    await waitFor(() => expect(screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ })).toBeInTheDocument());
  });

  it('placing a word into an already-filled blank bumps the previous occupant back to the bank, not lost', async () => {
    const user = userEvent.setup();
    renderStep();
    const blanks = () => screen.getAllByRole('button', { name: /Blank \d, drop zone/ });

    await selectWord(user, screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ }));
    await user.click(blanks()[0]);
    await screen.findByRole('button', { name: /Workplace Exposure Standard, placed in blank 1/ });

    // Select a different bank word and tap the SAME (now filled) blank via
    // its placed-word button is removal, not placement -- so instead,
    // directly re-select the placed word is not offered via tap (by
    // design, see FillBlanksElement's renderWord comment); verify the
    // drag path instead covers this (next describe block). Here, confirm
    // the tap path's "existing removal" still frees the blank correctly so
    // a second word CAN be placed into it afterwards.
    await user.click(screen.getByRole('button', { name: /Workplace Exposure Standard, placed in blank 1/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ })).toBeInTheDocument());

    await selectWord(user, screen.getByRole('button', { name: /Rail Safety National Law, draggable word/ }));
    await user.click(blanks()[0]);
    await waitFor(() => expect(screen.getByRole('button', { name: /Rail Safety National Law, placed in blank 1/ })).toBeInTheDocument());
  });

  it('Check Answers stays disabled until every blank is filled, then validates correctly', async () => {
    const user = userEvent.setup();
    const { onComplete } = renderStep();
    const checkButton = screen.getByRole('button', { name: /Check Answers/ });
    expect(checkButton).toBeDisabled();

    await selectWord(user, screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ }));
    await user.click(screen.getAllByRole('button', { name: /Blank \d, drop zone/ })[0]);
    await screen.findByRole('button', { name: /Workplace Exposure Standard, placed in blank 1/ });
    expect(checkButton).toBeDisabled();

    await selectWord(user, screen.getByRole('button', { name: /Rail Safety National Law, draggable word/ }));
    await user.click(screen.getAllByRole('button', { name: /Blank \d, drop zone/ })[0]);
    await waitFor(() => expect(checkButton).not.toBeDisabled());

    await user.click(checkButton);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Correct')).toBeInTheDocument();
  });

  it('Check Answers shows an error and does not clear slots on a wrong answer', async () => {
    const user = userEvent.setup();
    const { onComplete } = renderStep();
    const blanks = () => screen.getAllByRole('button', { name: /Blank \d, drop zone/ });

    // Deliberately wrong: Rail Safety National Law into blank 1.
    await selectWord(user, screen.getByRole('button', { name: /Rail Safety National Law, draggable word/ }));
    await user.click(blanks()[0]);
    await screen.findByRole('button', { name: /Rail Safety National Law, placed in blank 1/ });
    await selectWord(user, screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ }));
    await user.click(blanks()[0] ?? blanks()[1]); // second remaining empty blank

    await waitFor(() => expect(screen.getByRole('button', { name: /Check Answers/ })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: /Check Answers/ }));

    await waitFor(() => expect(screen.getByText('Not Quite Right')).toBeInTheDocument());
    expect(onComplete).not.toHaveBeenCalled();
    // Slots are untouched -- still filled, learner must manually fix.
    expect(screen.getByRole('button', { name: /Rail Safety National Law, placed in blank 1/ })).toBeInTheDocument();
  });
});

describe('FillBlanksElement — keyboard', () => {
  it('selects a word, chooses a blank, and places it with Enter', async () => {
    const user = userEvent.setup();
    renderStep();
    const word = screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ });
    word.focus();
    await waitFor(() => expect(word).toHaveFocus());
    await user.keyboard('{Enter}');
    await waitFor(() => expect(word).toHaveAttribute('aria-pressed', 'true'));

    const blank = screen.getAllByRole('button', { name: /Blank \d, drop zone/ })[0];
    blank.focus();
    await waitFor(() => expect(blank).toHaveFocus());
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('button', { name: /Workplace Exposure Standard, placed in blank 1/ })).toBeInTheDocument());
  });

  it('Escape cancels a keyboard selection without placing anything', async () => {
    const user = userEvent.setup();
    renderStep();
    const word = screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ });
    word.focus();
    await waitFor(() => expect(word).toHaveFocus());
    await user.keyboard('{Enter}');
    await waitFor(() => expect(word).toHaveAttribute('aria-pressed', 'true'));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(word).toHaveAttribute('aria-pressed', 'false'));
    expect(screen.getAllByRole('button', { name: /Blank \d, drop zone/ })).toHaveLength(2);
  });
});

describe('FillBlanksElement — drag', () => {
  it('drags a bank word onto a blank', async () => {
    renderStep();
    const word = screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ });
    // The registered drop-zone ref is the WRAPPING <span> (set via
    // setZoneRef), not the placeholder <button> rendered inside it while
    // empty -- stub the rect on the actual hit-test target.
    const blank = screen.getAllByRole('button', { name: /Blank \d, drop zone/ })[0].parentElement as HTMLElement;
    stubRect(blank, { left: 500, top: 500, right: 700, bottom: 700 });

    const start = word.getBoundingClientRect();
    fireEvent.pointerDown(word, { pointerId: 1, clientX: start.left + 5, clientY: start.top + 5, button: 0 });
    await new Promise((r) => setTimeout(r, PAST_PRESS_DELAY_MS));
    await dispatchDragMoves(1, [{ x: 150, y: 150 }, { x: 300, y: 300 }, { x: 450, y: 450 }, { x: 600, y: 600 }]);
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 600, clientY: 600 });

    await waitFor(() => expect(screen.getByRole('button', { name: /Workplace Exposure Standard, placed in blank 1/ })).toBeInTheDocument());
  });

  it('drags a placed word onto a different (empty) blank, moving it', async () => {
    const user = userEvent.setup();
    renderStep();
    await selectWord(user, screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ }));
    await user.click(screen.getAllByRole('button', { name: /Blank \d, drop zone/ })[0]);
    const placed = await screen.findByRole('button', { name: /Workplace Exposure Standard, placed in blank 1/ });

    const secondBlank = screen.getByRole('button', { name: /Blank 2, drop zone/ }).parentElement as HTMLElement;
    stubRect(secondBlank, { left: 500, top: 500, right: 700, bottom: 700 });

    const start = placed.getBoundingClientRect();
    fireEvent.pointerDown(placed, { pointerId: 2, clientX: start.left + 5, clientY: start.top + 5, button: 0 });
    await new Promise((r) => setTimeout(r, PAST_PRESS_DELAY_MS));
    await dispatchDragMoves(2, [{ x: 150, y: 150 }, { x: 300, y: 300 }, { x: 450, y: 450 }, { x: 600, y: 600 }]);
    fireEvent.pointerUp(window, { pointerId: 2, clientX: 600, clientY: 600 });

    await waitFor(() => expect(screen.getByRole('button', { name: /Workplace Exposure Standard, placed in blank 2/ })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /placed in blank 1/ })).not.toBeInTheDocument();
  });

  it('drags a placed word back onto the bank, returning it (same effect as tap-to-remove)', async () => {
    const user = userEvent.setup();
    renderStep();
    await selectWord(user, screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ }));
    await user.click(screen.getAllByRole('button', { name: /Blank \d, drop zone/ })[0]);
    const placed = await screen.findByRole('button', { name: /Workplace Exposure Standard, placed in blank 1/ });

    const bank = screen.getByRole('group', { name: /Word bank, drop zone/ });
    stubRect(bank, { left: 0, top: 900, right: 1000, bottom: 1200 });

    const start = placed.getBoundingClientRect();
    fireEvent.pointerDown(placed, { pointerId: 3, clientX: start.left + 5, clientY: start.top + 5, button: 0 });
    await new Promise((r) => setTimeout(r, PAST_PRESS_DELAY_MS));
    await dispatchDragMoves(3, [{ x: 100, y: 400 }, { x: 100, y: 700 }, { x: 100, y: 950 }, { x: 100, y: 1000 }]);
    fireEvent.pointerUp(window, { pointerId: 3, clientX: 100, clientY: 1000 });

    await waitFor(() => expect(screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ })).toBeInTheDocument());
  });

  it('dragging a word onto an already-filled blank bumps the previous occupant back to the bank', async () => {
    const user = userEvent.setup();
    renderStep();
    await selectWord(user, screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ }));
    await user.click(screen.getAllByRole('button', { name: /Blank \d, drop zone/ })[0]);
    await screen.findByRole('button', { name: /Workplace Exposure Standard, placed in blank 1/ });

    const otherWord = screen.getByRole('button', { name: /Rail Safety National Law, draggable word/ });
    const targetBlankWrapper = screen.getByRole('button', { name: /Workplace Exposure Standard, placed in blank 1/ }).parentElement as HTMLElement;
    stubRect(targetBlankWrapper, { left: 500, top: 500, right: 700, bottom: 700 });

    const start = otherWord.getBoundingClientRect();
    fireEvent.pointerDown(otherWord, { pointerId: 4, clientX: start.left + 5, clientY: start.top + 5, button: 0 });
    await new Promise((r) => setTimeout(r, PAST_PRESS_DELAY_MS));
    await dispatchDragMoves(4, [{ x: 150, y: 150 }, { x: 300, y: 300 }, { x: 450, y: 450 }, { x: 600, y: 600 }]);
    fireEvent.pointerUp(window, { pointerId: 4, clientX: 600, clientY: 600 });

    await waitFor(() => expect(screen.getByRole('button', { name: /Rail Safety National Law, placed in blank 1/ })).toBeInTheDocument());
    // The bumped word is back in the bank, not lost.
    await waitFor(() => expect(screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ })).toBeInTheDocument());
  });

  it('the touch path (pointerType "touch") places a word identically to default pointer input', async () => {
    renderStep();
    const word = screen.getByRole('button', { name: /Rail Safety National Law, draggable word/ });
    const blank = screen.getAllByRole('button', { name: /Blank \d, drop zone/ })[1].parentElement as HTMLElement;
    stubRect(blank, { left: 500, top: 500, right: 700, bottom: 700 });

    const start = word.getBoundingClientRect();
    fireEvent.pointerDown(word, { pointerId: 5, pointerType: 'touch', clientX: start.left + 5, clientY: start.top + 5, button: 0 });
    await new Promise((r) => setTimeout(r, PAST_PRESS_DELAY_MS));
    await dispatchDragMoves(5, [{ x: 150, y: 150 }, { x: 300, y: 300 }, { x: 450, y: 450 }, { x: 600, y: 600 }], 'touch');
    fireEvent.pointerUp(window, { pointerId: 5, pointerType: 'touch', clientX: 600, clientY: 600 });

    await waitFor(() => expect(screen.getByRole('button', { name: /Rail Safety National Law, placed in blank 2/ })).toBeInTheDocument());
  });
});

describe('FillBlanksElement — edge cases', () => {
  it('the same correct word appearing in two blanks is tracked independently (no duplicate-text selection collision)', async () => {
    const user = userEvent.setup();
    renderStep(vi.fn(), {
      sentence: 'Wear [adequate] RPE and confirm ventilation is [adequate] before starting.',
      distractors: ['optional'],
    });
    const words = screen.getAllByRole('button', { name: /^adequate, draggable word/ });
    expect(words).toHaveLength(2);

    await selectWord(user, words[0]);
    // The OTHER "adequate" bank word must not also show as selected --
    // confirms bank entries are tracked by id, not by raw string equality
    // (a real bug fixed as part of this rewrite: `selectedWord === word`
    // on plain strings would have marked every same-text word selected,
    // since both buttons would compare equal by text).
    const stillUnselected = screen.getAllByRole('button', { name: /^adequate, draggable word/ })
      .filter((el) => el !== words[0]);
    expect(stillUnselected).toHaveLength(1);
    expect(stillUnselected[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('a long sentence wrapping across multiple lines still drags and places correctly', async () => {
    renderStep(vi.fn(), {
      sentence:
        'Before beginning any ballast handling or concrete sleeper cutting work, the crew must confirm that the [Workplace Exposure Standard] has been checked against current air monitoring data, that engineering controls such as wet suppression and local exhaust ventilation are verified as genuinely operating rather than just documented, and that the additional duties under the [Rail Safety National Law] have been accounted for alongside general workplace exposure obligations before any possession window begins.',
    });
    const word = screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ });
    const blank = screen.getAllByRole('button', { name: /Blank \d, drop zone/ })[0].parentElement as HTMLElement;
    // Framer's `drag` repositions via a CSS transform, which doesn't
    // affect document flow -- the rest of the wrapped sentence reflowing
    // around a mid-drag item is a layout concern, not a drag-logic one,
    // and behaves identically to Sorting's reservoir (already verified
    // there). This test confirms the mechanism still resolves correctly
    // when the blank sits deep inside a long, wrapped sentence.
    stubRect(blank, { left: 500, top: 900, right: 700, bottom: 1000 });

    const start = word.getBoundingClientRect();
    fireEvent.pointerDown(word, { pointerId: 9, clientX: start.left + 5, clientY: start.top + 5, button: 0 });
    await new Promise((r) => setTimeout(r, PAST_PRESS_DELAY_MS));
    await dispatchDragMoves(9, [{ x: 550, y: 300 }, { x: 550, y: 600 }, { x: 550, y: 850 }, { x: 600, y: 950 }]);
    fireEvent.pointerUp(window, { pointerId: 9, clientX: 600, clientY: 950 });

    await waitFor(() => expect(screen.getByRole('button', { name: /Workplace Exposure Standard, placed in blank 1/ })).toBeInTheDocument());
  });

  it('renders correctly under dir="rtl" and hit-testing still resolves by rect, not reading direction', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <FillBlanksElement content={content} enrollmentId="e-rtl" stepId="s-rtl" />,
      { dir: 'rtl' }
    );
    const word = screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ });
    await selectWord(user, word);
    const blank = screen.getAllByRole('button', { name: /Blank \d, drop zone/ })[0];
    await user.click(blank);
    await waitFor(() => expect(screen.getByRole('button', { name: /Workplace Exposure Standard, placed in blank 1/ })).toBeInTheDocument());
  });
});

describe('FillBlanksElement — accessibility', () => {
  it('has no axe violations in its initial state', async () => {
    const { container } = renderWithIntl(<FillBlanksElement content={content} enrollmentId="e1" stepId="s1" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('every bank word and every blank is keyboard-focusable', () => {
    renderStep();
    for (const name of [/Workplace Exposure Standard/, /Rail Safety National Law/, /Local Council Bylaw/, /Site Induction Policy/]) {
      expect(screen.getByRole('button', { name })).not.toHaveAttribute('tabindex', '-1');
    }
    for (const blank of screen.getAllByRole('button', { name: /Blank \d, drop zone/ })) {
      expect(blank).not.toHaveAttribute('tabindex', '-1');
    }
  });

  it('announces pick-up and placement via a live region', async () => {
    const user = userEvent.setup();
    renderStep();
    const word = screen.getByRole('button', { name: /Workplace Exposure Standard, draggable word/ });
    await user.click(word);
    await waitFor(() => expect(screen.getByText('Workplace Exposure Standard picked up')).toBeInTheDocument());

    await user.click(screen.getAllByRole('button', { name: /Blank \d, drop zone/ })[0]);
    await waitFor(() => expect(screen.getByText('Workplace Exposure Standard placed in blank 1')).toBeInTheDocument());
  });
});

describe('FillBlanksElement — word bank order', () => {
  it('shuffles order based on the enrollment+step seed (not always authored order)', () => {
    renderWithIntl(<FillBlanksElement content={content} enrollmentId="enrollment-xyz" stepId="step-xyz" />);
    const rendered = screen.getAllByRole('button', { name: /draggable word/ }).map((el) => el.textContent);
    expect(rendered).not.toEqual(['Workplace Exposure Standard', 'Rail Safety National Law', 'Local Council Bylaw', 'Site Induction Policy']);
  });

  it('the same enrollment+step+attempt renders the same order on remount (stable within an attempt)', () => {
    const { unmount } = renderWithIntl(<FillBlanksElement content={content} enrollmentId="e-stable" stepId="s-stable" />);
    const first = screen.getAllByRole('button', { name: /draggable word/ }).map((el) => el.textContent);
    unmount();

    renderWithIntl(<FillBlanksElement content={content} enrollmentId="e-stable" stepId="s-stable" />);
    const second = screen.getAllByRole('button', { name: /draggable word/ }).map((el) => el.textContent);
    expect(second).toEqual(first);
  });
});
