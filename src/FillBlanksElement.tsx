'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, RefreshCcw, XCircle, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LMS_THEME } from './theme';
import { seededShuffleBySeedKey } from './seededShuffle';
import {
  getEventPoint,
  resolveTargetAtPoint,
  useAutoScrollOnDrag,
  usePressDelayDragControls,
} from './dragInteraction';

type BankEntry = { id: string; text: string };
type Origin = { type: 'bank' } | { type: 'slot'; index: number };
type Destination = { type: 'bank' } | { type: 'slot'; index: number };
// A single drop-zone ref map covers both kinds of target -- 'bank' (the
// whole word-bank panel, itself a valid drop target for returning a placed
// word) and `slot:<index>` for each blank -- so the same resolveTargetAtPoint
// utility works unmodified for both.
type ZoneKey = 'bank' | `slot:${number}`;

/**
 * Fill-in-the-blanks interaction. Drag-and-drop on every input (mouse,
 * touch, keyboard), with tap-to-select-then-tap-to-place kept as the
 * always-available single-pointer alternative (WCAG 2.2 SC 2.5.7) -- same
 * model as SortingElement, and built on the SAME shared machinery
 * (`./dragInteraction.ts`), not a second implementation. See
 * SortingElement.tsx's file-level comment for the full history of why that
 * machinery looks the way it does (press-delay drag activation,
 * auto-scroll-while-dragging instead of relying on sticky positioning).
 *
 * Unlike Sorting's two always-visible category zones, a blank's position
 * is wherever it falls in the running sentence -- there's nothing to make
 * sticky here, so auto-scroll-while-dragging is the ONLY reachability
 * mechanism for blanks below the fold, not a secondary one.
 *
 * Bidirectional drag model: a bank word can be dragged onto any blank; a
 * placed word can be dragged onto a DIFFERENT blank (swapping with
 * whatever was already there) or back onto the word bank (returning it,
 * same effect as the existing tap-to-remove). Dragging a word onto an
 * already-filled blank bumps the previous occupant back to the bank
 * rather than losing it or silently rejecting the drop.
 *
 * Marking is unchanged: correctness is still the word TEXT per blank
 * (parts[idx] === slot.text), and Validate is still gated on every blank
 * being filled -- this rewrite only fixes how the bank tracks word
 * IDENTITY (see BankEntry below), never how an answer is checked.
 */
