'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Zap,
  RefreshCcw,
  RotateCcw,
  MousePointer2,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LMS_THEME } from './theme';

/**
 * Sorting / classification interaction — tap-to-select an item, tap a
 * category to assign it. Restyled for a cleaner, more considered feel:
 * bordered cards instead of dashed placeholder boxes, a crisp accent ring
 * on the selected chip instead of a diffuse glow, and spring-based motion
 * instead of default CSS keyframes.
 */
export const SortingElement = ({
    content,
    onComplete
}: {
    content: any,
    onComplete?: () => void
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [bucketFeedback, setBucketFeedback] = useState<Record<string, 'success' | 'error' | null>>({});
  const [isFinished, setIsFinished] = useState(false);

  const { instruction, subheading, htmlContent, closeoutText, categories, items: rawItems } = content;
  const { colors, type } = LMS_THEME;
  const totalItems = rawItems?.length || 0;

  useEffect(() => {
    if (rawItems) {
      setItems(rawItems.map((it: any, idx: number) => ({ ...it, id: `it-${idx}` })));
      setIsFinished(false);
      setSelectedItem(null);
    }
  }, [content, rawItems]);

  // --- INTERACTION LOGIC ---
  const handleItemSelect = (item: any) => {
    if (isFinished) return;
    setSelectedItem(selectedItem?.id === item.id ? null : item);
  };

  const handleBucketAssign = (category: string) => {
    if (!selectedItem || isFinished) return;

    if (selectedItem.category === category) {
      // SUCCESS LOGIC
      setBucketFeedback({ [category]: 'success' });

      setTimeout(() => {
        const remaining = items.filter(it => it.id !== selectedItem.id);
        setItems(remaining);
        setSelectedItem(null);
        setBucketFeedback({});

        if (remaining.length === 0) {
          setIsFinished(true);
          if (onComplete) onComplete();
        }
      }, 600);

    } else {
      // ERROR LOGIC
      setBucketFeedback({ [category]: 'error' });
      setTimeout(() => setBucketFeedback({}), 1000);
    }
  };

  if (isFinished) return (
    <div className="pb-40 space-y-12 animate-in zoom-in-95 duration-700 text-left">
        <div className="p-10 md:p-16 border-l-[16px] bg-white shadow-2xl space-y-8" style={{ borderColor: colors.success }}>
           <div className="flex items-center gap-4" style={{ color: colors.success }}>
              <ShieldCheck size={48} />
              <h2 style={{ ...type.resultHeader, color: colors.heading, margin: 0 }}>Well Done!</h2>
           </div>
           <div
                className="prose prose-slate max-w-none font-medium leading-relaxed"
                style={{ fontSize: type.body.fontSize, color: colors.body }}
                dangerouslySetInnerHTML={{ __html: closeoutText || "Task successfully completed." }}
            />
        </div>
        <button
            onClick={() => { setItems(rawItems.map((it: any, idx: number) => ({ ...it, id: `it-${idx}` }))); setIsFinished(false); }}
            className="flex items-center gap-3 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-blue-600 bg-transparent border-none cursor-pointer transition-colors"
        >
            <RefreshCcw size={14}/> Restart Assessment
        </button>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-700 text-left pb-40">

      {/* 1. HEADERS (Standardized) */}
      <div className="mb-10">
        <h1 style={{ ...type.h2, color: colors.heading, margin: 0 }}>
            {instruction || 'Logic Classification'}
        </h1>
      </div>

      {subheading && (
        <div className="border-l-4 pl-8 py-2 mb-12" style={{ borderColor: colors.accent }}>
            <h3 style={{ ...type.h3, color: colors.heading, margin: 0 }}>
                {subheading}
            </h3>
        </div>
      )}

      {htmlContent && (
          <div
              className="prose prose-slate max-w-none leading-relaxed font-medium mb-16"
              style={{ fontSize: type.body.fontSize, color: colors.body }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
      )}

      {/* 2. TARGET BUCKETS (Feedback Zones) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-16">
        {categories?.map((cat: string) => {
          const feedback = bucketFeedback[cat];
          const isArmed = !!selectedItem && !feedback;
          return (
            <button
              key={cat}
              onClick={() => handleBucketAssign(cat)}
              className={`
                relative min-h-[220px] p-8 transition-all duration-300 text-center
                flex flex-col items-center justify-center overflow-hidden cursor-pointer border
                ${feedback === 'success' ? 'border-2 border-emerald-500 bg-emerald-50 shadow-md' :
                  feedback === 'error' ? 'border-2 border-red-400 bg-red-50 shadow-md animate-shake' :
                  isArmed ? 'border-2 shadow-md bg-blue-50/40' : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md'}
              `}
              style={isArmed && !feedback ? { borderColor: colors.accent } : undefined}
            >
              {isArmed && (
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: colors.accent }} />
              )}

              <AnimatePresence mode="wait">
                {feedback === 'success' ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <CheckCircle2 size={44} className="text-emerald-500" />
                    <span style={{ ...type.label, color: '#059669' }}>Correct</span>
                  </motion.div>
                ) : feedback === 'error' ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <XCircle size={44} className="text-red-500" />
                    <span style={{ ...type.label, color: '#dc2626' }}>Incorrect</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    animate={{ scale: isArmed ? 1.03 : 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  >
                    <div
                      className="mx-auto mb-4 w-12 h-12 flex items-center justify-center border transition-colors"
                      style={isArmed ? { borderColor: colors.accent, backgroundColor: `${colors.accent}14` } : { borderColor: '#E2E8F0' }}
                    >
                      <Zap size={20} style={{ color: isArmed ? colors.accent : '#CBD5E1' }} />
                    </div>
                    <h3 style={{ ...type.h3, color: colors.heading, margin: 0 }}>{cat}</h3>
                    {isArmed && (
                      <motion.p
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 inline-block px-3 py-1 border"
                        style={{ ...type.label, color: colors.accent, borderColor: colors.accent }}
                      >
                        Tap to Assign
                      </motion.p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      {/* 3. ITEM RESERVOIR */}
      <div className="p-8 md:p-12 shadow-xl flex flex-wrap justify-center gap-4 min-h-[180px] items-center relative" style={{ backgroundColor: colors.darkPanel }}>
        <div style={{ ...type.label, color: 'rgba(255,255,255,0.3)' }} className="absolute top-4 left-6">
          Word Options
        </div>
        {totalItems > 0 && (
          <div style={{ ...type.label, color: 'rgba(255,255,255,0.3)' }} className="absolute top-4 right-6">
            {totalItems - items.length} / {totalItems} Sorted
          </div>
        )}

        <AnimatePresence>
          {items.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            return (
              <motion.button
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                onClick={() => handleItemSelect(item)}
                className={`
                  relative px-6 py-3.5 transition-shadow font-bold tracking-tight
                  flex items-center gap-2.5 border cursor-pointer hover:-translate-y-0.5
                `}
                style={{
                  fontSize: type.body.fontSize,
                  transitionDuration: '200ms',
                  ...(isSelected
                    ? {
                        backgroundColor: colors.accent,
                        borderColor: colors.accent,
                        color: '#FFFFFF',
                        boxShadow: `0 0 0 3px ${colors.darkPanel}, 0 0 0 5px ${colors.accent}`
                      }
                    : {
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E8F0',
                        color: colors.heading,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                      })
                }}
              >
                <MousePointer2 size={14} style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : '#CBD5E1' }} />
                {item.text}
              </motion.button>
            );
          })}
        </AnimatePresence>

        {items.length === 0 && !isFinished && (
            <div className="flex flex-col items-center gap-4 text-slate-500 uppercase font-bold text-xs animate-pulse">
                <RotateCcw className="animate-spin" size={20} /> Loading...
            </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.35s ease-in-out; }
      `}</style>
    </div>
  );
};
