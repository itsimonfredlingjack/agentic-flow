"use client";
import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Terminal, CheckCircle2, Loader2, ChevronDown, ChevronRight, Hash } from 'lucide-react';

export function CommandBlock({
    command,
    output,
    isRunning
}: {
    command: string;
    output?: string;
    isRunning?: boolean;
}) {
    const [isExpanded, setIsExpanded] = useState(true); // Default expanded for workbench visibility

    const hasOutput = output && output.length > 0;

    return (
        <div className="w-full my-3 animate-in fade-in slide-in-from-left-1 duration-300 group">
            <div className="flex items-center gap-2 mb-1 opacity-40 group-hover:opacity-60 transition-opacity">
                <Hash className="w-3 h-3" />
                <span className="text-[9px] uppercase tracking-widest font-bold">Terminal::Execution</span>
            </div>

            <div className="ml-5 border border-emerald-500/20 bg-emerald-500/5 rounded-sm overflow-hidden shadow-inner">
                {/* Tab Header */}
                <div
                    className="flex items-center gap-3 px-3 py-1.5 bg-emerald-500/10 border-b border-emerald-500/10 cursor-pointer hover:bg-emerald-500/20 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-2 flex-1">
                        {isRunning ? (
                            <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                        ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        )}
                        <code className="text-xs font-mono text-emerald-300 font-bold truncate">
                            {command}
                        </code>
                    </div>

                    {hasOutput && (
                        <div className="text-emerald-500/40">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </div>
                    )}
                </div>

                {/* Terminal Body */}
                {isExpanded && hasOutput && (
                    <div className="bg-[#050505] p-3 overflow-x-auto max-h-[400px] custom-scrollbar">
                        <pre className="text-[11px] font-mono text-gray-400 leading-relaxed whitespace-pre-wrap selection:bg-emerald-500/20">
                            {output}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}