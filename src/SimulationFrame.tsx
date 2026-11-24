'use client';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2, Minimize2, Play, RotateCcw } from 'lucide-react';
import { LMS_THEME } from './theme';

/**
 * SIMULATION FRAME (focus mode) — shared by the Unity and Articulate elements.
 *
 * States:
 *   idle       the step shows its intro and a "Start simulation" button
 *   focus      a layer covers the whole viewport; real fullscreen where the
 *              browser allows it (not iPhone Safari, which only fullscreens
 *              <video>: there the covering layer is used)
 *   minimised  back on the course page with "Resume simulation"; the iframe
 *              STAYS MOUNTED (only the layer's styling changes), so Resume
 *              returns to exactly where the learner was
 *   completed  the sim reported completion: fullscreen and focus are left
 *              automatically and the step shows its completed view
 *
 * One layer element is always rendered and only restyled between states:
 * moving an iframe in the DOM would reload it.
 *
 * Sender check: completion messages are accepted only from the simulation's
 * own origin (plus any extra origins given). The origin, not the exact
 * window, is checked on purpose: Storyline posts from nested frames of the
 * same origin.
 *
 * Inside the XR2TRAIN app's WebView, entering and leaving focus posts
 * {type: 'xr2train:sim-focus', active} so the app can hide its own bar.
 */

export type SimulationPhase = 'idle' | 'focus' | 'minimised' | 'completed';

export type SimulationFrameHandle = {
  /** Mark the simulation complete from outside (e.g. the SCORM shim). */
  complete: (data?: unknown) => void;
};

type Props = {
  src: string;
  /** Accessible name for the simulation, e.g. the step title. */
  title: string;
  sandbox: string;
  isCompletion: (data: unknown) => boolean;
  onComplete: (data: unknown) => void;
  /** Origins besides the simulation's own that may report completion. */
  extraOrigins?: string[];
  /** Shown above the Start button in the idle state. */
  intro?: ReactNode;
  /** Replaces the default completed panel. */
  completedView?: (restart: () => void) => ReactNode;
};

/** "/api/simulate/…" -> "https://xr2train.com/api/simulate/…" (same rule the LMS elements used). */
export function resolveSimulationUrl(url: string, hubUrl?: string): string {
  let hub = hubUrl || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_MAIN_SITE_URL : undefined);
  if (!hub && typeof window !== 'undefined' && window.location.hostname.includes('portal.')) {
    hub = `https://${window.location.hostname.replace('portal.', '')}`;
  }
  if (!hub) hub = 'http://localhost:3000';
  return url.startsWith('/') ? `${hub}${url}` : url;
}

export function originOf(src: string): string | null {
  try {
    return new URL(src, typeof window !== 'undefined' ? window.location.href : undefined).origin;
  } catch {
    return null;
  }
}

function fullscreenAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  const d = document as Document & { webkitFullscreenEnabled?: boolean };
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

function enterFullscreen(el: HTMLElement | null) {
  if (!el || !fullscreenAvailable()) return;
  const e = el as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    const result = e.requestFullscreen ? e.requestFullscreen() : e.webkitRequestFullscreen?.();
    if (result && typeof (result as Promise<void>).catch === 'function') (result as Promise<void>).catch(() => {});
  } catch { /* the covering layer is enough */ }
}

function exitFullscreen() {
  if (typeof document === 'undefined') return;
  const d = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
  if (!(d.fullscreenElement || d.webkitFullscreenElement)) return;
  try {
    const result = d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.();
    if (result && typeof (result as Promise<void>).catch === 'function') (result as Promise<void>).catch(() => {});
  } catch { /* ignore */ }
}

