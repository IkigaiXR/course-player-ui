'use client';

import React, { useEffect, useMemo, useState } from 'react';
import parse, { domToReact, HTMLReactParserOptions } from 'html-react-parser';
import { Zap, FileText, ShieldAlert, Briefcase, ShieldCheck, ChevronDown, HelpCircle } from 'lucide-react';
import { LMS_THEME, getGridTemplate } from './theme';
import { GlossaryTerm } from './GlossaryTerm';

// Bullets are authored as a single HTML blob (bulletHtml), not a structured
// array — this splits it into individual <li> items at render time for
// sequential reveal, without changing how the field is authored/stored.
// Regex, not DOMParser: these are client components that still get
// server-rendered on first pass, and DOMParser doesn't exist in that Node
// environment.
function parseBulletItems(html: string): string[] {
    if (!html) return [];
    return [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => m[1].trim());
}

function normalizeGlossaryKey(s: string): string {
    return s.replace(/<[^>]+>/g, '').trim().replace(/[.:,;!?]+$/, '').toLowerCase();
}

function getTextContent(node: any): string {
    if (!node) return '';
    if (node.type === 'text') return node.data || '';
    if (node.children) return node.children.map(getTextContent).join('');
    return '';
}

// Parses `html` into real React nodes (not a raw string blob), swapping any
// <b>/<strong> tag whose text matches a glossaryTerms[].term (case/
// punctuation insensitive) for a real <GlossaryTerm> popup component —
// ports xr2train-web's IntelLink/IntelParser architecture. Non-matches (and
// everything when glossaryTerms is absent) render exactly as parsed, with
// zero behavioural difference from the plain dangerouslySetInnerHTML this
// replaces.
function renderWithGlossaryTerms(html: string, glossaryTerms: { term: string, definition: string }[] | undefined): React.ReactNode {
    if (!html) return null;
    if (!glossaryTerms || glossaryTerms.length === 0) return parse(html);

    const termMap = new Map(glossaryTerms.map(g => [normalizeGlossaryKey(g.term), g]));
    const options: HTMLReactParserOptions = {
        replace: (domNode: any) => {
            if (domNode.type === 'tag' && (domNode.name === 'b' || domNode.name === 'strong')) {
                const key = normalizeGlossaryKey(getTextContent(domNode));
                const entry = termMap.get(key);
                if (!entry) return undefined;
                return (
                    <GlossaryTerm term={entry.term} definition={entry.definition}>
                        {domToReact(domNode.children, options)}
                    </GlossaryTerm>
                );
            }
            return undefined;
        }
    };
    return parse(html, options);
}

/**
 * XR2TRAIN TEXT ELEMENT v10.0 (Production Platinum)
 * Authority: Unified Renderer for LMS Portal & Builder Preview.
 * Logic: 7-Layer Welcome Node + 4-Layer Narrative Node + Visibility Handshake.
 * Fix: Total Parity with v4.0 Articulate Security Patch and 1:1 IDE Handshake.
 * Standard: UNTRUNCATED.
 */
