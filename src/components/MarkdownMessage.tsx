"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Play, Zap, FileCode2, FileJson, Terminal, Palette, Code2, Braces, FileCode, ExternalLink } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { agencyClient } from '@/lib/client';
import { ThinkingBlock } from './ThinkingBlock';

// Parse thinking blocks from content
function parseThinkingBlocks(content: string): { thinking: string | null; rest: string } {
    const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/gi;
    const matches = content.match(thinkingRegex);

    if (!matches || matches.length === 0) {
        return { thinking: null, rest: content };
    }

    const thinkingContent = matches
        .map(match => match.replace(/<\/?thinking>/gi, '').trim())
        .join('\n');

    const rest = content.replace(thinkingRegex, '').trim();

    return { thinking: thinkingContent, rest };
}

// Language to icon mapping
function getLanguageIcon(language: string | undefined) {
    const lang = (language || '').toLowerCase();
    const iconProps = { size: 14, className: 'text-white/40 group-hover:text-white transition-colors' };

    switch (lang) {
        case 'typescript':
        case 'tsx':
            return <FileCode2 {...iconProps} />;
        case 'javascript':
        case 'jsx':
            return <FileJson {...iconProps} />;
        case 'python':
        case 'py':
            return <FileCode {...iconProps} />;
        case 'bash':
        case 'sh':
        case 'shell':
        case 'zsh':
            return <Terminal {...iconProps} />;
        case 'css':
        case 'scss':
        case 'sass':
            return <Palette {...iconProps} />;
        case 'html':
            return <Code2 {...iconProps} />;
        case 'json':
            return <Braces {...iconProps} />;
        default:
            return <FileCode {...iconProps} />;
    }
}

// Get CSS class for language-specific glow
function getGlowClass(language: string | undefined): string {
    const lang = (language || '').toLowerCase();
    if (['typescript', 'ts'].includes(lang)) return 'border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]';
    if (['tsx'].includes(lang)) return 'border-blue-400/30 shadow-[0_0_20px_rgba(96,165,250,0.1)]';
    if (['javascript', 'js'].includes(lang)) return 'border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.1)]';
    if (['jsx'].includes(lang)) return 'border-yellow-400/30 shadow-[0_0_20px_rgba(250,204,21,0.1)]';
    if (['python', 'py'].includes(lang)) return 'border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]';
    if (['bash', 'sh', 'shell', 'zsh'].includes(lang)) return 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]';
    if (['css', 'scss', 'sass'].includes(lang)) return 'border-pink-500/30 shadow-[0_0_20px_rgba(236,72,153,0.1)]';
    if (['html'].includes(lang)) return 'border-orange-500/30 shadow-[0_0_20_rgba(249,115,22,0.1)]';
    if (['json'].includes(lang)) return 'border-gray-500/30 shadow-[0_0_20px_rgba(107,114,128,0.1)]';
    return 'border-white/10 shadow-xl';
}

type MarkdownMessageProps = {
    content: string;
    className?: string;
};

const normalizeLanguage = (language: string | undefined) => {
    const lower = (language || '').toLowerCase();
    if (!lower) return '';
    if (lower === 'ts') return 'typescript';
    if (lower === 'tsx') return 'tsx';
    if (lower === 'js') return 'javascript';
    if (lower === 'jsx') return 'jsx';
    if (lower === 'sh') return 'bash';
    if (lower === 'shell') return 'bash';
    if (lower === 'py') return 'python';
    return lower;
};

const getStringProp = (value: unknown, key: string): string | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const record = value as Record<string, unknown>;
    const prop = record[key];
    return typeof prop === 'string' ? prop : undefined;
};

const looksLikeRelativeFilePath = (value: string) => {
    if (!value) return false;
    if (value.includes('\0')) return false;
    if (value.startsWith('/')) return false;
    if (value.startsWith('~')) return false;
    if (value.includes('..')) return false;
    return /^[a-zA-Z0-9._\/-]+$/.test(value);
};

