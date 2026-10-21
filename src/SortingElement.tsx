'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  ShieldCheck,
  CheckCircle2,
  Zap,
  RefreshCcw,
  RotateCcw,
  GripVertical,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { LMS_THEME } from './theme';
import { seededShuffleBySeedKey } from './seededShuffle';

/**
 * Sorting / classification interaction. Drag-and-drop on every input
 * (mouse, touch, keyboard), with tap-to-select-then-tap-to-assign kept as
 * the always-available single-pointer alternative (WCAG 2.2 SC 2.5.7) --
 * both modes work simultaneously, no mode switch, no device detection.
 *
 * Built on Framer Motion's own `drag` (pointer-events-based), not a
 * separate DnD library. @dnd-kit was tried here before (see git history,
 * commits 41ac306/76a620e/ef8ea38, March 2026) with a fully-correct-looking
 * TouchSensor configuration (activationConstraint delay+tolerance,
 * touch-action: none) and still failed on real mobile devices with
 * "mobile viewport loss" (the page scrolling/jumping during what should be
 * a controlled drag) -- framer-motion is already a dependency of every
 * element in this player, is Pointer-Events-based (no separate touch
 * sensor to misconfigure), and @dnd-kit itself hasn't shipped a release
 * since Dec 2024, so there is no newer version to retry with.
 *
 * Marking is unaffected by any of this: correctness is still a plain
 * category-string match (never positional), so shuffling display order is
 * safe without any change to how an answer is checked -- unlike the
 * quiz-answer-position-bias work, which has to change marking logic to
 * survive a shuffle.
 */
