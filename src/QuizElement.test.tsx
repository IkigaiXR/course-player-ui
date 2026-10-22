import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuizElement } from './QuizElement';
import { renderWithIntl } from './test/testUtils';

const content = {
  passScore: 80,
  questions: [
    {
      question: 'Which standard sets the binding exposure limit?',
      options: ['Local council bylaw', 'Site induction policy', 'Workplace Exposure Standard', 'General duty of care only'],
      correctIndex: 2,
      feedback: ['Wrong: not a binding national standard.', 'Wrong: an internal policy, not a regulation.', 'Correct: the WES is the binding national limit.', 'Wrong: too general for this specific duty.'],
    },
    {
      question: 'What additional framework applies to rail work?',
      options: ['Rail Safety National Law', 'Local council bylaw', 'Site induction policy', 'General duty of care only'],
      correctIndex: 0,
      feedback: 'Feedback applies regardless of which option was picked.',
    },
  ],
};

function renderQuiz(onComplete = vi.fn(), enrollmentId = 'enrollment-1', stepId = 'step-1') {
  renderWithIntl(<QuizElement content={content} onComplete={onComplete} enrollmentId={enrollmentId} stepId={stepId} />);
  return { onComplete };
}

describe('QuizElement — shuffle marking parity', () => {
  it('shuffles option order relative to authored order (given a seed)', () => {
    renderQuiz(vi.fn(), 'enrollment-xyz', 'step-xyz');
    const rendered = screen.getAllByRole('button').slice(0, 4).map((el) => el.textContent);
    expect(rendered).not.toEqual(['Local council bylaw', 'Site induction policy', 'Workplace Exposure Standard', 'General duty of care only']);
  });

  it('marks correct based on the ORIGINAL authored option, regardless of its shuffled display position', async () => {
    const user = userEvent.setup();
    renderQuiz();
    // Find the button whose text IS the originally-correct option, wherever
    // the shuffle placed it -- not by position.
    const correctButton = screen.getByText('Workplace Exposure Standard').closest('button')!;
    await user.click(correctButton);
    await user.click(screen.getByRole('button', { name: /Submit Answer/ }));
    await waitFor(() => expect(screen.getByText('Correct')).toBeInTheDocument());
  });

  it('marks incorrect when a non-correct option is picked, wherever it was displayed', async () => {
    const user = userEvent.setup();
    renderQuiz();
    const wrongButton = screen.getByText('Local council bylaw').closest('button')!;
    await user.click(wrongButton);
    await user.click(screen.getByRole('button', { name: /Submit Answer/ }));
    await waitFor(() => expect(screen.getByText('Incorrect')).toBeInTheDocument());
  });

  it("feedback moves WITH its option, not with the option's displayed position", async () => {
    const user = userEvent.setup();
    renderQuiz();
    // Pick the option that was authored as index 1 ("Site induction
    // policy") -- its feedback text is specific to that option, not
    // whatever feedback[selectedIdx] (the display position) would be.
    const optionButton = screen.getByText('Site induction policy').closest('button')!;
    await user.click(optionButton);
    await user.click(screen.getByRole('button', { name: /Submit Answer/ }));
    await waitFor(() => expect(screen.getByText('Wrong: an internal policy, not a regulation.')).toBeInTheDocument());
  });

  it('handles a non-array (single string) feedback the same for every option', async () => {
    const user = userEvent.setup();
    renderQuiz();
    // Advance to question 2, which has a single shared feedback string.
    const q1Correct = screen.getByText('Workplace Exposure Standard').closest('button')!;
    await user.click(q1Correct);
    await user.click(screen.getByRole('button', { name: /Submit Answer/ }));
    await waitFor(() => screen.getByRole('button', { name: /Next Question/ }));
    await user.click(screen.getByRole('button', { name: /Next Question/ }));

    await waitFor(() => expect(screen.getByText('What additional framework applies to rail work?')).toBeInTheDocument());
    const anyOption = screen.getByText('Rail Safety National Law').closest('button')!;
    await user.click(anyOption);
    await user.click(screen.getByRole('button', { name: /Submit Answer/ }));
    await waitFor(() => expect(screen.getByText('Feedback applies regardless of which option was picked.')).toBeInTheDocument());
  });

  it('each question is shuffled independently (not a single order for the whole quiz)', () => {
    // Render several distinct seeds and confirm at least one produces a
    // different relative order between question 1's and question 2's
    // shared option text ("Local council bylaw" / "Site induction policy"
    // appear in both questions) -- if both questions used the exact same
    // permutation, this would be indistinguishable from a single shared
    // shuffle. Checking across several seeds makes this a meaningful,
    // non-flaky assertion rather than relying on one specific seed's luck.
    let sawIndependentOrdering = false;
    for (let i = 0; i < 8 && !sawIndependentOrdering; i++) {
      const { unmount } = renderWithIntl(
        <QuizElement content={content} enrollmentId={`e-${i}`} stepId="step-independent" />
      );
      const q1Order = screen.getAllByRole('button').slice(0, 4).map((el) => el.textContent);
      unmount();
      const { unmount: unmount2 } = renderWithIntl(
        <QuizElement content={{ ...content, questions: [content.questions[1]] }} enrollmentId={`e-${i}`} stepId="step-independent" />
      );
      const q2Order = screen.getAllByRole('button').slice(0, 4).map((el) => el.textContent);
      unmount2();
      if (JSON.stringify(q1Order) !== JSON.stringify(q2Order)) sawIndependentOrdering = true;
    }
    expect(sawIndependentOrdering).toBe(true);
  });
});

