import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { axe } from 'jest-axe';
import en from './messages/en.json';
import { SimulationFrame } from './SimulationFrame';
import { UnityElement } from './UnityElement';
import { ArticulateElement } from './ArticulateElement';

const SIM = 'https://xr2train.com/api/simulate/sims/build-1/index.html';

function withIntl(ui: React.ReactElement) {
  return render(<NextIntlClientProvider locale="en" messages={en}>{ui}</NextIntlClientProvider>);
}

function post(data: unknown, origin = 'https://xr2train.com') {
  act(() => { window.dispatchEvent(new MessageEvent('message', { data, origin })); });
}

function setFullscreen(enabled: boolean) {
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: enabled });
}

let requestFullscreen: ReturnType<typeof vi.fn>;
let exitFullscreen: ReturnType<typeof vi.fn>;
beforeEach(() => {
  setFullscreen(true);
  requestFullscreen = vi.fn(function (this: HTMLElement) {
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: this });
    return Promise.resolve();
  });
  exitFullscreen = vi.fn(() => {
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
    return Promise.resolve();
  });
  HTMLElement.prototype.requestFullscreen = requestFullscreen as unknown as HTMLElement['requestFullscreen'];
  document.exitFullscreen = exitFullscreen as unknown as Document['exitFullscreen'];
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
});
afterEach(() => {
  delete (window as any).ReactNativeWebView;
  document.body.style.overflow = '';
});

function renderFrame(onComplete = vi.fn()) {
  const utils = withIntl(
    <SimulationFrame src={SIM} title="Signage check" sandbox="allow-scripts allow-same-origin"
      isCompletion={(d) => (d as any)?.type === 'assessment_complete'} onComplete={onComplete}
      intro={<p>Intro text</p>} />,
  );
  return { ...utils, onComplete };
}

