'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, GitBranch } from 'lucide-react';
import { LMS_THEME } from './theme';

type BranchResumeState = { optionId: string, subIndex: number } | null;

/**
 * XR2TRAIN BRANCH ELEMENT
 * A decision point: the learner picks one of content.options[], then plays
 * that option's private content.options[].path[] steps in place, using the
 * exact same step components as top-level steps (via the caller's own
 * stepTypeMap — passed in rather than imported, since each app wires up a
 * different set of step types, e.g. course-builder omits enrollment-linked
 * types and each app's isPassiveStep gating differs slightly). Only once
 * the whole chosen path finishes does this call the outer onComplete, at
 * which point the module's normal step order resumes — reconvergence is
 * just the outer CoursePlayer advancing currentIndex as usual.
 *
 * Sub-progress is reported upward via onBranchProgress so CoursePlayer can
 * persist { optionId, subIndex } for mid-branch resume, and cleared (null)
 * both on full completion and if the resumeState we were handed no longer
 * matches this content (e.g. the option was deleted after authoring) — so a
 * stale pointer never lingers once we've had a chance to look at it.
 */
export const BranchElement = ({
  content,
  template,
  onComplete,
  enrollmentId,
  onBranchProgress,
  resumeState,
  stepTypeMap,
  isPassiveStep
}: {
  content: any,
  template?: any,
  onComplete?: (score?: number) => void,
  enrollmentId?: string,
  onBranchProgress?: (payload: BranchResumeState) => void,
  resumeState?: BranchResumeState,
  stepTypeMap: Record<string, React.ComponentType<any>>,
  isPassiveStep: (step: any) => boolean
}) => {
  const t = useTranslations('BranchElement');
  const { colors, type } = LMS_THEME;
  const options = content?.options || [];

  const resumeOption = resumeState ? options.find((o: any) => o.id === resumeState.optionId) : null;
  const resumeValid = !!resumeState && !!resumeOption &&
    resumeState.subIndex >= 0 && resumeState.subIndex < (resumeOption.path?.length || 0);

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(resumeValid ? resumeState!.optionId : null);
  const [subIndex, setSubIndex] = useState(resumeValid ? resumeState!.subIndex : 0);
  const [subStepValid, setSubStepValid] = useState(false);
  const [lastSubScore, setLastSubScore] = useState<number | undefined>(undefined);

  // A resumeState pointer that doesn't match this content (deleted option,
  // shortened path) never gets used above — proactively clear it server-side
  // too, rather than leaving a stale pointer sitting on the enrollment row.
  useEffect(() => {
    if (resumeState && !resumeValid) {
      console.warn("XR2TRAIN_BRANCH_RESUME: stale branch_progress ignored, clearing.", resumeState);
      onBranchProgress?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedOption = options.find((o: any) => o.id === selectedOptionId);
  const pathSteps = selectedOption?.path || [];
  const currentPathStep = pathSteps[subIndex];

  useEffect(() => {
    setSubStepValid(isPassiveStep(currentPathStep));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOptionId, subIndex]);

  if (!content) return null;

  const selectOption = (optionId: string) => {
    setSelectedOptionId(optionId);
    setSubIndex(0);
    setSubStepValid(false);
    onBranchProgress?.({ optionId, subIndex: 0 });
  };

  const handleSubStepComplete = (score?: number) => {
    setSubStepValid(true);
    if (typeof score === 'number') setLastSubScore(score);
  };

  const handleSubPrev = () => {
    if (subIndex === 0 || !selectedOptionId) return;
    const prevIdx = subIndex - 1;
    setSubIndex(prevIdx);
    onBranchProgress?.({ optionId: selectedOptionId, subIndex: prevIdx });
  };

  const handleSubNext = () => {
    if (!selectedOptionId) return;
    if (subIndex >= pathSteps.length - 1) {
      // Chosen path finished — clear mid-branch resume state and hand off
      // to the outer player, which resumes the module's normal order.
      onBranchProgress?.(null);
      onComplete?.(lastSubScore);
    } else {
      const nextIdx = subIndex + 1;
      setSubIndex(nextIdx);
      onBranchProgress?.({ optionId: selectedOptionId, subIndex: nextIdx });
    }
  };

  // --- STAGE 1: DECISION PROMPT ---
  if (!selectedOptionId) {
    return (
      <div className="animate-in fade-in duration-1000 text-left w-full pb-40">
        <div className="mb-10">
          {content.title && (
            <h1 style={{ ...type.h2, color: colors.heading, margin: 0 }}>{content.title}</h1>
          )}
        </div>

        <div className="border-l-4 pl-8 py-2 mb-16" style={{ borderColor: colors.accent }}>
          <h3 style={{ ...type.h3, color: colors.heading, margin: 0 }}>{content.prompt}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {options.map((opt: any) => (
            <button
              key={opt.id}
              onClick={() => selectOption(opt.id)}
              className="p-10 text-left border-2 border-slate-100 hover:border-blue-600 hover:shadow-2xl transition-all group bg-white cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-4" style={{ color: colors.accent }}>
                <GitBranch size={18} />
                <span className="text-[9px] font-black uppercase tracking-[0.3em]">{t('choosePath')}</span>
              </div>
              <p style={{ ...type.h3, color: colors.heading, margin: 0 }} className="group-hover:translate-x-1 transition-transform">
                {opt.text}
              </p>
            </button>
          ))}
        </div>

        {options.length === 0 && (
          <div className="p-32 border-4 border-dashed border-slate-100 text-center text-slate-200 font-black uppercase tracking-widest italic text-2xl">
            {t('awaitingOptions')}
          </div>
        )}
      </div>
    );
  }

  // --- STAGE 2: CHOSEN PATH PLAYBACK ---
  if (!currentPathStep) {
    // Empty/misconfigured path — nothing to play, treat as immediately done.
    onComplete?.();
    return null;
  }

  const Component = stepTypeMap[currentPathStep.type];
  // Same content.title fallback as CoursePlayer.tsx's PreviewRenderer — a
  // branch's nested path steps go through this separate render path, so the
  // fallback has to be applied here too, not just at the top level.
  const pathStepContent = { ...currentPathStep.content, title: currentPathStep.content?.title || currentPathStep.title };

  return (
    <div className="animate-in fade-in duration-700 text-left w-full pb-20">
      <div className="flex items-center gap-3 mb-10 opacity-60">
        <GitBranch size={14} style={{ color: colors.accent }} />
        <span className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: colors.body }}>
          {selectedOption?.text} &middot; {t('step', { current: subIndex + 1, total: pathSteps.length })}
        </span>
      </div>

      {Component ? (
        <Component content={pathStepContent} template={template} enrollmentId={enrollmentId} onComplete={handleSubStepComplete} />
      ) : (
        <div className="py-20 text-center border-4 border-dashed border-slate-100 opacity-20 italic uppercase font-black text-xs">
          {t('nodePending', { type: currentPathStep.type })}
        </div>
      )}

      <div className="flex items-center justify-between mt-16 pt-10 border-t border-slate-100">
        <button
          onClick={handleSubPrev}
          disabled={subIndex === 0}
          className="flex items-center gap-2 font-black text-slate-400 hover:text-[#0B1120] disabled:opacity-0 uppercase text-[10px] tracking-widest transition-all italic"
        >
          <ChevronLeft size={14} /> {t('prev')}
        </button>
        <button
          onClick={handleSubNext}
          disabled={!subStepValid}
          className={`px-10 py-4 font-black italic uppercase text-sm transition-all shadow-xl active:scale-95 ${subStepValid ? 'text-white hover:brightness-110' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
          style={subStepValid ? { backgroundColor: colors.heading } : undefined}
        >
          {subIndex >= pathSteps.length - 1 ? t('finishPath') : t('continue')}
        </button>
      </div>
    </div>
  );
};
