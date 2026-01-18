"use client";
import React from 'react';
import { RunGroup } from '@/lib/aggregators/runAggregator';
import { TimelineSpine } from './TimelineSpine';
import { PhaseCard } from '../stream-cards/PhaseCard';
import { AgentMessageCard } from '../stream-cards/AgentMessageCard';
import { CommandBlock } from '../stream-cards/CommandBlock';
import { ErrorCard } from '../stream-cards/ErrorCard';

export function RunContainer({ run, isLast, onApprovePermission, onDenyPermission }: {
    run: RunGroup,
    isLast: boolean,
    onApprovePermission?: (requestId: string) => void,
    onDenyPermission?: (requestId: string) => void
}) {
    return (
        <div className="flex w-full min-h-[80px]">
            {/* Left Spine */}
            <TimelineSpine status={run.status} isLast={isLast} />

            {/* Content Body */}
            <div className="flex-1 pb-12 pt-4">
                {/* Run Header (User Prompt) */}
                {run.userPrompt && (
                    <div className="mb-6">
                        <div className="text-sm font-bold text-white tracking-wide mb-1">
                            {run.userPrompt}
                        </div>
                        <div className="text-[10px] text-white/30 font-mono">
                            RUN ID: {run.id} • {run.startTime}
                        </div>
                    </div>
                )}

                {/* Event Stack */}
                <div className="flex flex-col gap-2 pl-4 border-l border-white/5">
                    {run.items.map((item, idx) => {
                        // Render Semantic Blocks
                        if (item.type === 'phase_transition') {
                            return <PhaseCard key={item.id} phase={item.phase} />;
                        }
                        if (item.type === 'command_block') {
                            return <CommandBlock key={item.id} command={item.content} output={item.payload?.output as string} isRunning={item.payload?.isRunning as boolean} />;
                        }
                        if (item.type === 'error') {
                            return <ErrorCard key={item.id} title={item.title} content={item.content} />;
                        }
                        if (item.agentId === 'QWEN' || item.isTyping) {
                            return (
                                <AgentMessageCard
                                    key={item.id}
                                    agentId={item.agentId || 'Unknown'}
                                    content={item.content}
                                    isTyping={item.isTyping}
                                    phase={item.phase}
                                />
                            );
                        }
                        // Fallback for generic logs (or if we skipped AgentMessageCard for user)
                        // Note: User prompt is now the HEADER, so we don't render it again as a card.
                        if (item.isUser) return null;

                        return (
                            <div key={item.id} className="text-xs text-gray-500 font-mono py-1">
                                <span className="text-white/20 mr-2">[{item.timestamp}]</span>
                                {item.content}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