export const TextElement = ({
    content,
    template,
    isWelcome = false,
    onComplete
}: {
    content: any,
    template?: any,
    isWelcome?: boolean,
    onComplete?: () => void
}) => {
    if (!content) return null;

    // --- 1. DESIGN AUTHORITY: BRANDING INHERITANCE ---
    const branding = template?.branding || {
        h1: { font: 'Montserrat', size: '80px', weight: '700', italic: true, color: '#0B1120' },
        h2: { font: 'Montserrat', size: '34px', weight: '500', italic: true, color: '#1E3A8A' },
        body: { font: 'Inter', size: '18px', weight: '400', italic: false, color: '#475569' },
        spacing: { h1_margin: '40px', body_margin: '60px', list_margin: '40px' },
        bullets: { color: '#69C0FF', weight: '6px' },
        incident: { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B', size: '24px' },
        pathway: { bg: '#0B1120', text: '#69C0FF', size: '28px' }
    };

    // --- 2. LAYOUT CONFIGURATION ---
    const config = content.layout_config || {
        bullet_align: 'left',
        welcome_bullet_align: 'left',
        show_incident: true,
        show_prereqs: true,
        image_fit: 'contain',
        show_callout: true,
        show_footnote: true
    };

    // Full-width overlay darkness (0-100, author-controlled via ImageLayoutControls).
    // 50 reproduces the original fixed gradient (0.9/0.6 alpha stops) exactly, so
    // existing content that predates this control renders unchanged; below 50
    // lightens the overlay toward a fully visible image, above 50 darkens it
    // toward solid black.
    const overlayDarkness = typeof config.overlay_darkness === 'number' ? config.overlay_darkness : 50;
    const overlayStrength = overlayDarkness / 50;
    const overlayFromAlpha = Math.min(1, 0.9 * overlayStrength);
    const overlayViaAlpha = Math.min(1, 0.6 * overlayStrength);

    const { 
        title, 
        subheading, 
        htmlContent,       // Layer 1
        imageUrl,           // Visual Node
        bulletHtml,         // Layer 2 (Consolidated HTML)
        objectivesHtml,     // Welcome Node Outcomes
        objectivesImage,    // Welcome Node Visual
        pathwayPrereqs,
        pathwayNext,
        incidentHtml,
        callout,            // Layer 3
        footnote            // Layer 4
    } = content;

    // --- SEQUENTIAL BULLET REVEAL (opt-in via layout_config.reveal_mode) ---
    // Hooks run unconditionally (before the isWelcome early return below) —
    // this branch never applies to the welcome-page render, but the hooks
    // themselves must still execute every render regardless.
    const isSequential = config.reveal_mode === 'sequential';
    const bulletItems = useMemo(() => parseBulletItems(bulletHtml), [bulletHtml]);
    const [revealedCount, setRevealedCount] = useState(1);
    const [microCheckRevealed, setMicroCheckRevealed] = useState(false);
    const allBulletsRevealed = !isSequential || bulletItems.length === 0 || revealedCount >= bulletItems.length;
    // "Key Points" is a heading for bulletHtml specifically — hide it (and the
    // content block under it) when there are no bullets authored, rather than
    // showing an empty heading over nothing. AI-generated modules don't always
    // populate bulletHtml, and an image-only step shouldn't get a bare label.
    const hasBullets = !!(bulletHtml && bulletHtml.trim());

    // --- INLINE GLOSSARY TERMS (opt-in via content.glossaryTerms) ---
    const glossaryTerms: { term: string, definition: string }[] = content.glossaryTerms || [];

    // --- DWELL-GATED CONTINUE (opt-in via layout_config.min_dwell_seconds) ---
    // Deliberately silent — gates Continue but shows no countdown/indicator.
    const minDwellSeconds = config.min_dwell_seconds;
    const hasMinDwell = typeof minDwellSeconds === 'number' && minDwellSeconds > 0;
    const [dwellElapsed, setDwellElapsed] = useState(!hasMinDwell);

    useEffect(() => {
        if (!hasMinDwell) return;
        setDwellElapsed(false);
        const timer = setTimeout(() => setDwellElapsed(true), minDwellSeconds * 1000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasMinDwell, minDwellSeconds]);

    // Combines (AND, not OR/replace) with sequential reveal — both default to
    // "already satisfied" when their own trigger field is absent, so either
    // feature alone behaves exactly as if built in isolation.
    useEffect(() => {
        if ((isSequential || hasMinDwell) && allBulletsRevealed && dwellElapsed) onComplete?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSequential, hasMinDwell, allBulletsRevealed, dwellElapsed]);

    // --- MODE A: WELCOME PAGE (NODE 0 SEQUENCE) ---
    if (isWelcome) {
        return (
            <div className="animate-in fade-in duration-1000 w-full text-left font-montserrat" style={{ fontFamily: branding.body.font }}>
                <div className="max-w-[1400px] mx-auto px-12 space-y-24 pb-32">
                    
                    {branding.logo_url && (
                        <div className="mb-10 opacity-60">
                            <img src={branding.logo_url} className="h-12 w-auto object-contain" alt="Infrastructure Branding" />
                        </div>
                    )}

                    <header className="border-b-[24px] pb-10" style={{ borderColor: branding.h1.color }}>
                        <h1 style={{ 
                            fontFamily: branding.h1.font,
                            fontSize: branding.h1.size,
                            fontWeight: branding.h1.weight,
                            fontStyle: branding.h1.italic ? 'italic' : 'normal',
                            color: branding.h1.color,
                            lineHeight: 0.8,
                            letterSpacing: '-0.05em',
                            marginBottom: branding.spacing.h1_margin,
                            textTransform: 'none',
                            margin: 0
                        }}>
                            {title || "WELCOME"}
                        </h1>
                    </header>

                    {subheading && (
                        <div className="border-l-8 pl-8 py-2" style={{ borderColor: branding.h1.color }}>
                            <h3 style={{ 
                                fontFamily: branding.h2.font,
                                fontSize: branding.h2.size,
                                fontWeight: branding.h2.weight,
                                fontStyle: branding.h2.italic ? 'italic' : 'normal',
                                color: branding.h2.color,
                                lineHeight: 1,
                                margin: 0
                            }}>{subheading}</h3>
                        </div>
                    )}

                    <section className="max-w-5xl">
                        <div 
                            className="prose prose-slate prose-2xl max-w-none font-light leading-relaxed prose-p:mb-8" 
                            style={{ color: branding.body.color, fontSize: branding.body.size, marginBottom: branding.spacing.body_margin }}
                            dangerouslySetInnerHTML={{ __html: htmlContent || "<p>Initialising technical narrative...</p>" }} 
                        />
                    </section>

                    {/* Node 0: Outcomes Grid (Auto-Fit Enabled) */}
                    <section className={`grid grid-cols-1 lg:grid-cols-2 gap-20 items-stretch border-y border-slate-100 py-24 ${config.welcome_bullet_align === 'right' ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex flex-col justify-center ${config.welcome_bullet_align === 'right' ? 'order-2' : 'order-1'}`}>
                            <span className="text-[11px] font-black uppercase tracking-[0.5em] text-[#69C0FF] block mb-10">Learning Outcomes</span>
                            <div 
                                className="prose prose-slate prose-xl max-w-none font-bold uppercase italic pl-8" 
                                style={{ borderLeft: `${branding.bullets.weight} solid ${branding.bullets.color}`, marginTop: branding.spacing.list_margin }}
                                dangerouslySetInnerHTML={{ __html: objectivesHtml || "<ul><li>Authorise safety matrix</li></ul>" }} 
                            />
                        </div>
                        <div className={`flex border-[16px] border-white shadow-2xl bg-slate-50 overflow-hidden ${config.welcome_bullet_align === 'right' ? 'order-1' : 'order-2'}`}>
                            {objectivesImage ? (
                                <img 
                                    src={objectivesImage} 
                                    className={`w-full h-full ${config.image_fit === 'cover' ? 'object-cover' : 'object-contain'}`} 
                                    alt="Objectives Visual" 
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-200 font-black uppercase text-[10px]">Awaiting Objectives Media</div>
                            )}
                        </div>
                    </section>

                    {config.show_incident && incidentHtml && (
                        <section className="border-l-[16px] p-16 space-y-8 shadow-sm" style={{ backgroundColor: branding.incident.bg, borderColor: branding.incident.border }}>
                            <div className="flex items-center gap-4 text-red-700">
                                <ShieldAlert size={32} />
                                <h4 className="text-2xl font-black uppercase italic tracking-widest leading-none m-0">Incident Reconstruction</h4>
                            </div>
                            <div className="prose prose-red prose-xl max-w-none italic font-medium leading-relaxed" style={{ color: branding.incident.text, fontSize: branding.incident.size }} dangerouslySetInnerHTML={{ __html: incidentHtml }} />
                        </section>
                    )}

                    {config.show_prereqs && (
                        <section className="p-16 shadow-2xl space-y-12" style={{ backgroundColor: branding.pathway.bg }}>
                            <div className="flex items-center gap-4" style={{ color: branding.pathway.text }}>
                                <div className="w-2 h-2 rounded-none" style={{ backgroundColor: branding.pathway.text }} />
                                <span className="text-[11px] font-black uppercase tracking-[0.5em]">Pathway Authority</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                                <div className="space-y-4">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Recommended Prerequisites</p>
                                    <p className="font-black uppercase italic tracking-tighter" style={{ color: branding.pathway.text, fontSize: branding.pathway.size }}>{pathwayPrereqs || "NONE AUTHORISED"}</p>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Future Career Nodes</p>
                                    <p className="text-2xl font-black uppercase italic tracking-tighter text-white">{pathwayNext || "T2 ADVANCED"}</p>
                                </div>
                            </div>
                        </section>
                    )}

                    {imageUrl && (
                        <section className="w-full border-[24px] border-white shadow-2xl overflow-hidden bg-slate-100">
                            <img src={imageUrl} className="w-full h-auto object-cover grayscale hover:grayscale-0 transition-all duration-1000" alt="Final Node Visual" />
                        </section>
                    )}
                </div>
            </div>
        );
    }

    // --- MODE B: STANDARD NARRATIVE NODE (4-LAYER STACK) — restyled to match website TextContent.tsx ---
    const { colors, type } = LMS_THEME;

    return (
        <div className="animate-in fade-in duration-1000 text-left w-full pb-40">

            {/* LAYER 1: HEADERS & BODY */}
            <header className="mb-20">
                <div className="mb-10">
                    <h1 style={{ ...type.h2, color: colors.heading, margin: 0 }}>{title}</h1>
                </div>

                {subheading && (
                    <div className="mb-12 border-l-4 pl-8 py-2" style={{ borderColor: colors.accent }}>
                        <h3 style={{ ...type.h3, color: colors.heading, margin: 0 }}>{subheading}</h3>
                    </div>
                )}

                <div
                    className="prose prose-slate max-w-5xl font-medium leading-relaxed"
                    style={{ fontSize: type.body.fontSize, color: colors.body }}
                >
                    {renderWithGlossaryTerms(htmlContent, glossaryTerms)}
                </div>
            </header>

            {/* LAYER 2: SPLIT TIER (OBJECTIVES & IMAGE) - AUTO-FIT ENGINE */}
            {content.layout === 'full' && imageUrl ? (
                /* FULL-WIDTH IMAGE, KEY POINTS OVERLAID — opt-in via layout_config */
                <section className="relative min-h-[600px] flex items-center py-24 mb-20 overflow-hidden">
                    <img src={imageUrl} className="absolute inset-0 w-full h-full object-cover" alt={content.imageAlt || "Technical Node Visual"} />
                    <div
                        className="absolute inset-0"
                        style={{ backgroundImage: `linear-gradient(to right, rgba(11,17,32,${overlayFromAlpha}), rgba(11,17,32,${overlayViaAlpha}) 50%, rgba(11,17,32,0) 100%)` }}
                    />
                    <div className="relative z-10 max-w-2xl px-12 md:px-20 space-y-10">
                        {hasBullets && (
                        <>
                        <span style={{ ...type.label, color: config.overlay_text_color || '#FFFFFF' }} className="block">Key Points</span>
                        {isSequential && bulletItems.length > 0 ? (
                            <div className="space-y-8">
                                <ul className="prose max-w-none leading-relaxed font-medium list-none pl-0 m-0" style={{ fontSize: type.body.fontSize, color: config.overlay_text_color || '#FFFFFF' }}>
                                    {bulletItems.slice(0, revealedCount).map((item, i) => (
                                        <li key={i} className="animate-in fade-in slide-in-from-left-2 duration-500 mb-4">
                                            {renderWithGlossaryTerms(item, glossaryTerms)}
                                        </li>
                                    ))}
                                </ul>
                                {revealedCount < bulletItems.length && (
                                    <button
                                        onClick={() => setRevealedCount(c => Math.min(bulletItems.length, c + 1))}
                                        className="flex items-center gap-3 px-6 py-3 font-black uppercase text-[10px] tracking-widest border-2 transition-all hover:shadow-lg cursor-pointer bg-transparent"
                                        style={{ borderColor: config.overlay_text_color || '#FFFFFF', color: config.overlay_text_color || '#FFFFFF' }}
                                    >
                                        <ChevronDown size={14} /> Reveal Next Point ({revealedCount}/{bulletItems.length})
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div
                                className="prose max-w-none leading-relaxed font-medium"
                                style={{ fontSize: type.body.fontSize, color: config.overlay_text_color || '#FFFFFF' }}
                            >
                                {renderWithGlossaryTerms(bulletHtml, glossaryTerms)}
                            </div>
                        )}
                        </>
                        )}
                    </div>
                </section>
            ) : (bulletHtml || imageUrl) && (
                <section
                    className="grid grid-cols-1 lg:grid-cols-[var(--split)] gap-20 items-stretch py-24 border-y border-slate-100 mb-20"
                    style={{ '--split': getGridTemplate(config.image_ratio, config.bullet_align === 'right') } as React.CSSProperties}
                >

                    {/* Narrative Column */}
                    <div className={`flex flex-col justify-center space-y-10 ${config.bullet_align === 'right' ? 'order-2' : 'order-1'}`}>
                        {hasBullets && (
                        <>
                        <span style={{ ...type.label, color: colors.accent }} className="block">Key Points</span>
                        {isSequential && bulletItems.length > 0 ? (
                            <div className="space-y-8">
                                <ul className="prose prose-slate max-w-none leading-relaxed font-medium list-none pl-0 m-0" style={{ fontSize: type.body.fontSize, color: colors.body }}>
                                    {bulletItems.slice(0, revealedCount).map((item, i) => (
                                        <li key={i} className="animate-in fade-in slide-in-from-left-2 duration-500 mb-4">
                                            {renderWithGlossaryTerms(item, glossaryTerms)}
                                        </li>
                                    ))}
                                </ul>
                                {revealedCount < bulletItems.length && (
                                    <button
                                        onClick={() => setRevealedCount(c => Math.min(bulletItems.length, c + 1))}
                                        className="flex items-center gap-3 px-6 py-3 font-black uppercase text-[10px] tracking-widest border-2 transition-all hover:shadow-lg cursor-pointer bg-transparent"
                                        style={{ borderColor: colors.accent, color: colors.accent }}
                                    >
                                        <ChevronDown size={14} /> Reveal Next Point ({revealedCount}/{bulletItems.length})
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div
                                className="prose prose-slate max-w-none leading-relaxed font-medium"
                                style={{ fontSize: type.body.fontSize, color: colors.body }}
                            >
                                {renderWithGlossaryTerms(bulletHtml, glossaryTerms)}
                            </div>
                        )}
                        </>
                        )}
                    </div>

                    {/* Visual Column: Stretching Enabled via items-stretch */}
                    <div className={`flex min-h-[450px] ${config.bullet_align === 'right' ? 'order-1' : 'order-2'}`}>
                        {imageUrl && (
                            <div className={`${LMS_THEME.classes.imageFrame} bg-slate-50 w-full h-full flex`}>
                                <img
                                    src={imageUrl}
                                    className={`w-full h-full transition-all duration-700 ${config.image_fit === 'cover' ? 'object-cover' : 'object-contain'}`}
                                    alt={content.imageAlt || "Technical Node Visual"}
                                />
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* MICRO-CHECK (Optional tap-to-reveal recall question) */}
            {content.microCheck && (
                <section className="mt-20 mb-20">
                    <div className="max-w-5xl p-16 shadow-inner space-y-6 border-l-[16px]" style={{ backgroundColor: colors.lightTint, borderColor: colors.accent }}>
                        <div className="flex items-center gap-3" style={{ color: colors.accent }}>
                            <HelpCircle size={18} />
                            <span style={{ ...type.label, color: colors.accent }}>Quick Recall</span>
                        </div>
                        <h4 style={{ ...type.h3, color: colors.heading }} className="m-0">
                            {renderWithGlossaryTerms(content.microCheck.question, glossaryTerms)}
                        </h4>
                        {microCheckRevealed ? (
                            <div className="font-medium leading-relaxed m-0" style={{ fontSize: type.body.fontSize, color: colors.body }}>
                                {renderWithGlossaryTerms(content.microCheck.revealText, glossaryTerms)}
                            </div>
                        ) : (
                            <button
                                onClick={() => setMicroCheckRevealed(true)}
                                className="px-8 py-4 font-black uppercase text-[10px] tracking-widest text-white transition-all hover:brightness-110 cursor-pointer border-none"
                                style={{ backgroundColor: colors.heading }}
                            >
                                Reveal Answer
                            </button>
                        )}
                    </div>
                </section>
            )}

            {/* LAYER 3: CALLOUT (Visibility Gated) — matches website's TextContent.tsx callout pattern */}
            {config.show_callout !== false && callout && (
                <section className="mt-20 mb-20">
                    <div className="max-w-5xl p-16 shadow-inner space-y-6" style={{ backgroundColor: colors.calloutBg, borderLeft: `16px solid ${colors.heading}` }}>
                        <div className="flex items-center gap-3" style={{ color: colors.heading }}>
                            <Zap size={18} fill="currentColor" />
                            <span style={{ ...type.label, color: colors.heading }}>Note</span>
                        </div>
                        <h4 style={{ ...type.h3, color: colors.heading }} className="m-0">
                            {callout.title}
                        </h4>
                        <div className="font-medium leading-relaxed m-0" style={{ fontSize: type.body.fontSize, color: colors.body }}>
                            {renderWithGlossaryTerms(callout.body, glossaryTerms)}
                        </div>
                    </div>
                </section>
            )}

            {/* LAYER 4: FOOTNOTE (Visibility Gated) */}
            {config.show_footnote !== false && footnote && (
                <section className="pt-10 border-t border-slate-100 flex items-start gap-4 opacity-60 hover:opacity-100 transition-opacity">
                    <FileText size={16} className="mt-1" style={{ color: colors.body }} />
                    <div className="font-medium uppercase tracking-[0.2em] leading-loose max-w-4xl italic" style={{ fontSize: '13px', color: colors.body }}>
                        {renderWithGlossaryTerms(footnote, glossaryTerms)}
                    </div>
                </section>
            )}
        </div>
    );
};