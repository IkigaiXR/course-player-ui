'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { LMS_THEME } from './theme';

/**
 * XR2TRAIN FLIP-DECK ELEMENT (v8.0 Platinum - UI ALIGNED)
 * Authority: LMS Portal Node (Port 3002)
 * Fix: Aligned Title/H2 styling, removed instructional box, and enforced full-width layout.
 * Standard: UNTRUNCATED.
 */
export const FlipDeckElement = ({
  content,
  template,
  onComplete
}: {
  content: any,
  template?: any,
  onComplete?: () => void
}) => {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [everFlipped, setEverFlipped] = useState<Set<number>>(new Set());

  const { colors, type } = LMS_THEME;
  const t = useTranslations('FlipDeckElement');

  const cards = content?.cards || [];

  // Gate completion on every card having been revealed at least once — tracked
  // separately from `flipped` since that's a toggle (flipping a card back to
  // front shouldn't un-satisfy a previously-satisfied gate).
  useEffect(() => {
    if (cards.length > 0 && everFlipped.size === cards.length) {
      onComplete?.();
    }
  }, [everFlipped, cards.length]);

  if (!content) return null;

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

      {/* --- LAYER 4: CARD MATRIX --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {cards.map((card: any, i: number) => (
          <div
            key={i}
            className="h-[450px] cursor-pointer group"
            style={{ perspective: '1000px' }}
            onClick={() => {
              setFlipped({ ...flipped, [i]: !flipped[i] });
              setEverFlipped(prev => prev.has(i) ? prev : new Set(prev).add(i));
            }}
          >
            <motion.div 
                className="relative w-full h-full preserve-3d shadow-2xl rounded-none" 
                animate={{ rotateY: flipped[i] ? 180 : 0 }} 
                transition={{ duration: 0.6, type: 'spring', stiffness: 60, damping: 12 }}
                style={{ transformStyle: "preserve-3d" }}
            >
              {/* FRONT VIEW */}
              <div className="absolute inset-0 bg-white border-b-[16px] flex flex-col items-center justify-center p-10 backface-hidden group-hover:brightness-95 transition-all overflow-hidden" style={{ borderColor: colors.heading, backfaceVisibility: 'hidden' }}>
                <div className="max-h-full overflow-y-auto custom-scrollbar">
                  <h3 className="font-black text-center tracking-tight leading-tight" style={{ ...type.h3, color: colors.heading, margin: 0 }}>
                      {card.front}
                  </h3>
                </div>
                <div className="absolute bottom-6 right-6 text-slate-100 group-hover:text-blue-600 transition-colors">
                    <RotateCcw size={20}/>
                </div>
              </div>

              {/* BACK VIEW */}
              <div
                className="absolute inset-0 border-b-[16px] text-white flex flex-col items-center justify-center p-10 backface-hidden overflow-hidden"
                style={{
                    backgroundColor: colors.heading,
                    borderColor: colors.accent,
                    transform: "rotateY(180deg)",
                    backfaceVisibility: "hidden"
                }}
              >
                <div className="max-h-full overflow-y-auto custom-scrollbar">
                  <p className="leading-relaxed text-center font-medium" style={{ fontSize: type.body.fontSize }}>
                      "{card.back}"
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        ))}
      </div>

      {/* EMPTY STATE NODE */}
      {cards.length === 0 && (
          <div className="p-32 border-4 border-dashed border-slate-100 text-center text-slate-200 font-black uppercase tracking-widest italic text-2xl">
            {t('awaitingCards')}
          </div>
      )}

      {/* REVEAL PROGRESS */}
      {cards.length > 0 && (
        <div className="flex items-center justify-center gap-3 mt-12 opacity-60">
            <span style={{ ...type.label, color: colors.body }}>
                {t('cardsRevealed', { revealed: everFlipped.size, total: cards.length })}
            </span>
        </div>
      )}
    </div>
  );
};