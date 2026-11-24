'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Presentation } from 'lucide-react';
import { LMS_THEME } from './theme';
import { SimulationFrame, resolveSimulationUrl, type SimulationFrameHandle } from './SimulationFrame';

/** The completion signals the LMS element accepted, unchanged. */
export const ARTICULATE_COMPLETION_SIGNALS = ['completed', 'articulate_complete', 'passed', 'finish'];

export function isArticulateCompletion(data: unknown): boolean {
  return (typeof data === 'string' && ARTICULATE_COMPLETION_SIGNALS.includes(data))
    || (data as { type?: unknown } | null)?.type === 'xAPI';
}

/**
 * XR2TRAIN ARTICULATE ELEMENT
 * Moved here from xr2train-lms (src/components/player/elements). The
 * completion handshake is unchanged: the postMessage signals above, plus
 * the SCORM 1.2 shim on window.API (LMSFinish, or lesson_status completed
 * or passed). Note the shim is only reachable when the package is served
 * from the same origin as the player; from xr2train.com (/api/simulate) a
 * package can only use postMessage.
 * New: it opens in SimulationFrame's focus mode from a Start button.
 */
export const ArticulateElement = ({
  content,
  onComplete,
  hubUrl,
}: {
  content: any;
  onComplete?: () => void;
  hubUrl?: string;
}) => {
  const t = useTranslations('ArticulateElement');
  const frame = useRef<SimulationFrameHandle>(null);
  const { colors, type } = LMS_THEME;
  const { url, title } = content ?? {};

  // SCORM 1.2 shim, as before (it reports through the frame, so focus mode exits too).
  useEffect(() => {
    const w = window as unknown as { API?: unknown };
    w.API = {
      LMSInitialize: () => 'true',
      LMSFinish: () => { frame.current?.complete(); return 'true'; },
      LMSCommit: () => 'true',
      LMSSetValue: (name: string, value: string) => {
        if (name === 'cmi.core.lesson_status' && ['completed', 'passed'].includes(value)) frame.current?.complete();
        return 'true';
      },
      LMSGetValue: () => '',
      LMSGetLastError: () => '0',
      LMSGetErrorString: () => 'No Error',
      LMSGetDiagnostic: () => 'No Error',
    };
    return () => { delete w.API; };
  }, []);

  if (!url) return null;

  let src = resolveSimulationUrl(url, hubUrl);
  if (!src.toLowerCase().endsWith('.html') && !src.includes('?')) {
    src = src.endsWith('/') ? `${src}index.html` : `${src}/index.html`;
  }

  return (
    <div className="w-full pb-24">
      <SimulationFrame
        ref={frame}
        src={src}
        title={title || t('sessionTitle')}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
        isCompletion={isArticulateCompletion}
        onComplete={() => onComplete?.()}
        intro={
          <div className="w-full relative overflow-hidden aspect-video flex flex-col items-center justify-center text-center p-10 sm:p-20" style={{ backgroundColor: colors.darkPanel }}>
            <Presentation size={72} style={{ color: colors.accent }} className="mb-8" aria-hidden="true" />
            {title ? <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4 leading-tight" style={{ margin: 0 }}>{title}</h3> : null}
            <p className="text-slate-400 font-medium mt-4" style={{ fontSize: type.body.fontSize }}>{t('readyHint')}</p>
          </div>
        }
      />
    </div>
  );
};
