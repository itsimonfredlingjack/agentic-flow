"use client";

import React, { useState, useEffect } from 'react';
import { BrainCircuit, Cpu, Zap, Activity } from 'lucide-react';
import clsx from 'clsx';

interface ThinkingIndicatorProps {
    phase?: 'plan' | 'build' | 'review' | 'deploy';
    compact?: boolean;
}

const PHASE_CONFIG = {
    plan: { color: 'text-blue-400', icon: BrainCircuit, label: 'REASONING' },
    build: { color: 'text-emerald-400', icon: Cpu, label: 'COMPUTING' },
    review: { color: 'text-amber-400', icon: Activity, label: 'ANALYZING' },
    deploy: { color: 'text-purple-400', icon: Zap, label: 'DEPLOYING' }
};

export function ThinkingIndicator({
    phase = 'build',
    compact = false,
}: ThinkingIndicatorProps) {
    const config = PHASE_CONFIG[phase] || PHASE_CONFIG.build;
    const Icon = config.icon;

    if (compact) {
        return (
            <div className="flex items-center gap-2 px-2 py-1 opacity-60">
                <Icon className={clsx("w-3 h-3 animate-pulse", config.color)} />
                <span className={clsx("text-[10px] font-mono", config.color)}>Thinking...</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 py-2 px-4 opacity-80 animate-pulse">
            {/* The Brain (Icon) */}
            <div className="relative">
                <Icon className={clsx("w-4 h-4", config.color)} />
                <div className={clsx("absolute inset-0 blur-lg opacity-50", config.color)} />
            </div>

            {/* The Neural Stream */}
            <div className="flex gap-1.5.5 h-3 items-end">
                {[...Array(5)].map((_, i) => (
                    <div
                        key={i}
                        className={clsx("w-1.5.5 rounded-full", config.color.replace('text-', 'bg-'))}
                        style={{
                            height: '100%',
                            animation: `neural-spike 1s ease-in-out infinite`,
                            animationDelay: `${i * 0.1}s`
                        }}
                    />
                ))}
            </div>

            <span className={clsx("text-xs font-mono font-bold tracking-widest", config.color)}>
                {config.label}
            </span>
        </div>
    );
}
