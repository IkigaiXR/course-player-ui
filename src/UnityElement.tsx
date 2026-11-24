'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Box, ShieldCheck, RotateCcw } from 'lucide-react';
import { LMS_THEME } from './theme';
import { SimulationFrame, resolveSimulationUrl } from './SimulationFrame';

/**
 * XR2TRAIN UNITY WEBGL ELEMENT
 * Moved here from xr2train-lms (src/components/player/elements) so every
 * player shares it. Layout, text and the completion handshake
 * ({type: 'assessment_complete', found, total}) are unchanged; the old
 * covering overlay is replaced by SimulationFrame's focus mode (real
 * fullscreen where allowed, Minimise/Resume without losing the session,
 * automatic exit on completion).
 */
export const UnityElement = ({
  content,
  onComplete,
  hubUrl,
}: {
  content: any;
  template?: any;
  onComplete?: () => void;
  /** Main site base for relative sim URLs; defaults to NEXT_PUBLIC_MAIN_SITE_URL. */
  hubUrl?: string;
}) => {
  const [performance, setPerformance] = useState<{ found?: number; total?: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { colors, type } = LMS_THEME;
  const t = useTranslations('UnityElement');
  const { title, subheading, htmlContent, instructionalText, url } = content ?? {};

  if (!url) {
    return (
      <div className="p-32 border-4 border-dashed border-slate-100 text-center text-slate-200 uppercase font-black italic tracking-widest text-2xl">
        {t('loading')}
      </div>
    );
  }

  const src = resolveSimulationUrl(url, hubUrl);
  const shownHub = src.startsWith('http') ? new URL(src).origin : src;

  return (
    <div className="animate-in fade-in duration-1000 w-full pb-40">
      <div className="mb-10">
        {title && <h1 style={{ ...type.h2, color: colors.heading, margin: 0 }}>{title}</h1>}
      </div>
      {subheading && (
        <div className="border-l-4 pl-8 py-2 mb-12" style={{ borderColor: colors.accent }}>
          <h3 style={{ ...type.h3, color: colors.heading, margin: 0 }}>{subheading}</h3>
        </div>
      )}
      {htmlContent && (
        <div
          className="prose prose-slate max-w-none leading-relaxed mb-10 font-medium"
          style={{ color: colors.body, fontSize: type.body.fontSize }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )}
      {instructionalText && (
        <div className="mb-16">
          <p style={{ fontSize: type.body.fontSize, color: colors.body }} className="font-medium leading-relaxed margin-0">
            {instructionalText}
          </p>
        </div>
      )}

      <SimulationFrame
        key={attempt}
        src={src}
        title={title || t('activeSimulation')}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-pointer-lock"
        isCompletion={(data) => (data as { type?: unknown } | null)?.type === 'assessment_complete'}
        onComplete={(data) => {
          setPerformance((data as { found?: number; total?: number }) ?? {});
          onComplete?.();
        }}
        intro={
          <div className="w-full relative border border-slate-100 shadow-2xl overflow-hidden aspect-video flex flex-col items-center justify-center text-center p-10 sm:p-20" style={{ backgroundColor: colors.darkPanel }}>
            <Box size={80} className="text-purple-500 mb-8 animate-pulse" aria-hidden="true" />
            <h3 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter mb-4 leading-none">{t('environmentReady')}</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.4em] leading-none m-0">{t('authorisedSimulation')}</p>
          </div>
        }
        completedView={() => (
          <div className="p-16 border-l-[16px] bg-emerald-50 shadow-xl space-y-6" style={{ borderColor: colors.success }}>
            <div className="flex items-center gap-4" style={{ color: colors.success }}>
              <ShieldCheck size={32} aria-hidden="true" />
              <h2 style={{ ...type.resultHeader, color: colors.heading, margin: 0 }}>{t('wellDone')}</h2>
            </div>
            {performance && performance.total !== undefined ? (
              <p style={{ color: colors.body, fontSize: type.body.fontSize }} className="font-medium leading-relaxed">
                {t('assessmentOutcome', { found: performance.found ?? 0, total: performance.total })}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => { setPerformance(null); setAttempt((a) => a + 1); }}
              className="px-10 py-5 min-h-[44px] text-white font-black uppercase text-[10px] tracking-widest flex items-center gap-3 hover:brightness-110 transition-all shadow-xl border-none cursor-pointer leading-none"
              style={{ backgroundColor: colors.heading }}
            >
              <RotateCcw size={16} aria-hidden="true" /> {t('restartSimulation')}
            </button>
          </div>
        )}
      />

      <div className="flex items-center gap-3 text-slate-300 font-bold text-[10px] uppercase tracking-[0.3em] justify-center leading-none mt-8">
        <Box size={14} className="text-purple-500" aria-hidden="true" /> {t('simulationVersion', { hubUrl: shownHub })}
      </div>
    </div>
  );
};