export const FillBlanksElement = ({
  content,
  onComplete,
  enrollmentId,
  stepId,
}: {
  content: any;
  onComplete?: () => void;
  enrollmentId?: string;
  stepId?: string;
}) => {
  const [board, setBoard] = useState<{ bank: BankEntry[]; slots: Record<number, BankEntry> }>({
    bank: [],
    slots: {},
  });
  const [selected, setSelected] = useState<{ entry: BankEntry; origin: Origin } | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error'; text: string } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<ZoneKey | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  const { title, subheading, htmlContent, sentence, distractors } = content;
  const { colors, type } = LMS_THEME;
  const t = useTranslations('FillBlanksElement');

  // 1. SYNTAX PARSING -- unchanged from the original.
  const parts: string[] = (sentence || '').split(/\[(.*?)\]/g);
  const correctAnswers: string[] = parts.filter((_, i) => i % 2 === 1);
  // 1-indexed position among BLANKS ONLY, for human-readable announcements
  // ("Blank 2"), not the raw `parts` index (which also counts plain text).
  const blankNumberByPartIndex = new Map<number, number>();
  parts.forEach((_, i) => {
    if (i % 2 === 1) blankNumberByPartIndex.set(i, blankNumberByPartIndex.size + 1);
  });
  // blankNumberByPartIndex always has an entry for any blank `parts` index
  // this component itself produced -- the `?? 0` is just to satisfy
  // next-intl's (string | number) param typing, never a real fallback.
  const blankNumber = (partIndex: number): number => blankNumberByPartIndex.get(partIndex) ?? 0;

  useEffect(() => {
    const combined: BankEntry[] = [...correctAnswers, ...(distractors || [])].map((text, idx) => ({
      id: `w-${idx}`,
      text,
    }));
    const shuffled = enrollmentId || stepId
      ? seededShuffleBySeedKey(combined, { enrollmentId, stepId: stepId || 'fillblanks', attempt })
      : combined; // no identity at all (shouldn't happen in practice) -- keep authored order rather than guess
    setBoard({ bank: shuffled, slots: {} });
    setSelected(null);
    setIsFinished(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence, distractors, attempt]);

  // --- SHARED STATE TRANSITION: tap, drag and keyboard all call this.
  // Atomic (single setState over the combined bank+slots shape) so a word
  // moving INTO an already-filled blank and the displaced occupant moving
  // OUT to the bank can't race or read a stale half of the board. ---
  const moveWord = useCallback((entry: BankEntry, origin: Origin, destination: Destination) => {
    if (origin.type === 'slot' && destination.type === 'slot' && origin.index === destination.index) return;
    setBoard((prev) => {
      const slots = { ...prev.slots };
      let bank = prev.bank;
      let displaced: BankEntry | null = null;

      if (origin.type === 'slot') delete slots[origin.index];
      else bank = bank.filter((w) => w.id !== entry.id);

      if (destination.type === 'slot') {
        displaced = slots[destination.index] ?? null;
        slots[destination.index] = entry;
      } else {
        bank = [...bank, entry];
      }
      if (displaced) bank = [...bank, displaced];

      return { bank, slots };
    });
  }, []);

  // --- TAP-TO-SELECT-THEN-TAP-TO-PLACE (mouse, touch, or keyboard Enter/Space) ---
  const handleWordSelect = (entry: BankEntry, origin: Origin) => {
    if (isFinished || draggingId) return;
    const next = selected?.entry.id === entry.id ? null : { entry, origin };
    setSelected(next);
    setAnnouncement(next ? t('announcePickedUp', { word: entry.text }) : t('announceCancelled', { word: entry.text }));
  };

  const handleBlankTap = (index: number) => {
    if (isFinished) return;
    const occupant = board.slots[index];
    // Existing behaviour, unchanged: a FILLED blank always removes its word
    // back to the bank, regardless of whether something else is selected.
    if (occupant) {
      moveWord(occupant, { type: 'slot', index }, { type: 'bank' });
      setAnnouncement(t('announceRemoved', { word: occupant.text }));
      return;
    }
    if (selected) {
      moveWord(selected.entry, selected.origin, { type: 'slot', index });
      setAnnouncement(t('announcePlaced', { word: selected.entry.text, number: blankNumber(index) }));
      setSelected(null);
    }
  };

  const handleBankZoneTap = () => {
    if (isFinished || !selected) return;
    // Tapping the bank itself while a PLACED word is selected returns it --
    // the bank-area equivalent of dragging a placed word back to the bank.
    if (selected.origin.type === 'slot') {
      moveWord(selected.entry, selected.origin, { type: 'bank' });
      setAnnouncement(t('announceRemoved', { word: selected.entry.text }));
      setSelected(null);
    }
  };

  // --- DROP ZONES: one ref map for both the bank panel and every blank,
  // so the same resolveTargetAtPoint utility (shared with Sorting) handles
  // both kinds of target without modification. ---
  const zoneRefs = useRef<Map<ZoneKey, HTMLElement>>(new Map());
  const setZoneRef = useCallback((key: ZoneKey, el: HTMLElement | null) => {
    if (el) zoneRefs.current.set(key, el);
    else zoneRefs.current.delete(key);
  }, []);

  const { getDragControls, handlePointerDown: handlePointerDownBase, dragOriginElRef } =
    usePressDelayDragControls<string>();
  const { start: startAutoScroll, reportY: reportDragPointerY, stop: stopAutoScroll } = useAutoScrollOnDrag();

  const handleWordPointerDown = (event: React.PointerEvent, entry: BankEntry) => {
    if (isFinished) return;
    handlePointerDownBase(event, entry.id);
  };

  const resolveZoneAtPoint = (event: MouseEvent | TouchEvent | PointerEvent): ZoneKey | null =>
    resolveTargetAtPoint(zoneRefs.current, getEventPoint(event));

  const handleDragStart = (entry: BankEntry) => {
    if (isFinished) return;
    setDraggingId(entry.id);
    setSelected(null); // drag and tap-select are mutually exclusive states
    setAnnouncement(t('announcePickedUp', { word: entry.text }));
    if (dragOriginElRef.current) startAutoScroll(dragOriginElRef.current);
  };

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent) => {
    const point = getEventPoint(event);
    reportDragPointerY(point.y);
    const zone = resolveZoneAtPoint(event);
    setHoveredZone((prev) => (prev === zone ? prev : zone));
  };

  useEffect(() => {
    if (!draggingId || !hoveredZone) return;
    if (hoveredZone === 'bank') setAnnouncement(t('announceOverBank'));
    else setAnnouncement(t('announceOverBlank', { number: blankNumber(Number(hoveredZone.slice(5))) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredZone, draggingId]);

  const handleDragEnd = (entry: BankEntry, origin: Origin, event: MouseEvent | TouchEvent | PointerEvent) => {
    const zone = resolveZoneAtPoint(event);
    setDraggingId(null);
    setHoveredZone(null);
    stopAutoScroll();
    if (zone === 'bank') {
      if (origin.type === 'slot') {
        moveWord(entry, origin, { type: 'bank' });
        setAnnouncement(t('announceRemoved', { word: entry.text }));
      }
      // origin was already the bank -- dragSnapToOrigin handles the
      // visual snap-back, nothing to change in state.
    } else if (zone && zone.startsWith('slot:')) {
      const index = Number(zone.slice(5));
      moveWord(entry, origin, { type: 'slot', index });
      setAnnouncement(t('announcePlaced', { word: entry.text, number: blankNumber(index) }));
    } else {
      setAnnouncement(t('announceCancelled', { word: entry.text }));
    }
  };

  // --- KEYBOARD: Escape cancels an active tap-selection. ---
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAnnouncement(t('announceCancelled', { word: selected.entry.text }));
        setSelected(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, t]);

  const validate = () => {
    const isAllCorrect = Object.entries(board.slots).every(([idx, entry]) => parts[parseInt(idx)] === entry.text);
    if (isAllCorrect) {
      setIsFinished(true);
      if (onComplete) onComplete();
    } else {
      setFeedback({ type: 'error', text: t('protocolBreach') });
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const restart = () => {
    setAttempt((a) => a + 1); // new attempt -> new seed -> re-shuffled bank, per the brief
  };

  // A draggable word -- used both for bank words and for a placed word
  // shown inside its blank. Both are draggable to any valid destination
  // (bank word -> any blank; placed word -> another blank or back to the
  // bank), but TAP means something different for each, per the brief:
  // tapping a bank word selects it (arm-then-place); tapping a PLACED
  // word is "the existing removal behaviour" -- it always removes,
  // never arms a re-selection -- so moving an already-placed word to a
  // different blank via a single tap isn't offered (only via drag, or via
  // tap-to-remove then re-select from the bank), matching the brief's own
  // interaction list exactly (drag lists placed-word-to-another-blank;
  // tap does not).
  const renderWord = (entry: BankEntry, origin: Origin, variant: 'bank' | 'slot') => {
    const isSelected = variant === 'bank' && selected?.entry.id === entry.id;
    const isDragging = draggingId === entry.id;
    const onTapAction = variant === 'bank'
      ? () => handleWordSelect(entry, origin)
      : () => handleBlankTap((origin as { type: 'slot'; index: number }).index);
    return (
      <motion.button
        key={entry.id}
        type="button"
        layout
        drag={!isFinished}
        dragListener={false}
        dragControls={getDragControls(entry.id)}
        onPointerDown={(event) => handleWordPointerDown(event, entry)}
        dragSnapToOrigin
        dragElastic={0.15}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 28 }}
        whileDrag={{ scale: 1.08, zIndex: 50, boxShadow: '0 20px 40px rgba(0,0,0,0.35)', cursor: 'grabbing' }}
        onDragStart={() => handleDragStart(entry)}
        onDrag={(event) => handleDrag(event as any)}
        onDragEnd={(event) => handleDragEnd(entry, origin, event as any)}
        onTap={onTapAction}
        aria-pressed={variant === 'bank' ? isSelected : undefined}
        aria-label={variant === 'bank'
          ? t('wordAriaLabel', { word: entry.text })
          : t('placedWordAriaLabel', { word: entry.text, number: blankNumber((origin as { type: 'slot'; index: number }).index) })}
        disabled={isFinished}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className={
          variant === 'bank'
            ? `px-6 py-3.5 md:px-8 md:py-5 min-h-11 font-black uppercase text-xs md:text-sm
               transition-all flex items-center gap-2 border-2 cursor-grab active:cursor-grabbing
               select-none`
            : 'inline-flex items-center gap-2 font-bold text-lg md:text-2xl select-none cursor-grab active:cursor-grabbing min-h-11 bg-transparent border-none'
        }
        style={{
          touchAction: isDragging ? 'none' : 'auto',
          opacity: isDragging ? 0.4 : 1,
          ...(variant === 'bank'
            ? (isSelected
                ? { backgroundColor: colors.accent, borderColor: colors.accent, color: '#FFFFFF', boxShadow: `0 0 0 3px ${colors.darkPanel}, 0 0 0 5px ${colors.accent}` }
                : { color: colors.heading, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' })
            : { color: colors.accent }),
        }}
      >
        {variant === 'bank' && <GripVertical size={14} style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : '#CBD5E1' }} />}
        {entry.text}
      </motion.button>
    );
  };

  if (isFinished) return (
    <div className="pb-40 animate-in zoom-in-95 duration-700">
      <div className="p-10 md:p-16 border-l-[16px] bg-white shadow-2xl space-y-8" style={{ borderColor: colors.success }}>
        <div className="flex items-center gap-4" style={{ color: colors.success }}>
          <ShieldCheck size={32} />
          <h2 style={{ ...type.resultHeader, color: colors.heading, margin: 0 }}>{t('correct')}</h2>
        </div>
        <div className="border-t border-slate-100 pt-10" style={{ ...type.quote, color: colors.body }}>
          <p>&quot;{sentence.replace(/\[/g, '').replace(/\]/g, '')}&quot;</p>
        </div>
        <button onClick={restart} className="flex items-center gap-3 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-blue-600 transition-all bg-transparent border-none cursor-pointer">
          <RefreshCcw size={14} /> {t('resetInteraction')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-1000 w-full pb-40 overflow-x-hidden text-left">
      <div aria-live="polite" className="sr-only">{announcement}</div>

      <div className="mb-4 text-left">
        {title && <h1 style={{ ...type.h2, color: colors.heading, margin: 0 }}>{title}</h1>}
      </div>
      <p style={{ fontSize: '14px', fontWeight: 500, color: colors.body }} className="mb-10">
        {t('interactionHint')}
      </p>
      {subheading && (
        <div className="border-l-4 pl-8 py-2 mb-12 text-left" style={{ borderColor: colors.accent }}>
          <span style={{ ...type.h3, color: colors.heading }}>{subheading}</span>
        </div>
      )}

      {htmlContent && <div className="prose prose-slate max-w-none leading-relaxed font-medium mb-16 text-left" style={{ fontSize: type.body.fontSize, color: colors.body }} dangerouslySetInnerHTML={{ __html: htmlContent }} />}

      {/* INTERACTION STAGE */}
      <div className="relative p-8 md:p-16 bg-white border border-slate-200 shadow-2xl mb-12 text-left">
        <div className="text-lg md:text-2xl font-bold flex flex-wrap gap-x-4 gap-y-8 items-baseline" style={{ color: colors.heading }}>
          {parts.map((part: string, i: number) => {
            if (i % 2 === 0) return <span key={i}>{part}</span>;

            const occupant = board.slots[i];
            const isHovered = hoveredZone === (`slot:${i}` as ZoneKey) && !!draggingId;
            const blankNum = blankNumber(i);
            return (
              <motion.span
                key={i}
                layout
                ref={(el) => setZoneRef(`slot:${i}` as ZoneKey, el as HTMLElement | null)}
                className={`
                  inline-flex min-w-[160px] md:min-w-[280px] min-h-11 h-12 md:h-16 border-b-[6px] md:border-b-[10px]
                  transition-all justify-center items-center px-4 border-x-0 border-t-0
                  ${occupant ? 'bg-transparent' : isHovered ? 'bg-blue-50' : 'bg-[#F8FAFC] border-[#F1F5F9] hover:bg-blue-50'}
                  ${isHovered ? 'border-2 border-dashed' : ''}
                `}
                style={occupant ? { borderColor: colors.heading } : isHovered ? { borderColor: colors.accent } : undefined}
              >
                {occupant ? (
                  renderWord(occupant, { type: 'slot', index: i }, 'slot')
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBlankTap(i)}
                    aria-label={t('blankAriaLabel', { number: blankNum })}
                    className="text-slate-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 bg-transparent border-none cursor-pointer w-full h-full justify-center"
                  >
                    {t('tapSlot')}
                  </button>
                )}
              </motion.span>
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

      {/* WORD BANK -- itself a drop zone, for returning a placed word. */}
      <div
        ref={(el) => setZoneRef('bank', el as HTMLElement | null)}
        onClick={handleBankZoneTap}
        role="group"
        aria-label={t('bankAriaLabel')}
        className={`p-8 md:p-12 shadow-2xl flex flex-wrap justify-center gap-4 md:gap-6 relative min-h-[120px] transition-colors
          ${hoveredZone === 'bank' && draggingId ? 'ring-2 ring-dashed' : ''}`}
        style={{ backgroundColor: colors.darkPanel, ...(hoveredZone === 'bank' && draggingId ? { boxShadow: `inset 0 0 0 2px ${colors.accent}` } : undefined) }}
      >
        <div className="absolute top-3 left-6 text-[8px] font-black text-white/30 uppercase tracking-[0.5em]">{t('availableOptions')}</div>
        <AnimatePresence>
          {board.bank.map((entry) => renderWord(entry, { type: 'bank' }, 'bank'))}
        </AnimatePresence>
      </div>

      {/* VALIDATION CTA */}
      <div className="mt-12">
        <button
          onClick={validate}
          disabled={Object.keys(board.slots).length < correctAnswers.length}
          className={`w-full py-6 md:py-8 font-black uppercase text-xl md:text-2xl tracking-widest transition-all shadow-2xl flex items-center justify-center gap-4 border-none cursor-pointer ${Object.keys(board.slots).length === correctAnswers.length ? 'text-white hover:brightness-110' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
          style={Object.keys(board.slots).length === correctAnswers.length ? { backgroundColor: colors.accent } : undefined}
        >
          {t('checkAnswers')} <ShieldCheck size={24} />
        </button>
      </div>
    </div>
  );
};