const extractInlineFileDirective = (value: string) => {
    const lines = value.split('\n');
    if (lines.length === 0) return { filePath: undefined as string | undefined, cleanedValue: value };

    const firstLine = lines[0].trim();
    const match = firstLine.match(/^(?:\/\/|#|\/\*+|<!--)\s*(?:file|path|filename)\s*[:=]\s*([^\s*]+)\s*(?:\*\/|-->)?\s*$/i);
    if (!match) return { filePath: undefined as string | undefined, cleanedValue: value };

    const candidate = match[1]?.trim();
    if (!candidate || !looksLikeRelativeFilePath(candidate)) {
        return { filePath: undefined as string | undefined, cleanedValue: value };
    }

    return { filePath: candidate, cleanedValue: lines.slice(1).join('\n') };
};

const parseCodeFenceMeta = (meta: string | undefined) => {
    if (!meta) return { filePath: undefined as string | undefined };
    const tokens = meta.split(/\s+/).map((t) => t.trim()).filter(Boolean);

    for (const token of tokens) {
        const match = token.match(/^(file|path|filename)=(.+)$/i);
        if (match) {
            const candidate = match[2]?.trim();
            if (candidate && looksLikeRelativeFilePath(candidate)) return { filePath: candidate };
        }
    }

    for (const token of tokens) {
        if (looksLikeRelativeFilePath(token)) return { filePath: token };
    }

    return { filePath: undefined as string | undefined };
};

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'fish', 'cmd', 'powershell', 'ps']);
const COMMAND_START_RE = /^ (npm|pnpm|yarn|bun|npx|node|python|pip|cargo|git|rg|ls|cat|cd|mkdir|rm|mv|cp)\b/i;

type CommandLine = {
    raw: string;
    command: string;
};

const parseCommandLines = (value: string): CommandLine[] => {
    const lines = value.split('\n');
    const commands: CommandLine[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('#')) continue;

        if (/^[$>]/.test(trimmed)) {
            const command = trimmed.replace(/^[$>]\s*/, '');
            if (command) commands.push({ raw: trimmed, command });
            continue;
        }

        if (COMMAND_START_RE.test(trimmed)) {
            commands.push({ raw: trimmed, command: trimmed });
        }
    }

    return commands;
};

function CopyButton({ value }: { value: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            type="button"
            onClick={() => {
                void navigator.clipboard.writeText(value);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
            }}
            className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            title="Copy Code"
        >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
    );
}

function ApplyButton({
    filePath,
    value,
    onApplied,
}: {
    filePath?: string;
    value: string;
    onApplied: () => void;
}) {
    const [state, setState] = useState<'idle' | 'applying' | 'applied' | 'error'>('idle');

    const handleApply = async () => {
        if (!filePath) return;
        setState('applying');
        try {
            const res = await fetch('/api/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'apply', path: filePath, content: value }),
            });
            if (res.ok) {
                setState('applied');
                onApplied();
                setTimeout(() => setState('idle'), 2000);
            } else {
                setState('error');
                setTimeout(() => setState('idle'), 2000);
            }
        } catch {
            setState('error');
            setTimeout(() => setState('idle'), 2000);
        }
    };

    if (!filePath) return null;

    return (
        <button
            type="button"
            onClick={handleApply}
            className={clsx(
                "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border",
                state === 'applied' 
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                    : state === 'error'
                    ? "bg-red-500/20 border-red-500/40 text-red-400"
                    : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10"
            )}
        >
            {state === 'applying' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap size={12} />}
            {state === 'applied' ? 'Applied' : 'Deploy'}
        </button>
    );
}

function Loader2({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
    );
}

