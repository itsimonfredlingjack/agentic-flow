"use client";
import React from 'react';
import { clsx } from 'clsx';
import { Circle, CheckCircle2, XCircle, Clock } from 'lucide-react';

export function TimelineSpine({ status, isLast }: { status: 'running' | 'done' | 'failed' | 'cancelled', isLast: boolean }) {
    return (
        <div className="flex flex-col items-center w-8 shrink-0 relative mr-4">
            {/* The Line */}
            <div className="absolute top-0 bottom-0 w-px bg-white/10" />

            {/* The Node */}
            <div className="relative z-10 mt-6 bg-black p-1 rounded-full border border-black">
                {status === 'running' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                )}
                {status === 'done' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                )}
                {status === 'failed' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                )}
                {status === 'cancelled' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                )}
            </div>
        </div>
    );
}
