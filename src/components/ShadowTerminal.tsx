"use client";
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ActionCardProps } from '@/types';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { aggregateRuns, RunGroup } from '@/lib/aggregators/runAggregator';
import { RunContainer } from './workbench/RunContainer';
import { WorkbenchToolbar } from './workbench/WorkbenchToolbar';

// Extended type to include streaming state
export type StreamItem = ActionCardProps & {
    isTyping?: boolean;
    isUser?: boolean;
};

export function ShadowTerminal({
    actions,
    splitView = false,
    onApprovePermission,
    onDenyPermission,
}: {
    actions: StreamItem[],
    splitView?: boolean,
    onApprovePermission?: (requestId: string) => void,
    onDenyPermission?: (requestId: string) => void,
}) {
    const [autoScroll, setAutoScroll] = useState(true);
    const [filter, setFilter] = useState('ALL');

    // Aggregate Runs
    // Note: Filtering logic should ideally happen inside aggregateRuns or before it
    // But for "Workbench" view, we generally want full context.
    const runGroups = useMemo(() => aggregateRuns(actions), [actions]);

    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [scrollBehavior, setScrollBehavior] = useState<'auto' | 'smooth'>('auto');

    // Auto-Scroll Logic
    useEffect(() => {
        if (!virtuosoRef.current || runGroups.length === 0) return;
        if (!autoScroll) return;

        // Simple scroll to bottom on update
        const t = setTimeout(() => {
            virtuosoRef.current?.scrollToIndex({ index: runGroups.length - 1, align: 'end', behavior: scrollBehavior });
        }, 50);
        
        // Enable smooth scrolling after initial load
        const behaviorTimer = setTimeout(() => setScrollBehavior('smooth'), 500);
        
        return () => { clearTimeout(t); clearTimeout(behaviorTimer); };
    }, [runGroups.length, autoScroll, scrollBehavior]);

    return (
        <div
            className="w-full h-full rounded flex flex-col overflow-hidden relative glass-slate font-mono crt-scanlines crt-flicker"
            role="region"
            aria-label="Shadow Terminal Output"
        >
            <WorkbenchToolbar
                onClear={() => {/* Parent handles clear via command usually, but we could add a prop */}}
                autoScroll={autoScroll}
                onToggleAutoScroll={() => setAutoScroll(prev => !prev)}
                filter={filter}
                onSetFilter={setFilter}
            />

            {/* Content Area - Now Run Based */}
            <div className="flex-1 min-h-0 pl-4">
                 <Virtuoso
                    ref={virtuosoRef}
                    className="h-full"
                    style={{ paddingBottom: '80px' }}
                    data={runGroups}
                    followOutput={autoScroll ? scrollBehavior : false}
                    initialTopMostItemIndex={runGroups.length - 1}
                    atBottomStateChange={setAutoScroll}
                    itemContent={(index, run) => (
                        <RunContainer 
                            run={run} 
                            isLast={index === runGroups.length - 1} 
                            onApprovePermission={onApprovePermission}
                            onDenyPermission={onDenyPermission}
                        />
                    )}
                />
            </div>
        </div>
    );
}