function CodeFence({
    language,
    filePath,
    value,
}: {
    language: string | undefined;
    filePath: string | undefined;
    value: string;
}) {
    const [appliedPulse, setAppliedPulse] = useState(0);
    const [resolvedPath, setResolvedPath] = useState<string | undefined>(filePath);

    const glowClass = getGlowClass(language);
    const lines = value.split('\n');
    const showLineNumbers = lines.length > 2;

    return (
        <motion.div
            className={clsx(
                "my-6 rounded border bg-[#0a0a0a] overflow-hidden relative group/editor transition-all duration-300",
                glowClass
            )}
            animate={appliedPulse > 0 ? { scale: [1, 0.99, 1] } : undefined}
        >
            {/* Editor Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5 mr-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 group-hover/editor:bg-red-500/50 transition-colors" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 group-hover/editor:bg-amber-500/50 transition-colors" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 group-hover/editor:bg-emerald-500/50 transition-colors" />
                    </div>
                    <div className="h-4 w-px bg-white/10 mx-1" />
                    <div className="flex items-center gap-2">
                        {getLanguageIcon(language)}
                        <span className="text-[11px] font-mono text-white/60 tracking-tight truncate max-w-[200px]">
                            {resolvedPath || (language || 'plain_text').toUpperCase()}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <CopyButton value={value} />
                    <ApplyButton
                        filePath={resolvedPath}
                        value={value}
                        onApplied={() => setAppliedPulse(p => p + 1)}
                    />
                </div>
            </div>

            {/* Editor Content Area */}
            <div className="relative flex min-h-[40px]">
                {showLineNumbers && (
                    <div className="w-10 shrink-0 bg-[#0d0d0d] border-right border-white/5 flex flex-col items-center pt-3 select-none">
                        {lines.map((_, i) => (
                            <span key={i} className="text-[10px] font-mono text-white/20 leading-6">{i + 1}</span>
                        ))}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <SyntaxHighlighter
                        language={language || undefined}
                        style={vscDarkPlus}
                        customStyle={{
                            margin: 0,
                            background: 'transparent',
                            padding: '12px',
                            fontSize: '12px',
                            lineHeight: '1.5',
                        }}
                        codeTagProps={{
                            style: {
                                fontFamily: 'var(--font-geist-mono), monospace',
                            },
                        }}
                    >
                        {value}
                    </SyntaxHighlighter>
                </div>
            </div>
        </motion.div>
    );
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
    const { thinking, rest } = useMemo(() => parseThinkingBlocks(content), [content]);
    const trimmed = useMemo(() => rest.trimEnd(), [rest]);

    return (
        <div className={clsx("text-gray-300 leading-relaxed font-sans", className)}>
            {thinking && <ThinkingBlock content={thinking} defaultExpanded={false} />}

            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    p({ children }) {
                        return <p className="mb-4 last:mb-0 leading-7">{children}</p>;
                    },
                    ul({ children }) {
                        return <ul className="mb-4 last:mb-0 ml-6 list-disc space-y-1">{children}</ul>;
                    },
                    ol({ children }) {
                        return <ol className="mb-4 last:mb-0 ml-6 list-decimal space-y-1">{children}</ol>;
                    },
                    h1({ children }) { return <h1 className="text-xl font-bold text-white mt-6 mb-4">{children}</h1>; },
                    h2({ children }) { return <h2 className="text-lg font-bold text-white mt-5 mb-3">{children}</h2>; },
                    h3({ children }) { return <h3 className="text-md font-bold text-white mt-4 mb-2">{children}</h3>; },
                    code({ className: codeClassName, children, node, ...props }) {
                        const match = /language-(\w+)/.exec(codeClassName || '');
                        const language = normalizeLanguage(match?.[1]);
                        const raw = String(children ?? '');
                        const value = raw.replace(/\n$/, '');
                        const meta = getStringProp(node as unknown, 'meta');
                        const { filePath } = parseCodeFenceMeta(meta);
                        const { filePath: inlinePath, cleanedValue } = extractInlineFileDirective(value);
                        const resolvedPath = filePath ?? inlinePath;
                        const finalValue = inlinePath ? cleanedValue : value;

                        const isBlock = Boolean(match);
                        if (!isBlock) {
                            return (
                                <code
                                    className="px-1.5 py-0.5 rounded bg-white/10 border border-white/5 text-emerald-300 font-mono text-[0.9em]"
                                    {...props}
                                >
                                    {children}
                                </code>
                            );
                        }

                        return <CodeFence language={language || undefined} filePath={resolvedPath} value={finalValue} />; 
                    },
                    pre({ children }) {
                        return <>{children}</>;
                    },
                }}
            >
                {trimmed}
            </ReactMarkdown>
        </div>
    );
}
