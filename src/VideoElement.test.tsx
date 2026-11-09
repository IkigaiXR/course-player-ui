import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoElement } from './VideoElement';
import { renderWithIntl } from './test/testUtils';

const IMG = 'https://example.test/media/web/scene.png';
const VID = 'https://example.test/media/web/scene.mp4';

const question = {
  question: 'Which control is in use?',
  options: ['None', 'Water suppression', 'Extraction only', 'Respirator only'],
  correctIndex: 1,
  feedback: ['No.', 'Yes.', 'No.', 'No.'],
};

function renderVideo(content: any, onComplete = vi.fn()) {
  const utils = renderWithIntl(<VideoElement content={content} onComplete={onComplete} enrollmentId="enrollment-1" stepId="step-1" />);
  return { ...utils, onComplete };
}

describe('VideoElement image fallback', () => {
  it('shows the image when there is no videoUrl', () => {
    const { container } = renderVideo({ imageUrl: IMG, imageAlt: 'A worker cutting a kerb with water suppression', caption: 'Wet cutting in practice' });
    const img = screen.getByRole('img', { name: 'A worker cutting a kerb with water suppression' });
    expect(img.getAttribute('src')).toBe(IMG);
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByText('Wet cutting in practice')).toBeTruthy();
    expect(screen.queryByText('Awaiting video asset authorisation...')).toBeNull();
  });

  it('falls back to the caption for alt text when imageAlt is empty', () => {
    renderVideo({ imageUrl: IMG, caption: 'Wet cutting in practice' });
    expect(screen.getByRole('img', { name: 'Wet cutting in practice' })).toBeTruthy();
  });

  it('uses the image as the poster when both a video and an image exist', () => {
    const { container } = renderVideo({ videoUrl: VID, imageUrl: IMG });
    const video = container.querySelector('video')!;
    expect(video.getAttribute('src')).toBe(VID);
    expect(video.getAttribute('poster')).toBe(IMG);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('keeps the video unchanged (no poster) when there is no image', () => {
    const { container } = renderVideo({ videoUrl: VID });
    expect(container.querySelector('video')!.hasAttribute('poster')).toBe(false);
  });

  it('shows the placeholder when there is neither', () => {
    renderVideo({ caption: 'Wet cutting in practice' });
    expect(screen.getByText('Awaiting video asset authorisation...')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('never completes on the image alone', () => {
    const { onComplete } = renderVideo({ imageUrl: IMG });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('still completes a video without questions when playback ends', () => {
    const { container, onComplete } = renderVideo({ videoUrl: VID, imageUrl: IMG });
    fireEvent.ended(container.querySelector('video')!);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('renders questions under the image and completes through the quiz', async () => {
    const user = userEvent.setup();
    const { onComplete } = renderVideo({ imageUrl: IMG, imageAlt: 'Wet cutting scene', passScore: 100, questions: [question] });
    expect(screen.getByRole('img', { name: 'Wet cutting scene' })).toBeTruthy();
    expect(screen.getByText('Which control is in use?')).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();
    await user.click(screen.getByText('Water suppression').closest('button')!);
    await user.click(screen.getByRole('button', { name: /Submit Answer/ }));
    await user.click(await screen.findByRole('button', { name: /View Results/ }));
    expect(onComplete).toHaveBeenCalledWith(100);
  });
});
