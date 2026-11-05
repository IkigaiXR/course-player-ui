import React, { StrictMode, useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { BranchElement } from './BranchElement';
import en from './messages/en.json';

// Stands in for TextElement, which can't be imported here (it needs
// html-react-parser, which this package leaves to the consuming app).
// Reproduces exactly what TextElement does for a sequential-reveal step
// with no bullets (TextElement.tsx: allBulletsRevealed is true at once, so
// its completion effect calls onComplete on mount).
function CompletesOnMount({ content, onComplete }: { content: any, onComplete?: () => void }) {
  useEffect(() => { onComplete?.(); }, []);
  return <p>{content.title}</p>;
}

// Same text-step rule as xr2train-lms's src/components/player/stepTypeMap.tsx
// isPassiveStep (and course-builder's): a text step is passive unless it opts
// into sequential reveal or a minimum dwell.
const isPassiveStep = (step: any) =>
  !!step && step.type === 'text' &&
  step.content?.layout_config?.reveal_mode !== 'sequential' &&
  !(step.content?.layout_config?.min_dwell_seconds > 0);

const stepTypeMap = { text: CompletesOnMount };

// The real shape of all four branch sub-steps in T2-GEN-AU-SIL362 and
// T2-RAI-AU-SIL879 (2026-11-05): sequential reveal opted in, but no bullets
// authored, and an empty microCheck object.
const pathStep = (title: string) => ({
  type: 'text',
  title,
  content: {
    title,
    htmlContent: '<p>Debrief body.</p>',
    bulletHtml: '',
    microCheck: { question: '', revealText: '' },
    layout_config: { reveal_mode: 'sequential', min_dwell_seconds: 0 },
  },
});

const content = {
  prompt: 'What do you do next?',
  options: [
    { id: 'stop-and-report', text: 'Stop and report', path: [pathStep('Reporting the Uncontrolled Task')] },
    { id: 'continue-quickly', text: 'Tidy it yourself', path: [pathStep('Staying in the Dust Cloud')] },
  ],
};

function renderBranch(props: Record<string, any> = {}, strict = false) {
  const tree = (
    <NextIntlClientProvider locale="en" messages={en}>
      <BranchElement content={content} stepTypeMap={stepTypeMap} isPassiveStep={isPassiveStep} {...props} />
    </NextIntlClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

const finishPath = () => screen.getByRole('button', { name: en.BranchElement.finishPath });

describe('BranchElement: a sub-step that completes as soon as it mounts', () => {
  for (const strict of [false, true]) {
    const mode = strict ? 'StrictMode (dev, e.g. the builder)' : 'production rendering (the LMS)';

    it(`enables Finish Path after choosing an option -- ${mode}`, () => {
      const onComplete = vi.fn();
      renderBranch({ onComplete }, strict);
      fireEvent.click(screen.getByText('Stop and report'));
      expect(finishPath()).toBeEnabled();
      fireEvent.click(finishPath());
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it(`enables Finish Path when resuming mid-branch -- ${mode}`, () => {
      renderBranch({ resumeState: { optionId: 'continue-quickly', subIndex: 0 } }, strict);
      expect(finishPath()).toBeEnabled();
    });

    it(`completes each of two same-type sub-steps in a row -- ${mode}`, () => {
      const twoStep = {
        prompt: 'Choose',
        options: [{ id: 'a', text: 'Option A', path: [pathStep('First'), pathStep('Second')] }],
      };
      renderBranch({ content: twoStep }, strict);
      fireEvent.click(screen.getByText('Option A'));
      const next = screen.getByRole('button', { name: en.BranchElement.continue });
      expect(next).toBeEnabled();
      fireEvent.click(next);
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(finishPath()).toBeEnabled();
    });
  }
});
