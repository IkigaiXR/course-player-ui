'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LMS_THEME } from './theme';

/**
 * XR2TRAIN CAROUSEL ELEMENT (v8.0 Platinum - UI ALIGNED)
 * Authority: LMS Portal Node (Port 3002)
 * Fix: Standardised H1/H2 styling, removed instructional box, and enforced full-width layout.
 * Standard: UNTRUNCATED.
 */
export const CarouselElement = ({ 
  content, 
  template, 
  onComplete 
}: { 
  content: any, 
  template?: any, 
  onComplete?: () => void 
}) => {
  const t = useTranslations('CarouselElement');
  const [idx, setIdx] = useState(0);
  const slides = content.slides || [];
  const instructionalText = content.instructionalText || "";
  const rootRef = useRef<HTMLDivElement>(null);

  const { colors, type } = LMS_THEME;

  // The carousel paginates internally (slide to slide) without changing
  // CoursePlayer's own step index, so the outer scroll-reset effect never
  // fires here — reset the nearest scrollable ancestor ourselves.
  useEffect(() => {
    rootRef.current?.closest('.overflow-y-auto')?.scrollTo({ top: 0 });
  }, [idx]);

  const {
    titleScale = 'text-6xl',
    bodyScale = 'text-3xl'
  } = content.formatting || {};

  if (slides.length === 0) {
      return (
        <div className="p-32 border-4 border-dashed border-slate-100 text-center text-slate-200 font-black uppercase tracking-widest italic text-2xl">
            {t('awaitingPhases')}
        </div>
      );
  }

  const next = () => {
    if (idx < slides.length - 1) setIdx(idx + 1);
    else if (onComplete) onComplete();
  };

  const prev = () => {
    setIdx(Math.max(0, idx - 1));
  };

  return (
    <div ref={rootRef} className="animate-in fade-in duration-1000 text-left w-full pb-40">

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
      {instructionalText && (
        <div className="mb-16">
            <p
                style={{ fontSize: type.body.fontSize, color: colors.body }}
                className="font-medium leading-relaxed margin-0"
            >
                {instructionalText}
            </p>
        </div>
      )}

      {/* --- LAYER 4: STAGE RENDERER (CAROUSEL UI) --- */}
      <div className="bg-white border border-slate-200 shadow-2xl flex flex-col lg:flex-row min-h-[700px] overflow-hidden">
        <div className="lg:w-1/2 relative overflow-hidden min-h-[400px]" style={{ backgroundColor: colors.darkPanel }}>
            <AnimatePresence mode="wait">
                <motion.img
                    key={idx}
                    src={slides[idx]?.imageUrl || "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2000"}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 0.8, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0 w-full h-full object-cover"
                    alt={slides[idx]?.imageAlt || t('phaseVisualAlt')}
                />
            </AnimatePresence>
            <div className="absolute top-8 left-8 px-4 py-2 font-black text-[10px] uppercase tracking-widest shadow-xl text-white" style={{ backgroundColor: colors.accent }}>
                {t('phaseLabel', { n: idx + 1 })}
            </div>
        </div>

        <div className="lg:w-1/2 p-12 lg:p-20 flex flex-col justify-center space-y-10 bg-white relative">
          <div className="space-y-4">
            <span style={{ ...type.label, color: colors.accent }} className="block">
                {t('deploymentSequence')}
            </span>
            <h3
                className={`${titleScale} font-black uppercase leading-[0.9] tracking-tighter break-words`}
                style={{ color: colors.heading }}
            >
                {slides[idx]?.title}
            </h3>
          </div>

          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: colors.accent, opacity: 0.2 }} />
            <p
                className={`${bodyScale} leading-relaxed font-medium italic pl-10`}
                style={{ color: colors.bodyStrong }}
            >
                "{slides[idx]?.text}"
            </p>
          </div>

          {/* NAVIGATION HANDSHAKE */}
          <div className="flex gap-4 pt-10">
            <button onClick={prev} disabled={idx === 0} className="px-8 py-5 border-4 border-slate-50 text-slate-300 font-black text-[10px] uppercase disabled:opacity-0 transition-all hover:border-slate-100 whitespace-nowrap leading-none">
                {t('previous')}
            </button>
            <button onClick={next} className="flex-1 py-5 text-white font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 leading-none" style={{ backgroundColor: colors.heading }}>
                <span className="whitespace-nowrap uppercase font-black">
                    {idx === slides.length - 1 ? t('authoriseModule') : t('nextPhase')}
                </span>
                {idx === slides.length - 1 ? <CheckCircle2 size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};