export const SortingElement = ({
    content,
    onComplete,
    enrollmentId,
    stepId
}: {
    content: any,
    onComplete?: () => void,
    enrollmentId?: string,
    stepId?: string
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [bucketFeedback, setBucketFeedback] = useState<Record<string, 'success' | 'error' | null>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  const { instruction, subheading, htmlContent, closeoutText, categories, items: rawItems } = content;
  const { colors, type } = LMS_THEME;
  const t = useTranslations('SortingElement');
  const totalItems = rawItems?.length || 0;

  const categoryRefs = useRef<Map<string, HTMLElement>>(new Map());
  const setCategoryRef = useCallback((cat: string, el: HTMLElement | null) => {
    if (el) categoryRefs.current.set(cat, el);
    else categoryRefs.current.delete(cat);
  }, []);

  useEffect(() => {
    if (rawItems) {
      const tagged = rawItems.map((it: any, idx: number) => ({ ...it, id: `it-${idx}` }));
      const shuffled = enrollmentId || stepId
        ? seededShuffleBySeedKey(tagged, { enrollmentId, stepId: stepId || 'sorting', attempt })
        : tagged; // no identity at all (shouldn't happen in practice) -- keep authored order rather than guess
      setItems(shuffled);
      setIsFinished(false);
      setSelectedItem(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, rawItems, attempt]);

  // --- SHARED MARKING PATH: drag, tap and keyboard all call this. ---
  const handleAssign = useCallback((item: any, category: string) => {
    if (!item || isFinished) return;

    if (item.category === category) {
      setBucketFeedback({ [category]: 'success' });
      setAnnouncement(t('announceCorrect', { item: item.text, category }));

      setTimeout(() => {
        setItems((prev) => {
          const remaining = prev.filter((it) => it.id !== item.id);
          if (remaining.length === 0) {
            setIsFinished(true);
            if (onComplete) onComplete();
          }
          return remaining;
        });
        setSelectedItem(null);
        setBucketFeedback({});
      }, 600);
    } else {
      setBucketFeedback({ [category]: 'error' });
      setAnnouncement(t('announceIncorrect', { item: item.text, category }));
      setTimeout(() => setBucketFeedback({}), 1000);
    }
  }, [isFinished, onComplete, t]);

  // --- TAP-TO-SELECT-THEN-TAP-TO-ASSIGN (mouse, touch, or keyboard Enter/Space) ---
  const handleItemSelect = (item: any) => {
    if (isFinished || draggingId) return;
    const next = selectedItem?.id === item.id ? null : item;
    setSelectedItem(next);
    setAnnouncement(next ? t('announcePickedUp', { item: item.text }) : t('announceCancelled', { item: item.text }));
  };

  const handleBucketAssign = (category: string) => {
    if (!selectedItem || isFinished) return;
    handleAssign(selectedItem, category);
  };

  // --- DRAG: resolve which category (if any) the pointer is over, from
  // the raw event -- clientX/clientY, not PanInfo.point, so it lines up
  // with getBoundingClientRect() (viewport-relative) regardless of scroll
  // position. Works for mouse, pointer and touch events: touch events
  // carry coordinates on touches/changedTouches, not directly on the event.
  const resolveCategoryAtPoint = (event: MouseEvent | TouchEvent | PointerEvent): string | null => {
    // The DOM Touch interface has clientX/clientY, not x/y -- caught by
    // tsc, not by any test (jsdom's synthetic touch events in this test
    // suite all went through clientX/clientY directly on the event, so a
    // {x,y}-shaped read here would have silently resolved to `undefined`
    // on every real touchscreen without a single test catching it).
    const touch = 'touches' in event ? (event.touches[0] || event.changedTouches[0]) : null;
    const point = touch
      ? { x: touch.clientX, y: touch.clientY }
      : { x: (event as MouseEvent | PointerEvent).clientX, y: (event as MouseEvent | PointerEvent).clientY };
    for (const [cat, el] of categoryRefs.current) {
      const r = el.getBoundingClientRect();
      if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) return cat;
    }
    return null;
  };

  const handleDragStart = (item: any) => {
    if (isFinished) return;
    setDraggingId(item.id);
    setSelectedItem(null); // drag and tap-select are mutually exclusive states
    setAnnouncement(t('announcePickedUp', { item: item.text }));
  };

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent) => {
    const cat = resolveCategoryAtPoint(event);
    setHoveredCategory((prev) => (prev === cat ? prev : cat)); // only re-render on an actual zone change
  };

  // Announce zone entry only when hoveredCategory actually changes, not on
  // every pointermove -- continuous announcements would be unusable noise
  // for a screen-reader user, even though the requirement is "announce
  // over-zone".
  useEffect(() => {
    if (draggingId && hoveredCategory) {
      const item = items.find((it) => it.id === draggingId);
      if (item) setAnnouncement(t('announceOverZone', { category: hoveredCategory }));
    }
  }, [hoveredCategory, draggingId, items, t]);

  const handleDragEnd = (item: any, event: MouseEvent | TouchEvent | PointerEvent) => {
    const cat = resolveCategoryAtPoint(event);
    setDraggingId(null);
    setHoveredCategory(null);
    if (cat) {
      handleAssign(item, cat);
    } else {
      setAnnouncement(t('announceCancelled', { item: item.text }));
    }
    // No zone hit: dragSnapToOrigin (set on the item below) animates it back
    // to its flex position on its own -- nothing else to do here.
  };

  // --- KEYBOARD: Escape cancels an active tap-selection. ---
  useEffect(() => {
    if (!selectedItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAnnouncement(t('announceCancelled', { item: selectedItem.text }));
        setSelectedItem(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedItem, t]);

  const restart = () => {
    setAttempt((a) => a + 1); // new attempt -> new seed -> re-shuffled order, per the brief
    setIsFinished(false);
  };

  if (isFinished) return (
    <div className="pb-40 space-y-12 animate-in zoom-in-95 duration-700 text-left">
        <div className="p-10 md:p-16 border-l-[16px] bg-white shadow-2xl space-y-8" style={{ borderColor: colors.success }}>
           <div className="flex items-center gap-4" style={{ color: colors.success }}>
              <ShieldCheck size={48} />
              <h2 style={{ ...type.resultHeader, color: colors.heading, margin: 0 }}>{t('wellDone')}</h2>
           </div>
           <div
                className="prose prose-slate max-w-none font-medium leading-relaxed"
                style={{ fontSize: type.body.fontSize, color: colors.body }}
                dangerouslySetInnerHTML={{ __html: closeoutText || t('closeoutFallback') }}
            />
        </div>
        <button
            onClick={restart}
            className="flex items-center gap-3 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-blue-600 bg-transparent border-none cursor-pointer transition-colors"
        >
            <RefreshCcw size={14}/> {t('restartAssessment')}
        </button>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-700 text-left pb-40">

      {/* Visually-hidden live region: pick-up, over-zone and drop/cancel
          announcements, shared by drag, tap and keyboard paths. */}
      <div aria-live="polite" className="sr-only">{announcement}</div>

      {/* 1. HEADERS (Standardized) */}
      <div className="mb-4">
        <h1 style={{ ...type.h2, color: colors.heading, margin: 0 }}>
            {instruction || t('instructionFallback')}
        </h1>
      </div>
      <p style={{ fontSize: '14px', fontWeight: 500, color: colors.body }} className="mb-10">
        {t('interactionHint')}
      </p>

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

      {/* 2. TARGET BUCKETS -- sticky, so they stay reachable while scrolling
          through the item reservoir below on a short mobile viewport,
          without needing auto-scroll-during-drag. top-2 clears this
          player's own sticky chrome (see CoursePlayer's header, which sits
          above this content area, not inside it, so a small offset is
          enough here). */}
      <div className="sticky top-2 z-30 grid grid-cols-2 gap-3 md:gap-8 mb-10 md:mb-16">
        {categories?.map((cat: string) => {
          const feedback = bucketFeedback[cat];
          const isArmed = !!selectedItem && !feedback;
          const isDropTarget = !!draggingId && !feedback;
          const isHovered = hoveredCategory === cat && isDropTarget;
          return (
            <button
              key={cat}
              ref={(el) => setCategoryRef(cat, el)}
              type="button"
              onClick={() => handleBucketAssign(cat)}
              aria-label={t('categoryAriaLabel', { category: cat })}
              className={`
                relative min-h-[120px] md:min-h-[220px] p-4 md:p-8 transition-all duration-300 text-center
                flex flex-col items-center justify-center overflow-hidden cursor-pointer border backdrop-blur-sm
                ${feedback === 'success' ? 'border-2 border-emerald-500 bg-emerald-50/95 shadow-md' :
                  feedback === 'error' ? 'border-2 border-red-400 bg-red-50/95 shadow-md animate-shake' :
                  isHovered ? 'border-2 shadow-lg bg-blue-50/80 scale-[1.03]' :
                  isArmed ? 'border-2 shadow-md bg-blue-50/70' :
                  isDropTarget ? 'border-2 border-dashed bg-white/90 shadow-sm' :
                  'border-slate-200 bg-white/90 shadow-sm hover:border-slate-300 hover:shadow-md'}
              `}
              style={(isArmed || isHovered) && !feedback ? { borderColor: colors.accent } : isDropTarget ? { borderColor: `${colors.accent}80` } : undefined}
            >
              {(isArmed || isHovered) && (
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: colors.accent }} />
              )}

              <AnimatePresence mode="wait">
                {feedback === 'success' ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <CheckCircle2 size={32} className="text-emerald-500" />
                    <span style={{ ...type.label, color: '#059669' }}>{t('correct')}</span>
                  </motion.div>
                ) : feedback === 'error' ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <XCircle size={32} className="text-red-500" />
                    <span style={{ ...type.label, color: '#dc2626' }}>{t('incorrect')}</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    animate={{ scale: isArmed || isHovered ? 1.03 : 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  >
                    <div
                      className="mx-auto mb-2 md:mb-4 w-9 h-9 md:w-12 md:h-12 flex items-center justify-center border transition-colors"
                      style={(isArmed || isHovered) ? { borderColor: colors.accent, backgroundColor: `${colors.accent}14` } : { borderColor: '#E2E8F0' }}
                    >
                      <Zap size={16} style={{ color: (isArmed || isHovered) ? colors.accent : '#CBD5E1' }} />
                    </div>
                    {/* A styled span, not a heading -- this is a button
                        label, not a document heading, and axe correctly
                        flagged the previous <h3> here as a heading-order
                        skip (h1 -> h3 with no h2 anywhere on this step;
                        pre-existing, not introduced by this change). */}
                    <span style={{ ...type.h3, color: colors.heading, margin: 0, fontSize: 'clamp(13px, 3vw, 18px)' }} className="block">{cat}</span>
                    {isArmed && (
                      <motion.p
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 md:mt-4 inline-block px-2 py-1 border text-[9px] md:text-[11px]"
                        style={{ color: colors.accent, borderColor: colors.accent }}
                      >
                        {t('tapToAssign')}
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
          {t('wordOptions')}
        </div>
        {totalItems > 0 && (
          <div style={{ ...type.label, color: 'rgba(255,255,255,0.3)' }} className="absolute top-4 right-6">
            {t('sortedCounter', { sorted: totalItems - items.length, total: totalItems })}
          </div>
        )}

        <AnimatePresence>
          {items.map((item) => {
            const isSelected = selectedItem?.id === item.id;
            const isDragging = draggingId === item.id;
            return (
              <motion.button
                key={item.id}
                type="button"
                layout
                drag={!isFinished}
                dragSnapToOrigin
                dragElastic={0.15}
                dragTransition={{ bounceStiffness: 500, bounceDamping: 28 }}
                whileDrag={{ scale: 1.08, zIndex: 50, boxShadow: '0 20px 40px rgba(0,0,0,0.35)', cursor: 'grabbing' }}
                onDragStart={() => handleDragStart(item)}
                onDrag={(event) => handleDrag(event as any)}
                onDragEnd={(event) => handleDragEnd(item, event as any)}
                // onTap, not onClick: framer-motion's own gesture recognizer
                // disambiguates tap vs. drag, and ALREADY handles Enter/Space
                // keyboard activation internally for a pressable motion
                // component by synthesizing the same tap gesture -- adding a
                // separate onKeyDown here double-fired (confirmed: it
                // toggled selection on, then immediately back off, net no
                // visible change, caught by the keyboard test).
                onTap={() => handleItemSelect(item)}
                aria-pressed={isSelected}
                aria-label={t('itemAriaLabel', { item: item.text })}
                disabled={isFinished}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className="relative px-5 py-3.5 md:px-6 transition-shadow font-bold tracking-tight select-none
                  flex items-center gap-2 border cursor-grab active:cursor-grabbing hover:-translate-y-0.5"
                style={{
                  fontSize: type.body.fontSize,
                  transitionDuration: '200ms',
                  touchAction: 'none',
                  opacity: isDragging ? 0.4 : 1,
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
                <GripVertical size={14} style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : '#CBD5E1' }} />
                {item.text}
              </motion.button>
            );
          })}
        </AnimatePresence>

        {items.length === 0 && !isFinished && (
            <div className="flex flex-col items-center gap-4 text-slate-500 uppercase font-bold text-xs animate-pulse">
                <RotateCcw className="animate-spin" size={20} /> {t('loading')}
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
