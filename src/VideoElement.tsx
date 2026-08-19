'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Play } from 'lucide-react';
import { LMS_THEME } from './theme';
import { QuizElement } from './QuizElement';

/**
 * XR2TRAIN VIDEO ELEMENT
 * Short (~8s) AI-generated mood/scene vignette — illustrative/atmospheric
 * by default. Click-to-play (no autoplay), with an optional caption overlay
 * for accessibility. If content.questions is populated, an embedded
 * knowledge check (reusing QuizElement) renders below the video, which stays
 * mounted and replayable so the learner can rewatch for reference.
 */
export const VideoElement = ({
  content,
  onComplete
}: {
  content: any,
  template?: any,
  onComplete?: (score?: number) => void
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [watchedToEnd, setWatchedToEnd] = useState(false);

  const { colors, type } = LMS_THEME;
  const t = useTranslations('VideoElement');

  const hasQuestions = content?.questions && content.questions.length > 0;

  // Videos without a knowledge check gate on reaching the end of playback —
  // videos with questions keep gating on the embedded quiz instead (below).
  useEffect(() => {
    if (!hasQuestions && watchedToEnd) {
      onComplete?.();
    }
  }, [hasQuestions, watchedToEnd]);

  if (!content) return null;

  const handlePlay = () => {
    setPlaying(true);
    videoRef.current?.play();
  };

  const handleEnded = () => {
    setPlaying(false);
    setWatchedToEnd(true);
  };

  return (
    <div className="animate-in fade-in duration-1000 text-left w-full pb-40">

      {/* --- LAYER 1: DYNAMIC NODE TITLE --- */}
      <div className="mb-10">
        {content.title && (
          <h1 style={{ ...type.h2, color: colors.heading, margin: 0 }}>
            {content.title}
          </h1>
        )}
      </div>

      {/* --- LAYER 2: SUBHEADING CONTEXT --- */}
      {content.subheading && (
        <div className="border-l-4 pl-8 py-2 mb-12" style={{ borderColor: colors.accent }}>
          <h3 style={{ ...type.h3, color: colors.heading, margin: 0 }}>
            {content.subheading}
          </h3>
        </div>
      )}

      {/* --- LAYER 3: INSTRUCTIONAL TEXT --- */}
      {content.instructionalText && (
        <div className="mb-16">
          <p className="leading-relaxed" style={{
            fontSize: type.body.fontSize,
            color: colors.body,
            fontWeight: 500
          }}>
            {content.instructionalText}
          </p>
        </div>
      )}

      {/* --- LAYER 4: VIDEO STAGE --- */}
      {content.videoUrl ? (
        <div className={`relative aspect-video bg-[#0B1120] ${LMS_THEME.classes.imageFrame} group`}>
          <video
            ref={videoRef}
            src={content.videoUrl}
            className="w-full h-full object-cover"
            controls={playing}
            playsInline
            onPause={() => setPlaying(false)}
            onEnded={handleEnded}
          />

          {!playing && (
            <button
              onClick={handlePlay}
              className="absolute inset-0 flex items-center justify-center bg-[#0B1120]/40 hover:bg-[#0B1120]/60 transition-all cursor-pointer border-none"
              aria-label={t('playVideo')}
            >
              <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xl">
                <Play size={32} style={{ color: colors.heading }} fill={colors.heading} className="ml-1" />
              </div>
            </button>
          )}

          {content.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-[#0B1120]/80 px-6 py-3 text-center">
              <span className="text-white text-sm font-medium leading-relaxed">{content.caption}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-32 border-4 border-dashed border-slate-100 text-center text-slate-200 font-black uppercase tracking-widest italic text-2xl aspect-video flex items-center justify-center">
          {t('awaitingVideo')}
        </div>
      )}

      {/* --- LAYER 5: OPTIONAL KNOWLEDGE CHECK --- */}
      {content.questions && content.questions.length > 0 && (
        <div className="mt-20 pt-20 border-t border-slate-100">
          <QuizElement content={content} onComplete={onComplete} />
        </div>
      )}
    </div>
  );
};