function tellApp(active: boolean) {
  if (typeof window === 'undefined') return;
  const rn = (window as unknown as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView;
  try { rn?.postMessage(JSON.stringify({ type: 'xr2train:sim-focus', active })); } catch { /* not in the app */ }
}

export const SimulationFrame = forwardRef<SimulationFrameHandle, Props>(function SimulationFrame(
  { src, title, sandbox, isCompletion, onComplete, extraOrigins, intro, completedView },
  ref,
) {
  const t = useTranslations('SimulationFrame');
  const { colors } = LMS_THEME;
  const [phase, setPhase] = useState<SimulationPhase>('idle');
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState(0);
  const layerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const phaseRef = useRef<SimulationPhase>('idle');
  phaseRef.current = phase;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const isCompletionRef = useRef(isCompletion);
  isCompletionRef.current = isCompletion;

  const allowed = useRef<Set<string>>(new Set());
  allowed.current = new Set([originOf(src), ...(extraOrigins ?? [])].filter((o): o is string => !!o));

  const mounted = phase === 'focus' || phase === 'minimised';

  const complete = useCallback((data?: unknown) => {
    if (phaseRef.current === 'completed' || phaseRef.current === 'idle') return;
    exitFullscreen();
    setPhase('completed');
    onCompleteRef.current(data);
  }, []);

  useImperativeHandle(ref, () => ({ complete }), [complete]);

  // Completion messages, only from the simulation's origin, only while it runs.
  useEffect(() => {
    if (!mounted) return;
    const onMessage = (event: MessageEvent) => {
      if (!allowed.current.has(event.origin)) return;
      if (isCompletionRef.current(event.data)) complete(event.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [mounted, complete]);

  // Focus: lock page scroll and tell the app; undo on leaving focus or unmount.
  useEffect(() => {
    if (phase !== 'focus') return;
    tellApp(true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      tellApp(false);
    };
  }, [phase]);

  // Leaving the step while in fullscreen must not strand the learner.
  useEffect(() => () => exitFullscreen(), []);

  const start = () => {
    setLoaded(false);
    setPhase('focus');
    enterFullscreen(layerRef.current); // inside the click: browsers require a user gesture
  };
  const resume = () => {
    setPhase('focus');
    enterFullscreen(layerRef.current);
  };
  const minimise = () => {
    exitFullscreen();
    setPhase('minimised');
  };
  const restart = () => {
    setSession((s) => s + 1);
    setLoaded(false);
    setPhase('idle');
  };

  const layerStyle: React.CSSProperties = phase === 'focus'
    ? { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', backgroundColor: colors.darkPanel }
    // Off screen but full size, so the simulation keeps its layout and state.
    : { position: 'fixed', inset: 0, zIndex: -1, display: 'flex', flexDirection: 'column', visibility: 'hidden', pointerEvents: 'none', transform: 'translateX(-200vw)' };

  return (
    <div className="w-full" data-sim-phase={phase}>
      {phase === 'idle' ? (
        <div className="flex flex-col items-center gap-8">
          {intro}
          <button
            type="button"
            onClick={start}
            className="px-12 py-5 min-h-[44px] text-white font-black uppercase text-lg tracking-widest hover:brightness-110 transition-all shadow-2xl flex items-center gap-4 active:scale-95 border-none cursor-pointer"
            style={{ backgroundColor: colors.accent }}
          >
            <Play fill="currentColor" size={22} aria-hidden="true" /> {t('start')}
          </button>
        </div>
      ) : null}

      {phase === 'minimised' ? (
        <div role="status" className="p-10 border-l-[12px] flex flex-col gap-4" style={{ borderColor: colors.accent, backgroundColor: '#F8FAFC' }}>
          <p className="font-black text-xl m-0" style={{ color: colors.heading }}>{t('inProgress')}</p>
          <p className="m-0" style={{ color: colors.body }}>{t('inProgressHint')}</p>
          <button
            type="button"
            onClick={resume}
            className="self-start px-10 py-4 min-h-[44px] text-white font-black uppercase tracking-widest flex items-center gap-3 border-none cursor-pointer hover:brightness-110"
            style={{ backgroundColor: colors.accent }}
          >
            <Play fill="currentColor" size={18} aria-hidden="true" /> {t('resume')}
          </button>
        </div>
      ) : null}

      {phase === 'completed' ? (
        completedView ? completedView(restart) : (
          <div role="status" className="p-10 border-l-[12px] flex flex-col gap-4" style={{ borderColor: colors.success, backgroundColor: '#ECFDF5' }}>
            <p className="font-black text-xl m-0 flex items-center gap-3" style={{ color: colors.heading }}>
              <CheckCircle2 size={28} style={{ color: colors.success }} aria-hidden="true" /> {t('completed')}
            </p>
            <button
              type="button"
              onClick={restart}
              className="self-start px-8 py-4 min-h-[44px] text-white font-black uppercase text-xs tracking-widest flex items-center gap-3 border-none cursor-pointer"
              style={{ backgroundColor: colors.heading }}
            >
              <RotateCcw size={16} aria-hidden="true" /> {t('restart')}
            </button>
          </div>
        )
      ) : null}

      {/* The one layer: covering in focus, off screen when minimised. */}
      <div
        ref={layerRef}
        data-testid="sim-layer"
        style={layerStyle}
        role={phase === 'focus' ? 'dialog' : undefined}
        aria-modal={phase === 'focus' ? true : undefined}
        aria-label={phase === 'focus' ? t('focusLabel', { title }) : undefined}
        aria-hidden={phase === 'focus' ? undefined : true}
      >
        {mounted ? (
          <>
            <div className="h-16 shrink-0 flex items-center justify-between gap-4 px-4 sm:px-8 bg-black/60 border-b border-white/10">
              <span className="text-white font-black text-sm truncate">{title}</span>
              <button
                type="button"
                onClick={minimise}
                tabIndex={phase === 'focus' ? 0 : -1}
                className="min-h-[44px] min-w-[44px] px-5 flex items-center gap-2 font-black uppercase text-xs tracking-widest text-white border-2 border-white/80 bg-black/40 cursor-pointer hover:bg-white hover:text-black transition-colors"
              >
                <Minimize2 size={18} aria-hidden="true" /> {t('minimise')}
              </button>
            </div>
            <div className="flex-1 relative bg-black">
              {!loaded ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-white font-black uppercase text-xl" style={{ backgroundColor: colors.darkPanel }}>
                  <Loader2 className="animate-spin mb-6" style={{ color: colors.accent }} size={56} aria-hidden="true" /> {t('loading')}
                </div>
              ) : null}
              <iframe
                key={`${src}#${session}`}
                ref={iframeRef}
                title={title}
                // Stable per session (the old elements added t=Date.now(), a new URL on
                // every load; builds live in timestamped folders, so caching is safe).
                src={`${src}${src.includes('?') ? '&' : '?'}session=${session}`}
                className="w-full h-full border-none"
                onLoad={() => { setLoaded(true); if (phaseRef.current === 'focus') iframeRef.current?.focus(); }}
                allowFullScreen
                allow="fullscreen; autoplay"
                sandbox={sandbox}
                tabIndex={phase === 'focus' ? 0 : -1}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
});
