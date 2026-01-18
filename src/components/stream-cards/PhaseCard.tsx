"use client";
import React from 'react';
import { clsx } from 'clsx';
import { Layers, Hammer, Shield, Rocket } from 'lucide-react';

const PHASE_CONFIG = {
    plan: { color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10', icon: Layers, label: 'PLANNING' },
    build: { color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', icon: Hammer, label: 'BUILDING' },
    review: { color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', icon: Shield, label: 'REVIEWING' },
    deploy: { color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10', icon: Rocket, label: 'DEPLOYING' }
};

export function PhaseCard({ phase }: { phase: string }) {
    const p = phase.toLowerCase() as keyof typeof PHASE_CONFIG;
    const config = PHASE_CONFIG[p] || PHASE_CONFIG.plan;
    const Icon = config.icon;

    return (
        <div className="w-full flex items-center justify-center py-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className={clsx(
                "relative flex items-center gap-3 px-6 py-2 rounded-full border backdrop-blur-md",
                config.border,
                config.bg
            )}>
                <Icon className={clsx("w-4 h-4", config.color)} />
                <span className={clsx("text-xs font-bold tracking-[0.2em] uppercase", config.color)}>
                    PHASE: {config.label}
                </span>
                {/* Glow effect */}
                <div className={clsx("absolute inset-0 rounded-full opacity-20 blur-xl", config.bg)} />
            </div>
        </div>
    );
}
