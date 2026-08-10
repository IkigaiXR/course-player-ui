'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCcw, Zap, XCircle, MousePointer2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LMS_THEME } from './theme';

/**
 * XR2TRAIN FILL-IN-THE-BLANKS (v14.5 Sovereign - TOTAL TAP LOGIC)
 * Authority: LMS Portal Node (Port 3002)
 * Logic: Tap-to-Select + Tap-to-Place. 
 * Fix: Removed all DND libraries to fix Vercel build + Fix mobile reliability.
 */
export const FillBlanksElement = ({ 
    content, 
    onComplete 
}: { 
    content: any, 
    onComplete?: () => void 
}) => {
  const [slots, setSlots] = useState<Record<number, string>>({});
  const [wordBank, setWordBank] = useState<string[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error', text: string } | null>(null);

  const { title, subheading, htmlContent, sentence, distractors } = content;
  const { colors } = LMS_THEME;

  // 1. SYNTAX PARSING
  const parts: string[] = (sentence || "").split(/\[(.*?)\]/g);
  const correctAnswers: string[] = parts.filter((_, i) => i % 2 === 1);

  useEffect(() => {
    const bank: string[] = [...correctAnswers, ...(distractors || [])].sort(() => Math.random() - 0.5);
    setWordBank(bank);
    setSlots({});
    setSelectedWord(null);
    setIsFinished(false);
  }, [sentence, distractors]);

  // 2. INTERACTION HANDLERS
  const handleBankClick = (word: string) => {
    if (isFinished) return;
    setSelectedWord(selectedWord === word ? null : word);
  };

  const handleSlotClick = (index: number) => {
    if (isFinished) return;

    // If slot is filled: Remove word and send back to bank
    if (slots[index]) {
        const wordToRemove = slots[index];
        setSlots(prev => {
            const next = { ...prev };
            delete next[index];
            return next;
        });
        setWordBank(prev => [...prev, wordToRemove]);
        return;
    }

    // If a word is selected: Place it in the empty slot
    if (selectedWord) {
        setSlots(prev => ({ ...prev, [index]: selectedWord }));
        setWordBank(prev => prev.filter(w => w !== selectedWord));
        setSelectedWord(null);
    }
  };

  const validate = () => {
    const isAllCorrect = Object.entries(slots).every(([idx, val]) => parts[parseInt(idx)] === val);
    if (isAllCorrect) {
      setIsFinished(true);
      if (onComplete) onComplete();
    } else {
      setFeedback({ type: 'error', text: 'Protocol Breach: Try Again' });
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  if (isFinished) return (
    <div className="pb-40 animate-in zoom-in-95 duration-700">
        <div className="p-10 md:p-16 border-l-[16px] bg-white shadow-2xl space-y-8" style={{ borderColor: colors.success }}>
            <div className="flex items-center gap-4" style={{ color: colors.success }}>
                <ShieldCheck size={32} />
                <h2 style={{ ...LMS_THEME.type.resultHeader, color: colors.heading, margin: 0 }}>Correct!</h2>
            </div>
            <div className="border-t border-slate-100 pt-10" style={{ ...LMS_THEME.type.quote, color: colors.body }}>
                <p>"{sentence.replace(/\[/g, '').replace(/\]/g, '')}"</p>
            </div>
            <button onClick={() => { setSlots({}); setIsFinished(false); }} className="flex items-center gap-3 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-blue-600 transition-all bg-transparent border-none cursor-pointer">
                <RefreshCcw size={14}/> Reset Interaction
            </button>
        </div>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-1000 w-full pb-40 overflow-x-hidden text-left">

        {/* HEADERS */}
        <div className="mb-10 text-left">
            {title && <h1 style={{ ...LMS_THEME.type.h2, color: colors.heading, margin: 0 }}>{title}</h1>}
        </div>
        {subheading && (
            <div className="border-l-4 pl-8 py-2 mb-12 text-left" style={{ borderColor: colors.accent }}>
                <h3 style={{ ...LMS_THEME.type.h3, color: colors.heading, margin: 0 }}>{subheading}</h3>
            </div>
        )}

        {/* NARRATIVE */}
        {htmlContent && <div className="prose prose-slate max-w-none leading-relaxed font-medium mb-16 text-left" style={{ fontSize: LMS_THEME.type.body.fontSize, color: colors.body }} dangerouslySetInnerHTML={{ __html: htmlContent }} />}

        {/* INTERACTION STAGE */}
        <div className="relative p-8 md:p-16 bg-white border border-slate-200 shadow-2xl mb-12 text-left">
          <div className="text-lg md:text-2xl font-bold flex flex-wrap gap-x-4 gap-y-8 items-baseline" style={{ color: colors.heading }}>
            {parts.map((part: string, i: number) => {
              if (i % 2 === 0) return <span key={i}>{part}</span>;

              const isFilled = !!slots[i];
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSlotClick(i)}
                  className={`
                    inline-flex min-w-[160px] md:min-w-[280px] h-12 md:h-16 border-b-[6px] md:border-b-[10px]
                    transition-all justify-center items-center px-4 cursor-pointer border-x-0 border-t-0
                    ${isFilled ? 'bg-transparent' : 'bg-[#F8FAFC] border-[#F1F5F9] hover:bg-blue-50'}
                  `}
                  style={isFilled ? { borderColor: colors.heading } : undefined}
                >
                    {isFilled ? (
                        <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ color: colors.accent }}>
                            {slots[i]}
                        </motion.span>
                    ) : (
                        <span className="text-slate-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                            <MousePointer2 size={12} /> Tap Slot
                        </span>
                    )}
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {feedback && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center z-50 backdrop-blur-md" style={{ backgroundColor: `${colors.darkPanel}E6` }}>
                    <XCircle size={64} className="text-red-500 mb-4" />
                    <span className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-white">{feedback.text}</span>
                </motion.div>
            )}
           </AnimatePresence>
        </div>

        {/* WORD BANK */}
        <div className="p-8 md:p-12 shadow-2xl flex flex-wrap justify-center gap-4 md:gap-6 relative" style={{ backgroundColor: colors.darkPanel }}>
            <div className="absolute top-3 left-6 text-[8px] font-black text-white/30 uppercase tracking-[0.5em]">Available Options</div>
            {wordBank.map((word: string, i: number) => {
                const isSelected = selectedWord === word;
                return (
                    <button
                        key={i}
                        type="button"
                        onClick={() => handleBankClick(word)}
                        className={`
                            px-6 py-3 md:px-8 md:py-4 font-black uppercase text-xs md:text-sm
                            transition-all flex items-center gap-3 border-2
                            cursor-pointer select-none touch-manipulation
                            ${isSelected
                                ? 'text-white scale-110 animate-pulse'
                                : 'bg-white hover:border-blue-600'}
                        `}
                        style={isSelected
                            ? { backgroundColor: colors.accent, borderColor: colors.accent, boxShadow: `0 0 30px ${colors.accent}80` }
                            : { color: colors.heading, borderColor: 'white' }}
                    >
                        {word}
                    </button>
                );
            })}
        </div>

        {/* VALIDATION CTA */}
        <div className="mt-12">
            <button
                onClick={validate}
                disabled={Object.keys(slots).length < correctAnswers.length}
                className={`w-full py-6 md:py-8 font-black uppercase text-xl md:text-2xl tracking-widest transition-all shadow-2xl flex items-center justify-center gap-4 border-none cursor-pointer ${Object.keys(slots).length === correctAnswers.length ? 'text-white hover:brightness-110' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                style={Object.keys(slots).length === correctAnswers.length ? { backgroundColor: colors.accent } : undefined}
            >
                Check Answers <ShieldCheck size={24} />
            </button>
        </div>
    </div>
  );
};