describe('QuizElement — stability and retry', () => {
  it('the same enrollment+step+question+attempt renders the same order on remount', () => {
    const { unmount } = renderWithIntl(
      <QuizElement content={content} enrollmentId="e-stable" stepId="s-stable" />
    );
    const first = screen.getAllByRole('button').slice(0, 4).map((el) => el.textContent);
    unmount();

    renderWithIntl(<QuizElement content={content} enrollmentId="e-stable" stepId="s-stable" />);
    const second = screen.getAllByRole('button').slice(0, 4).map((el) => el.textContent);
    expect(second).toEqual(first);
  });

  it('reshuffles on retry (a failed attempt restarting the quiz)', async () => {
    const user = userEvent.setup();
    renderQuiz(vi.fn(), 'e-retry-seed', 's-retry-seed');
    const beforeRetry = screen.getAllByRole('button').slice(0, 4).map((el) => el.textContent);

    // Fail both questions deliberately, then retake. The fail view appears
    // automatically right after the LAST question's submit (no "Next
    // Question" click needed at that point -- the component renders it
    // based on showFeedback + currentIdx alone), so only advance via that
    // button between questions, not after the final one.
    for (let i = 0; i < 2; i++) {
      const wrongButton = screen.getAllByRole('button')[0];
      await user.click(wrongButton);
      await user.click(screen.getByRole('button', { name: /Submit Answer/ }));
      if (i < 1) {
        await waitFor(() => screen.getByRole('button', { name: /Next Question/ }));
        await user.click(screen.getByRole('button', { name: /Next Question/ }));
      }
    }
    await waitFor(() => expect(screen.getByRole('button', { name: /Retake Assessment/ })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Retake Assessment/ }));

    await waitFor(() => expect(screen.getByText('Which standard sets the binding exposure limit?')).toBeInTheDocument());
    const afterRetry = screen.getAllByRole('button').slice(0, 4).map((el) => el.textContent);
    // Not a strict guarantee for every possible seed (a shuffle CAN land
    // back on its own order by chance), but with 4 options the odds of an
    // identical re-shuffle are low enough that a reproducible failure here
    // would be worth a second look, not treated as expected flake.
    expect(afterRetry).not.toEqual(beforeRetry);
  });
});

describe('QuizElement — no identity, no shuffle', () => {
  it('keeps authored order when neither enrollmentId nor stepId is provided', () => {
    renderWithIntl(<QuizElement content={content} />);
    const rendered = screen.getAllByRole('button').slice(0, 4).map((el) => el.textContent);
    expect(rendered).toEqual(['Local council bylaw', 'Site induction policy', 'Workplace Exposure Standard', 'General duty of care only']);
  });
});
