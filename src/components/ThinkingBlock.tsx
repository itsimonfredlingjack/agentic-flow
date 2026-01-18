"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Lightbulb } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface ThinkingBlockProps {
    content: string;
    defaultExpanded?: boolean;
}

export function ThinkingBlock({ content, defaultExpanded = false }: ThinkingBlockProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const lines = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return (
        <div className="my-4 border border-amber-500/20 bg-amber-500/5 rounded-sm overflow-hidden">
            {/* Header */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={clsx(
                    "w-full flex items-center gap-3 px-3 py-1.5 text-left",
                    "hover:bg-amber-500/10 transition-colors",
                    "bg-amber-500/10 border-b border-amber-500/10"
                )}
            >
                {isExpanded ? (
                    <ChevronDown size={14} className="text-amber-400" />
                ) : (
                    <ChevronRight size={14} className="text-amber-400" />
                )}
                <div className="flex items-center gap-2">
                    <Lightbulb size={12} className="text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                        Reasoning::Internal
                    </span>
                </div>
                <span className="text-amber-500/30 ml-auto text-[9px] font-mono">
                    {lines.length} NODES
                </span>
            </button>

            {/* Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 bg-[#0a0a05]">
                            <ul className="space-y-2">
                                {lines.map((line, idx) => {
                                    const cleanLine = line.replace(/^[•\-\s]*/, '');
                                    return (
                                        <li
                                            key={idx}
                                            className="flex items-start gap-3 text-[12px] text-amber-200/60 font-mono leading-relaxed"
                                        >
                                            <span className="text-amber-500/40 mt-1">[{String(idx + 1).padStart(2, '0')}]</span>
                                            <span>{cleanLine}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
