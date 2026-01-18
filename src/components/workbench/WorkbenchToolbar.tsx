"use client";
import React from 'react';
import { clsx } from 'clsx';
import { Filter, SlidersHorizontal, ArrowDownCircle, Trash2 } from 'lucide-react';

export function WorkbenchToolbar({
    onClear,
    autoScroll,
    onToggleAutoScroll,
    filter,
    onSetFilter
}: {
    onClear: () => void;
    autoScroll: boolean;
    onToggleAutoScroll: () => void;
    filter: string;
    onSetFilter: (f: string) => void;
}) {
    return (
        <div className="h-10 border-b border-white/10 flex items-center px-4 justify-between bg-white/5 z-10 gap-4 shrink-0 backdrop-blur-md">
            {/* Left: Branding & Filters */}
            <div className="flex items-center gap-4">
                <div className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    WORKBENCH::ACTIVE
                </div>
                <div className="h-4 w-px bg-white/10" />
                <div className="flex items-center gap-1">
                    {['ALL', 'ERRORS', 'CMDS'].map((f) => (
                        <button
                            key={f}
                            onClick={() => onSetFilter(f)}
                            className={clsx(
                                "text-[10px] px-2 py-1 rounded hover:bg-white/10 transition-colors font-mono",
                                filter === f ? "text-white bg-white/10" : "text-white/40"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={onToggleAutoScroll}
                    className={clsx(
                        "p-1.5 rounded hover:bg-white/10 transition-colors",
                        autoScroll ? "text-emerald-400" : "text-white/40"
                    )}
                    title="Toggle Auto-Scroll"
                >
                    <ArrowDownCircle className="w-4 h-4" />
                </button>
                <button
                    onClick={onClear}
                    className="p-1.5 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
                    title="Clear Console"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