describe('SimulationFrame', () => {
  it('starts idle: intro and Start, no iframe loaded', () => {
    const { container } = renderFrame();
    expect(screen.getByText('Intro text')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start simulation/ })).toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('Start opens focus mode: covering dialog, real fullscreen requested, page scroll locked', async () => {
    const { container } = renderFrame();
    await userEvent.click(screen.getByRole('button', { name: /Start simulation/ }));
    expect(screen.getByRole('dialog', { name: 'Signage check: simulation' })).toBeInTheDocument();
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(container.querySelector('iframe')!.getAttribute('src')).toBe(`${SIM}?session=0`);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('without the Fullscreen API (iPhone), focus mode is the covering layer only', async () => {
    setFullscreen(false);
    renderFrame();
    await userEvent.click(screen.getByRole('button', { name: /Start simulation/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('Minimise keeps the very same iframe mounted; Resume returns to it', async () => {
    const { container } = renderFrame();
    await userEvent.click(screen.getByRole('button', { name: /Start simulation/ }));
    const iframe = container.querySelector('iframe');
    await userEvent.click(screen.getByRole('button', { name: /Minimise/ }));
    expect(exitFullscreen).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Simulation in progress')).toBeInTheDocument();
    expect(container.querySelector('iframe')).toBe(iframe);
    expect(screen.getByTestId('sim-layer')).toHaveAttribute('aria-hidden', 'true');
    expect(document.body.style.overflow).toBe('');

    await userEvent.click(screen.getByRole('button', { name: /Resume simulation/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(container.querySelector('iframe')).toBe(iframe);
    expect(requestFullscreen).toHaveBeenCalledTimes(2);
  });

  it('completion from the simulation origin exits focus and fullscreen and reports once', async () => {
    const { container, onComplete } = renderFrame();
    await userEvent.click(screen.getByRole('button', { name: /Start simulation/ }));
    post({ type: 'assessment_complete', found: 4, total: 5 });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ type: 'assessment_complete', found: 4, total: 5 });
    expect(exitFullscreen).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Simulation completed')).toBeInTheDocument();
    expect(container.querySelector('iframe')).toBeNull();
    post({ type: 'assessment_complete' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('completes while minimised too', async () => {
    const { onComplete } = renderFrame();
    await userEvent.click(screen.getByRole('button', { name: /Start simulation/ }));
    await userEvent.click(screen.getByRole('button', { name: /Minimise/ }));
    post({ type: 'assessment_complete' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('sender check: the same message from another origin is ignored; other data is ignored', async () => {
    const { onComplete } = renderFrame();
    await userEvent.click(screen.getByRole('button', { name: /Start simulation/ }));
    post({ type: 'assessment_complete' }, 'https://evil.example');
    post({ type: 'assessment_complete' }, 'https://portal.xr2train.com');
    post({ type: 'progress' });
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('nothing is accepted before Start', () => {
    const { onComplete } = renderFrame();
    post({ type: 'assessment_complete' });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('inside the app it tells the app when focus starts and ends', async () => {
    const postMessage = vi.fn();
    (window as any).ReactNativeWebView = { postMessage };
    renderFrame();
    await userEvent.click(screen.getByRole('button', { name: /Start simulation/ }));
    expect(postMessage).toHaveBeenLastCalledWith(JSON.stringify({ type: 'xr2train:sim-focus', active: true }));
    await userEvent.click(screen.getByRole('button', { name: /Minimise/ }));
    expect(postMessage).toHaveBeenLastCalledWith(JSON.stringify({ type: 'xr2train:sim-focus', active: false }));
  });

  it('has no accessibility violations idle or in focus', async () => {
    const { container } = renderFrame();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: /Start simulation/ }));
    // The simulation itself is cross-origin content jsdom can't load; audit the frame around it.
    expect(await axe(document.body, { iframes: false })).toHaveNoViolations();
  });
});

describe('UnityElement on SimulationFrame', () => {
  it('assessment_complete shows the outcome and unlocks; Restart starts a fresh session', async () => {
    const onComplete = vi.fn();
    const { container } = withIntl(<UnityElement content={{ title: 'SIG013', url: '/api/simulate/sims/b/index.html' }} hubUrl="https://xr2train.com" onComplete={onComplete} />);
    await userEvent.click(screen.getByRole('button', { name: /Start simulation/ }));
    expect(container.querySelector('iframe')!.getAttribute('src')).toBe('https://xr2train.com/api/simulate/sims/b/index.html?session=0');
    post({ type: 'assessment_complete', found: 3, total: 4 });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Assessment Outcome: 3 / 4 Hazards Identified Correctly.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Restart Simulation/ }));
    expect(screen.getByRole('button', { name: /Start simulation/ })).toBeInTheDocument();
  });
});

describe('ArticulateElement on SimulationFrame', () => {
  const content = { title: 'IWS301 Module 1', url: '/api/simulate/sims/iws301' };

  it('resolves the package index and completes on the existing postMessage signals', async () => {
    for (const signal of ['completed', 'passed', 'finish', 'articulate_complete', { type: 'xAPI' }]) {
      const onComplete = vi.fn();
      const { container, unmount } = withIntl(<ArticulateElement content={content} hubUrl="https://xr2train.com" onComplete={onComplete} />);
      await userEvent.click(screen.getByRole('button', { name: /Start simulation/ }));
      expect(container.querySelector('iframe')!.getAttribute('src')).toBe('https://xr2train.com/api/simulate/sims/iws301/index.html?session=0');
      post(signal);
      expect(onComplete).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it('the SCORM shim still completes it (LMSSetValue passed, LMSFinish)', async () => {
    const onComplete = vi.fn();
    withIntl(<ArticulateElement content={content} hubUrl="https://xr2train.com" onComplete={onComplete} />);
    await userEvent.click(screen.getByRole('button', { name: /Start simulation/ }));
    act(() => { (window as any).API.LMSSetValue('cmi.core.lesson_status', 'passed'); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Simulation completed')).toBeInTheDocument();
  });
});
