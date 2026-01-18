"use client";
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function ErrorCard({ title, content }: { title: string, content: string }) {
    return (
        <div className="w-full my-4 pl-12 pr-4 animate-in fade-in slide-in-from-bottom-1 duration-200">
            <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-4 flex gap-4">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-red-200 text-sm mb-1">{title}</div>
                    <pre className="text-xs text-red-300/80 font-mono whitespace-pre-wrap break-all">
                        {content}
                    </pre>
                </div>
            </div>
        </div>
    );
}
