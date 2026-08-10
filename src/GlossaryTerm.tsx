'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { LMS_THEME } from './theme';

/**
 * Inline glossary-term trigger + popup — ports xr2train-web's IntelLink
 * pattern (same positioning/animation technique, no popover library) so the
 * interaction matches what's already shipped on the marketing site. Each
 * instance owns its own open/close state; positioning is pure CSS (relative
 * wrapper + absolute popup above the trigger), not a floating-ui/portal.
 */
export function GlossaryTerm({ term, definition, children }: { term: string, definition: string, children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const { colors } = LMS_THEME;

    return (
        <span className="relative inline">
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(o => !o); }}
                className="font-bold cursor-help transition-colors border-none bg-transparent p-0 m-0 leading-none align-baseline"
                style={{ fontSize: 'inherit', color: isOpen ? colors.accent : 'inherit' }}
            >
                {children}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop for mobile — desktop dismisses via the X or re-clicking the term, same as IntelLink */}
                        <span className="fixed inset-0 z-[110] lg:hidden block" onClick={() => setIsOpen(false)} />

                        <motion.span
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-72 p-6 shadow-2xl z-[120] pointer-events-auto text-left flex flex-col"
                            style={{ backgroundColor: colors.darkPanel, border: `1px solid ${colors.accent}4D` }}
                        >
                            <span className="flex justify-between items-start mb-3 w-full">
                                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: colors.accentMuted }}>Definition</span>
                                <X size={14} className="text-slate-500 cursor-pointer hover:text-white transition-colors" onClick={() => setIsOpen(false)} />
                            </span>
                            <span className="text-sm font-black uppercase italic mb-2 leading-none block text-white">
                                {term}
                            </span>
                            <span className="text-[11px] text-slate-400 leading-relaxed font-medium normal-case block">
                                {definition}
                            </span>
                            {/* Tooltip arrow */}
                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent block" style={{ borderTopColor: colors.darkPanel }} />
                        </motion.span>
                    </>
                )}
            </AnimatePresence>
        </span>
    );
}
