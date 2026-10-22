'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle, ShieldCheck, ChevronRight, RotateCcw, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LMS_THEME } from './theme';
import { seededShuffleBySeedKey } from './seededShuffle';

/**
 * XR2TRAIN KNOWLEDGE CHECK (v8.7 Platinum - COMPACT VIEW)
 * Authority: LMS Portal Node (Port 3002)
 * Fix: Tightened answer blocks and reduced question sizing for viewport optimization.
 * Standard: UNTRUNCATED.
 *
 * Answer-position bias fix: a platform-wide scan found correct answers
 * landing at a single option position far more often than chance (81.2%
 * platform-wide; as high as 91.9% on specific courses) -- a predictable
 * pattern a learner can exploit without knowing the content. Each
 * question's options (and each option's own feedback, which must move
 * WITH it) are now shuffled independently, seeded from
 * enrollment + step + question id (falling back to the question's index
 * when it has no id) + attempt -- stable within one attempt, reshuffled on
 * retry, using the same shared seededShuffle utility SortingElement and
 * FillBlanksElement already use (not a second implementation).
 *
 * Marking is shuffle-safe by construction: each option is tagged with its
 * ORIGINAL authored index before shuffling, and that tag -- not the
 * option's displayed position -- is what's compared against
 * question.correctIndex. VideoElement's embedded knowledge check reuses
 * this component directly, so "video-question shuffle" needs no separate
 * implementation.
 *
 * No shuffle at all (authored order kept) when there's no identity to seed
 * from (enrollmentId/stepId both missing, e.g. a context that genuinely
 * has neither) -- same "don't guess" rule as the other two elements.
 */
