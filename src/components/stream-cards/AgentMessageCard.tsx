"use client";
import React from 'react';
import { clsx } from 'clsx';
import { MarkdownMessage } from '../MarkdownMessage';
import { ThinkingIndicator } from '../ThinkingIndicator';
import { User, Bot, Terminal, Code2 } from 'lucide-react';

export function AgentMessageCard({
    agentId,
    content,
    isTyping,
    phase,
    isUser
}: {
    agentId: string;
    content: string;
    isTyping?: boolean;
    phase: string;
    isUser?: boolean;
}) {
    // 1. User Input View (Instruction)
    if (isUser) {
        return (
            <div className="w-full py-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <div className="flex items-center gap-3 mb-2 opacity-40">
                    <User className="w-3 h-3" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold">INSTRUCTION</span>
                </div>
                <div className="text-sm text-gray-100 font-sans leading-relaxed pl-6 border-l border-white/5">
                    {content}
                </div>
            </div>
        );
    }

    // 2. Agent Report View
    return (
        <div className="w-full py-4 animate-in fade-in slide-in-from-bottom-2 duration-500 group">
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-xs font-bold text-gray-200 tracking-wide">{agentId}</span>
                <div className="h-3 w-px bg-white/10" />
                <span className="text-[9px] uppercase text-white/30 tracking-[0.15em]">
                    {phase}::REPORT
                </span>
            </div>

            {/* Content Body */}
            <div className="pl-9 relative">
                {/* Vertical Accent Line for the Report */}
                <div className="absolute left-[11px] top-0 bottom-0 w-px bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors" />
                
                {isTyping ? (
                    <div className="py-2">
                         <ThinkingIndicator phase={phase as any} />
                    </div>
                ) : (
                    <div className="text-[13px] text-gray-300 font-sans leading-7 selection:bg-emerald-500/30 selection:text-emerald-100">
                        <MarkdownMessage content={content} />
                    </div>
                )}
            </div>
        </div>
    );
}