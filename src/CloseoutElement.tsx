'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  CheckCircle2,
  Zap,
  Briefcase
} from 'lucide-react';
import { LMS_THEME, getGridTemplate, LAYER_GAP_CLASS } from './theme';

/**
 * XR2TRAIN CLOSEOUT ELEMENT v6.2 (Production Platinum - UNTRUNCATED)
 * Authority: LMS Portal Node (Port 3002)
 * Logic: Dynamic Score Injection + 7-Layer Terminal Sequence.
 * Standard: UNTRUNCATED.
 */
export const CloseoutElement = ({ 
  content, 
  template, 
  score = null 
}: { 
  content: any, 
  template?: any, 
  score?: number | null 
}) => {
  const t = useTranslations('CloseoutElement');

  if (!content) return null;

  // Determination: Is this a graded assessment result?
  const hasScoreData = typeof score === 'number';

  const { colors, type } = LMS_THEME;

  // Merged so template-wide defaults still apply, but a per-page
  // content.layout_config override (image fit/ratio, layer spacing) always wins.
  const config = {
    closeout_bullet_align: 'right',
    show_next_course: true,
    ...(template?.layout_config || {}),
    ...(content?.layout_config || {}),
  };

  const logoUrl = template?.branding?.logo_url;

  return (
    <div className="animate-in fade-in duration-1000 w-full text-left pb-64">
      <div className={LAYER_GAP_CLASS[config.layer_gap] || LAYER_GAP_CLASS.relaxed}>

        {/* LAYER 0: BRAND LOGO (kept — tenant asset, not a color/font override) */}
        {logoUrl && (
            <div className="pt-10 opacity-60 flex justify-start">
                <img src={logoUrl} className="h-10 w-auto object-contain" alt={t('brandingAlt')} />
            </div>
        )}

        {/* LAYER 1: H1 TITLE NODE */}
        <header className="space-y-8 pt-10 border-b-[12px] border-slate-100 pb-12">
          <h1 style={{ ...type.h1, fontStyle: 'italic', color: colors.heading, margin: 0 }}>
            {content.title || t('titleFallback')}
          </h1>
          {content.subheading && (
            <h2 style={{ ...type.h2, color: colors.heading, margin: 0 }}>
                {content.subheading}
            </h2>
          )}
          <div className="h-3 w-32" style={{ backgroundColor: colors.accent }} />
        </header>

        {/* LAYER 2 & 3: VISUAL SCORE & PERFORMANCE SUMMARY */}
        <section className="flex flex-col items-center justify-center space-y-12">

            {hasScoreData ? (
                /* Graded Result View */
                <div className="text-center">
                    <span className="text-[14rem] font-black italic tracking-tighter leading-none" style={{ color: colors.heading }}>
                        {score}<span className="text-5xl not-italic ml-2" style={{ color: colors.accent }}>%</span>
                    </span>
                    <p style={{ ...type.label, fontStyle: 'italic', color: colors.body }} className="mt-4">{t('verifiedGrade')}</p>
                </div>
            ) : (
                /* Non-Graded Completion View */
                <div className="mx-auto w-fit p-12 border-4 flex items-center gap-8 bg-white shadow-2xl" style={{ borderColor: colors.heading }}>
                    <CheckCircle2 size={64} style={{ color: colors.success }} />
                    <div>
                        <h2 style={{ ...type.resultHeader, color: colors.heading, margin: 0 }}>{t('coursePassed')}</h2>
                        <p style={{ ...type.label, color: colors.body }} className="mt-2">{t('certificateAssigned')}</p>
                    </div>
                </div>
            )}

            <div className="w-full text-left border-t border-slate-100 pt-12">
                <div
                  className="prose prose-slate max-w-none leading-relaxed font-medium"
                  style={{ fontSize: type.body.fontSize, color: colors.body }}
                  dangerouslySetInnerHTML={{ __html: content.htmlContent || `<p>${t('htmlFallback')}</p>` }}
                />
            </div>
        </section>

        {/* LAYER 4: TAKEAWAYS */}
        <section
          className="grid grid-cols-1 lg:grid-cols-[var(--split)] gap-24 items-start border-y border-slate-100 py-24"
          style={{ '--split': getGridTemplate(config.image_ratio, config.closeout_bullet_align !== 'right') } as React.CSSProperties}
        >
            <div className={`w-full min-w-0 max-w-full overflow-hidden ${config.closeout_bullet_align === 'right' ? 'order-2' : 'order-1'}`}>
                <div className={`aspect-video w-full ${LMS_THEME.classes.imageFrame} bg-slate-50 flex`}>
                    {content.objectivesImage ? (
                      <img src={content.objectivesImage} className={`w-full h-full ${config.image_fit === 'contain' ? 'object-contain' : 'object-cover'}`} alt={content.objectivesImageAlt || t('takeawaysVisualAlt')} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300 uppercase font-black">{t('takeawayPlaceholder')}</div>
                    )}
                </div>
            </div>
            <div className={`text-left space-y-10 flex flex-col justify-center ${config.closeout_bullet_align === 'right' ? 'order-1' : 'order-2'}`}>
                <span style={{ ...type.label, color: colors.success }} className="flex items-center gap-3">
                    <Zap size={14} fill="currentColor"/> {t('keyTakeaways')}
                </span>
                <div
                  className="prose prose-slate max-w-none leading-relaxed font-medium pl-8"
                  style={{
                    borderLeft: `8px solid ${colors.success}`,
                    fontSize: type.body.fontSize,
                    color: colors.body
                  }}
                  dangerouslySetInnerHTML={{ __html: content.objectivesHtml || `<ul><li>${t('objectivesFallback')}</li></ul>` }}
                />
            </div>
        </section>

        {/* LAYER 5: TECHNICAL REVIEW */}
        <section className="w-full text-left max-w-5xl">
            <div
              className="prose prose-slate leading-relaxed font-medium"
              style={{
                color: colors.body,
                fontSize: type.body.fontSize
              }}
              dangerouslySetInnerHTML={{ __html: content.incidentHtml || `<p>${t('incidentFallback')}</p>` }}
            />
        </section>

        {/* LAYER 6: CAREER RECOMMENDATION — matches the Learning Pathway box on the course front page */}
        {config.show_next_course && (
            <section className="p-16 shadow-2xl relative overflow-hidden text-left text-white" style={{ backgroundColor: colors.darkPanel }}>
                <div className="flex items-center gap-4 mb-12" style={{ color: colors.accentMuted }}>
                    <Briefcase size={20} />
                    <h3 style={{ ...type.h3, textTransform: 'none', color: colors.accentMuted }}>{t('yourNextStep')}</h3>
                </div>
                <div>
                    <h4 style={{ ...type.h3, textTransform: 'none', color: '#cbd5e1' }} className="mb-4">{t('recommendedNextCourse')}</h4>
                    <p className="leading-relaxed font-medium text-white" style={{ fontSize: type.body.fontSize }}>
                        {content.pathwayNext || t('pathwayNextFallback')}
                    </p>
                </div>
            </section>
        )}

        {/* LAYER 7: TERMINAL VISUAL */}
        {content.imageUrl && (
            <div className="w-full pt-24">
                <img src={content.imageUrl} className="w-full h-auto object-cover opacity-40 hover:opacity-100 transition-all duration-1000" alt={content.imageAlt || t('terminalVisualAlt')} />
            </div>
        )}

      </div>
    </div>
  );
};