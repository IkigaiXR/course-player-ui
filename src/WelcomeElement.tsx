'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Briefcase, List, ShieldCheck, Award, FileText, Zap, HardHat } from 'lucide-react';
import { LMS_THEME, getGridTemplate, LAYER_GAP_CLASS } from './theme';

/**
 * Welcome / lesson title block — restyled to match the marketing website's
 * Hero.tsx (dark-panel case) and TextContent.tsx (plain-header case)
 * conventions. Visual properties come from LMS_THEME, not template.branding.
 */
export const WelcomeElement = ({ content }: { content: any, template?: any }) => {
  const t = useTranslations('WelcomeElement');

  if (!content) return null;

  const { colors, type } = LMS_THEME;
  const config = content.layout_config || {};

  return (
    <div className="animate-in fade-in duration-1000 w-full text-left pb-48">

      {/* --- LAYER 0: THE HANDSHAKE HEADER --- */}
      {content.imageUrl ? (
          /* Case A: Immersive Hero — matches website Hero.tsx */
          <section className="w-full h-[65vh] bg-[#0B1120] relative overflow-hidden group mb-32">
              <img src={content.imageUrl} className="w-full h-full object-cover opacity-50 mix-blend-luminosity transition-transform duration-[10000ms] group-hover:scale-105" alt={content.imageAlt || t('heroAlt')} />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0B1120] via-[#0B1120]/80 to-transparent" />
              <div className={`absolute inset-0 flex flex-col justify-center px-12 md:px-24 ${LMS_THEME.layout.contentWidth} mx-auto`}>
                  <h1 style={{ ...type.h1, fontStyle: 'italic', color: colors.headingOnDark, margin: 0 }}>
                      {content.title || t('titleFallback')}
                  </h1>
                  {content.subheading && (
                    <h2 style={{ ...type.h2, color: colors.accent, margin: 0 }} className="mt-6">
                        {content.subheading}
                    </h2>
                  )}
                  <div className="h-3 w-32 mt-8" style={{ backgroundColor: colors.accent }} />
              </div>
          </section>
      ) : (
          /* Case B: Clinical Header — matches website TextContent.tsx title treatment */
          <header className={`${LMS_THEME.layout.contentWidth} mx-auto px-12 pt-24 mb-24 border-b-[12px] border-slate-100 pb-16`}>
              <h1 style={{ ...type.h1, fontStyle: 'italic', color: colors.heading, margin: 0 }}>
                  {content.title || t('titleFallback')}
              </h1>
              {content.subheading && (
                <h2 style={{ ...type.h2, color: colors.heading, margin: 0 }} className="mt-6">
                    {content.subheading}
                </h2>
              )}
              <div className="h-3 w-32 mt-8" style={{ backgroundColor: colors.accent }} />
          </header>
      )}

      <div className={`${LMS_THEME.layout.contentWidth} mx-auto px-12 ${LAYER_GAP_CLASS[config.layer_gap] || LAYER_GAP_CLASS.relaxed}`}>

          {/* TECHNICAL BRIEFING - FULL WIDTH */}
          <section className="w-full relative">

              <div
                className="prose prose-slate max-w-none leading-relaxed font-medium"
                style={{ fontSize: type.body.fontSize, color: colors.body }}
                dangerouslySetInnerHTML={{ __html: content.htmlContent || `<p>${t('briefingFallback')}</p>` }}
              />
          </section>

          {/* MASTERED COMPETENCIES */}
          <section
            className="grid grid-cols-1 lg:grid-cols-[var(--split)] gap-24 items-center py-20 border-y border-slate-100"
            style={{ '--split': getGridTemplate(config.image_ratio, config.bullet_align === 'right') } as React.CSSProperties}
          >
              <div className={`text-left ${config.bullet_align === 'right' ? 'order-2' : 'order-1'}`}>
                  <h3 style={{ ...type.h3, color: colors.heading }} className="mb-10">{t('learningObjectives')}</h3>
                  <div
                    className="prose prose-slate max-w-none leading-relaxed [&_li]:mb-8 [&_li]:border-l-4 [&_li]:pl-6 [&_ul]:list-none [&_ul]:p-0 font-medium"
                    style={{ fontSize: type.body.fontSize, color: colors.body, ['--tw-prose-bullets' as any]: colors.accent }}
                    dangerouslySetInnerHTML={{ __html: content.objectivesHtml || `<ul><li>${t('objectivesFallback')}</li></ul>` }}
                  />
              </div>
              <div className={`${LMS_THEME.classes.imageFrame} aspect-video bg-slate-50 ${config.bullet_align === 'right' ? 'order-1' : 'order-2'}`}>
                  {content.objectivesImage ? (
                    <img src={content.objectivesImage} className={`w-full h-full ${config.image_fit === 'contain' ? 'object-contain' : 'object-cover'}`} alt={content.objectivesImageAlt || t('outcomesAlt')} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-10 font-black uppercase">{t('visualNodeRequired')}</div>
                  )}
              </div>
          </section>

          {/* ASSESSMENT PROTOCOL */}
          {(content.showAssessment !== false) && (
            <section className="p-16 border border-slate-200 bg-white shadow-xl relative overflow-hidden text-left">
                <div className="absolute top-0 right-0 p-8 opacity-5"><Award size={200} /></div>
                <div className="relative z-10 flex flex-col md:flex-row gap-16">
                    <div className="flex-1 space-y-6">
                        <h3 style={{ ...type.h3, color: colors.heading }} className="flex items-center gap-3">
                            <FileText size={20} style={{ color: colors.accent }} /> {t('assessmentInformation')}
                        </h3>
                        {content.assessmentHtml ? (
                           <div
                              className="prose prose-slate max-w-none leading-relaxed font-medium"
                              style={{ fontSize: type.body.fontSize, color: colors.body }}
                              dangerouslySetInnerHTML={{ __html: content.assessmentHtml }}
                           />
                        ) : (
                           <div className="py-10 border-2 border-dashed border-slate-100 text-slate-300 font-black uppercase text-[10px] tracking-widest text-center">{t('awaitingAssessmentNarrative')}</div>
                        )}
                    </div>
                    <div className="w-full md:w-80 p-8 border-l-[16px] shrink-0" style={{ backgroundColor: colors.calloutBg, borderColor: colors.heading }}>
                        <h5 style={{ ...type.label, color: colors.body }} className="mb-6">{t('passRequirements')}</h5>
                        <div className="space-y-4 text-xs font-bold uppercase">
                            <p className="flex justify-between border-b border-slate-200 pb-2">{t('overallScore')} <span className="font-black" style={{ color: colors.accent }}>{content.passScore || '60%'}</span></p>
                            <p className="flex justify-between border-b border-slate-200 pb-2">{t('partAMin')} <span className="font-black" style={{ color: colors.accent }}>{content.passPartA || '20/33'}</span></p>
                            <p className="flex justify-between">{t('partBMin')} <span className="font-black" style={{ color: colors.accent }}>{content.passPartB || '10/16'}</span></p>
                        </div>
                    </div>
                </div>
            </section>
          )}

          {/* CASE STUDY */}
          {content.showIncident !== false && content.incidentHtml && (
              <section className="w-full p-16 border-y border-r border-slate-200 border-l-[16px] border-l-red-500 text-left relative overflow-hidden">
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-[0.04] pointer-events-none">
                    <HardHat size={220} style={{ color: colors.heading }} />
                  </div>
                  <div className="relative z-10">
                      <h4 style={{ ...type.h3, color: colors.heading }} className="mb-6 flex items-center gap-4">
                        <AlertTriangle style={{ color: colors.heading }} /> {t('caseStudy')}
                      </h4>
                      {/* Neutralise any border/background baked into the authored HTML itself,
                          so the only visible box is this section's own frame, not a nested one. */}
                      <div
                        className="leading-relaxed font-medium [&_*]:!border-none [&_*]:!bg-transparent [&_*]:!shadow-none [&_*]:!rounded-none"
                        style={{ fontSize: type.body.fontSize, color: colors.body }}
                        dangerouslySetInnerHTML={{ __html: content.incidentHtml }}
                      />
                  </div>
              </section>
          )}

          {/* LEARNING PATHWAY INFO */}
          {content.showPathway !== false && (
              <section className="p-16 shadow-2xl relative overflow-hidden text-left text-white" style={{ backgroundColor: colors.darkPanel }}>
                    <div className="flex items-center gap-4 mb-12" style={{ color: colors.accentMuted }}>
                        <Zap size={20} fill="currentColor"/>
                        <h3 style={{ ...type.h3, textTransform: 'none', color: colors.accentMuted }}>{t('learningPathwayInfo')}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
                        <div>
                            <h4 style={{ ...type.h3, textTransform: 'none', color: '#cbd5e1' }} className="mb-4">{t('suggestedPrerequisites')}</h4>
                            <p className="leading-relaxed font-medium" style={{ fontSize: type.body.fontSize, color: colors.accent }}>{content.pathwayPrereqs || t('prereqsFallback')}</p>
                        </div>
                        <div>
                            <h4 style={{ ...type.h3, textTransform: 'none', color: '#cbd5e1' }} className="mb-4">{t('recommendedNextCourse')}</h4>
                            <p className="leading-relaxed font-medium text-white" style={{ fontSize: type.body.fontSize }}>{content.pathwayNext || t('pathwayNextFallback')}</p>
                        </div>
                    </div>
              </section>
          )}
      </div>
    </div>
  );
};
