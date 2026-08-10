'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, CheckCircle2 } from 'lucide-react';
import { LMS_THEME } from './theme';

/**
 * XR2TRAIN HOTSPOT ELEMENT (v8.5 Platinum - LMS SOVEREIGN)
 * Authority: LMS Portal Node (Port 3002)
 * Style: TextElement Aesthetic (Black Left-Border H2 only).
 * Fix: Dual-Mode Aware (Hotspot vs Hazard behavior).
 */
export const HotspotElement = ({ 
    content, 
    template, 
    onComplete 
}: { 
    content: any, 
    template?: any, 
    onComplete?: () => void 
}) => {
  const [active, setActive] = useState<any>(null);
  const [viewed, setViewed] = useState<Set<number>>(new Set());
  const [isFinished, setIsFinished] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const t = useTranslations('HotspotElement');

  const mode = content.mode || 'hotspot'; // Handles the flip from the editor
  const spots = content.spots || [];
  const displayNarrative = content.htmlContent || content.instructionalText;

  useEffect(() => {
    setImageFailed(false);
  }, [content.imageUrl]);

  const { colors, type } = LMS_THEME;

  // --- 2. PROGRESSION LOGIC ---
  const handleSpotClick = (spot: any, index: number) => {
    if (isFinished) return;
    setActive(spot);
    const newViewed = new Set(viewed);
    newViewed.add(index);
    setViewed(newViewed);
  };

  useEffect(() => {
    if (spots.length > 0 && viewed.size === spots.length) {
      if (onComplete) onComplete();
    }
  }, [viewed, spots.length, onComplete]);

  return (
    <div className="animate-in fade-in duration-1000 w-full pb-40">
      
      {/* LAYER 1: H1 (Clean, No Borders) */}
      <div className="mb-10">
        {content.title && (
            <h1 style={{ ...type.h2, color: colors.heading, margin: 0 }}>
                {content.title}
            </h1>
        )}
      </div>

      {/* LAYER 2: H2 (Left Border) */}
      {content.subheading && (
        <div className="border-l-4 pl-8 py-2 mb-12" style={{ borderColor: colors.accent }}>
            <h3 style={{ ...type.h3, color: colors.heading, margin: 0 }}>
                {content.subheading}
            </h3>
        </div>
      )}

      {/* LAYER 3: SOVEREIGN NARRATIVE */}
      {displayNarrative && (
        <div
            className="prose prose-slate max-w-none leading-relaxed font-medium mb-16"
            style={{ fontSize: type.body.fontSize, color: colors.body }}
            dangerouslySetInnerHTML={{ __html: displayNarrative }}
        />
      )}

      {/* INTERACTIVE STAGE */}
      {content.imageUrl && !imageFailed ? (
        <div className={`relative ${LMS_THEME.classes.imageFrame} bg-slate-100 cursor-crosshair`}>
            <img
              src={content.imageUrl}
              className="w-full h-auto select-none pointer-events-none"
              alt={content.imageAlt || t('sceneAlt')}
              onError={() => setImageFailed(true)}
            />

            {spots.map((s: any, i: number) => {
              const hasBeenFound = viewed.has(i);
              return (
                <button
                    key={i}
                    onClick={() => handleSpotClick(s, i)}
                    className={`absolute w-16 h-16 -ml-8 -mt-8 flex items-center justify-center transition-all duration-300 z-10 cursor-pointer
                               ${mode === 'hazard'
                                 ? (hasBeenFound ? 'bg-red-600 border-4 border-white scale-100' : 'bg-transparent border-none')
                                 : 'border-[6px] border-white font-black text-xl shadow-2xl text-white'}`}
                    style={{ left: `${s.x}%`, top: `${s.y}%`, backgroundColor: mode === 'hazard' ? undefined : colors.accent }}
                >
                    {/* Hides numbers if in hazard mode until found */}
                    {mode === 'hotspot' ? (i + 1) : (hasBeenFound && <CheckCircle2 size={24} className="text-white" />)}
                </button>
              );
            })}

            <AnimatePresence>
            {active && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 backdrop-blur-md flex items-center justify-center p-12 z-20"
                    style={{ backgroundColor: `${colors.darkPanel}E6` }}
                >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                    className={`bg-white p-16 max-w-2xl shadow-2xl border-t-[16px] relative text-left ${mode === 'hazard' ? 'border-red-600' : ''}`}
                    style={mode === 'hazard' ? undefined : { borderColor: colors.accent }}
                >
                    <button onClick={() => setActive(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-500 bg-transparent border-none cursor-pointer">
                        <X size={40}/>
                    </button>

                    <div className="flex items-center gap-4 mb-8">
                        <div className={`w-1.5 h-12 ${mode === 'hazard' ? 'bg-red-600' : ''}`} style={mode === 'hazard' ? undefined : { backgroundColor: colors.accent }} />
                        <h4 style={{ ...type.h3, color: colors.heading, margin: 0 }}>{active.title}</h4>
                    </div>

                    <p className="text-slate-600 text-2xl leading-relaxed font-medium border-l-8 border-slate-100 pl-10 mb-12">"{active.text}"</p>

                    <button onClick={() => setActive(null)} className="w-full py-6 text-white font-black uppercase text-[10px] tracking-widest hover:brightness-110 shadow-xl border-none cursor-pointer" style={{ backgroundColor: colors.heading }}>
                        {mode === 'hazard' ? t('continueAudit') : t('returnToScene')}
                    </button>
                </motion.div>
                </motion.div>
            )}
            </AnimatePresence>
        </div>
      ) : (
        <div className="p-40 border-4 border-dashed border-slate-100 text-center text-slate-200 font-black uppercase tracking-[0.4em]">
          {imageFailed ? t('sceneFailedToLoad') : t('awaitingAsset')}
        </div>
      )}

      <div className="flex items-center gap-3 justify-center opacity-20 mt-10">
         <Target size={14} className="text-slate-400" />
         <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">
             {mode === 'hazard'
               ? t('hazardsFound', { found: viewed.size, total: spots.length })
               : t('pointsFound', { found: viewed.size, total: spots.length })}
         </span>
      </div>
    </div>
  );
};