export const QuizElement = ({
    content,
    template,
    onComplete,
    enrollmentId,
    stepId
}: {
    content: any,
    template?: any,
    onComplete?: (score: number) => void,
    enrollmentId?: string,
    stepId?: string
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [isAssessmentPassed, setIsAssessmentPassed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const { colors, type } = LMS_THEME;
  const t = useTranslations('QuizElement');

  // The quiz paginates internally (question to question) without changing
  // CoursePlayer's own step index, so the outer scroll-reset effect never
  // fires here — reset the nearest scrollable ancestor ourselves.
  useEffect(() => {
    rootRef.current?.closest('.overflow-y-auto')?.scrollTo({ top: 0 });
  }, [currentIdx]);

  const rawQuestions = content.questions || [];

  // Tag each option with its ORIGINAL authored index (and its own
  // feedback entry, if feedback is per-option) before shuffling, so
  // marking and feedback both survive the reorder -- "move as a unit".
  const questions = useMemo(() => {
    return rawQuestions.map((q: any, qIdx: number) => {
      const questionSeedId = q?.id ?? `q${qIdx}`;
      const taggedOptions = (q?.options || []).map((opt: string, i: number) => ({
        originalIndex: i,
        text: opt,
        feedback: Array.isArray(q?.feedback) ? q.feedback[i] : undefined,
      }));
      const shuffledOptions = enrollmentId || stepId
        ? seededShuffleBySeedKey(taggedOptions, { enrollmentId, stepId: stepId || 'quiz', questionId: String(questionSeedId), attempt })
        : taggedOptions; // no identity at all (shouldn't happen in practice) -- keep authored order rather than guess
      return { ...q, shuffledOptions };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawQuestions, enrollmentId, stepId, attempt]);

  const currentQuestion = questions[currentIdx];

  if (!currentQuestion) return (
    <div className="p-40 border-4 border-dashed border-slate-100 text-center text-slate-200 font-black uppercase tracking-[0.4em] italic rounded-none">
        {t('awaitingAssessment')}
    </div>
  );

  const handleSelect = (idx: number) => {
    if (showFeedback) return;
    setSelectedIdx(idx);
  };

  const checkAnswer = () => {
    setShowFeedback(true);
    // selectedIdx is the DISPLAYED (shuffled) position -- correctness is
    // the originally-authored index that option carries with it, not its
    // position on screen.
    const selectedEntry = selectedIdx !== null ? currentQuestion.shuffledOptions[selectedIdx] : null;
    if (selectedEntry?.originalIndex === currentQuestion.correctIndex) {
        setCorrectCount(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    const isLastQuestion = currentIdx === questions.length - 1;
    
    if (!isLastQuestion) {
      setCurrentIdx(prev => prev + 1);
      setSelectedIdx(null);
      setShowFeedback(false);
    } else {
      const finalScore = Math.round((correctCount / questions.length) * 100);
      if (finalScore >= (content.passScore || 80)) {
        setIsAssessmentPassed(true);
        if (onComplete) onComplete(finalScore);
      }
    }
  };

  const selectedEntry = selectedIdx !== null ? currentQuestion.shuffledOptions[selectedIdx] : null;
  const isUserCorrect = selectedEntry?.originalIndex === currentQuestion.correctIndex;
  const finalScoreResult = Math.round((correctCount / questions.length) * 100);

  // --- RENDER: PASS VIEW (Simplified 'Well Done' block) ---
  if (isAssessmentPassed) {
    return (
        <div className="pb-40">
            <div className="p-16 border-l-[16px] bg-emerald-50 shadow-xl space-y-6" style={{ borderColor: colors.success }}>
                <div className="flex items-center gap-4" style={{ color: colors.success }}>
                    <ShieldCheck size={32} />
                    <h2 style={{ ...type.resultHeader, color: colors.heading, margin: 0 }}>
                        {t('wellDone')}
                    </h2>
                </div>
                <p style={{ color: colors.body, fontSize: type.body.fontSize }} className="font-medium leading-relaxed">
                    {t('passedMessage', { score: finalScoreResult })}
                </p>
                <div className="p-4 text-[10px] font-black uppercase tracking-[0.4em] inline-block shadow-md text-white leading-none" style={{ backgroundColor: colors.darkPanel }}>
                    {t('successRecorded')}
                </div>
            </div>
        </div>
    );
  }

  // --- RENDER: FAIL VIEW (Simplified 'Try Again' block) ---
  if (showFeedback && currentIdx === questions.length - 1 && finalScoreResult < (content.passScore || 80)) {
    return (
        <div className="pb-40">
            <div className="p-16 border-l-[16px] bg-red-50 shadow-xl space-y-8" style={{ borderColor: colors.danger }}>
                <div className="flex items-center gap-4 text-red-600">
                    <XCircle size={32} />
                    <h2 style={{ ...type.resultHeader, color: colors.heading, margin: 0 }}>
                        {t('tryAgain')}
                    </h2>
                </div>
                <p style={{ color: colors.body, fontSize: type.body.fontSize }} className="font-medium leading-relaxed">
                    {t('failMessage', { score: finalScoreResult, passScore: content.passScore || 80 })}
                </p>
                <button
                    onClick={() => {
                        setCurrentIdx(0); setSelectedIdx(null); setShowFeedback(false); setCorrectCount(0);
                        setAttempt((a) => a + 1); // new attempt -> new seed -> re-shuffled options per question
                    }}
                    className="px-10 py-5 text-white font-black uppercase text-[10px] tracking-widest flex items-center gap-3 hover:brightness-110 transition-all shadow-xl border-none cursor-pointer leading-none"
                    style={{ backgroundColor: colors.heading }}
                >
                    <RotateCcw size={16} /> {t('retakeQuiz')}
                </button>
            </div>
        </div>
    );
  }

  // --- RENDER: ACTIVE ASSESSMENT STAGE ---
  return (
    <div ref={rootRef} className="animate-in fade-in duration-700 text-left w-full pb-20">

      {/* 1. COMPACT HEADER AUTHORITY */}
      <div className="mb-8">
        <div className="flex items-baseline gap-4 mb-4 leading-none">
            <span style={{ ...type.label, color: colors.accent }} className="block">
                {t('questionCounter', { current: currentIdx + 1, total: questions.length })}
            </span>
        </div>
        <h2 style={{ ...type.h2, color: colors.heading, margin: 0 }}>
            {currentQuestion.question}
        </h2>
      </div>

      {/* 2. TIGHTENED RESPONSE MATRIX -- displayed (shuffled) order; each
          entry still carries its own ORIGINAL authored index for marking. */}
      <div className="grid grid-cols-1 gap-3 mb-10">
        {currentQuestion.shuffledOptions.map((entry: { originalIndex: number; text: string; feedback?: string }, i: number) => {
          const isActuallyCorrect = entry.originalIndex === currentQuestion.correctIndex;
          const wasSelected = selectedIdx === i;

          return (
            <button
              key={entry.originalIndex}
              onClick={() => handleSelect(i)}
              disabled={showFeedback}
              className={`p-6 text-left border-2 transition-all flex justify-between items-center cursor-pointer
                ${wasSelected ? 'shadow-lg' : 'hover:border-slate-300'}
                ${showFeedback && isActuallyCorrect ? 'border-emerald-500 bg-emerald-50/30' : ''}
                ${showFeedback && wasSelected && !isActuallyCorrect ? 'border-red-500 bg-red-50/30' : ''}
              `}
              style={{
                borderColor: wasSelected && !showFeedback ? colors.accent : (showFeedback && (isActuallyCorrect || wasSelected) ? '' : '#F1F5F9'),
                backgroundColor: wasSelected && !showFeedback ? '#F8FAFC' : ''
              }}
            >
              <span style={{ color: colors.heading }} className="text-xl font-bold tracking-tighter leading-tight">
                {entry.text}
              </span>
              <div className="flex items-center gap-4">
                  {showFeedback && isActuallyCorrect && <CheckCircle2 className="text-emerald-600" size={28} />}
                  {showFeedback && wasSelected && !isActuallyCorrect && <XCircle className="text-red-600" size={28} />}
                  {!showFeedback && wasSelected && <div className="w-3 h-3" style={{ backgroundColor: colors.accent }} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. COMPACT FOOTER ACTIONS */}
      {!showFeedback ? (
        <button
          onClick={checkAnswer}
          disabled={selectedIdx === null}
          className="w-full py-6 text-white font-black uppercase tracking-[0.3em] transition-all disabled:opacity-10 shadow-xl flex items-center justify-center gap-4 hover:brightness-110 active:scale-[0.99] border-none cursor-pointer leading-none text-[10px]"
          style={{ backgroundColor: colors.heading }}
        >
          {t('submit')} <ShieldCheck size={18} />
        </button>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div
                className={`p-8 border-l-[16px] shadow-xl`}
                style={{
                    backgroundColor: isUserCorrect ? '#F0FDF4' : '#FEF2F2',
                    borderColor: isUserCorrect ? colors.success : colors.danger
                }}
            >
                <div className="flex items-center gap-4 mb-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.4em] leading-none" style={{ color: colors.heading }}>
                        {isUserCorrect ? t('correct') : t('incorrect')}
                    </h4>
                </div>
                <p className="tracking-tight m-0" style={{ ...type.quote, color: colors.heading }}>
                    {/* Per-option feedback moved WITH its option during the
                        shuffle (tagged onto the entry itself), so this reads
                        the selected entry's own feedback -- not
                        feedback[selectedIdx], which would be the feedback
                        for whatever originally sat at that DISPLAYED
                        position before shuffling. */}
                    {selectedEntry?.feedback ?? (Array.isArray(currentQuestion.feedback) ? undefined : currentQuestion.feedback)}
                </p>
            </div>

            <button
                onClick={nextQuestion}
                className="w-full py-6 text-white font-black uppercase tracking-[0.3em] transition-all shadow-xl flex items-center justify-center gap-4 hover:brightness-110 border-none cursor-pointer leading-none text-[10px]"
                style={{ backgroundColor: colors.accent }}
            >
                {currentIdx < questions.length - 1 ? t('nextQuestion') : t('processFinalResult')} <ChevronRight size={18} />
            </button>
        </motion.div>
      )}

      {/* 4. INTEGRITY FOOTER */}
      <div className="flex items-center gap-3 justify-center opacity-20 mt-12 pointer-events-none leading-none">
         <Zap size={14} className="text-slate-400" />
         <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">
             
         </span>
      </div>
    </div>
  );
};