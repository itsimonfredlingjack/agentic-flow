"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Loader2, AlertCircle, Cpu, Cloud, Zap } from 'lucide-react';

export type ModelStatus = 'ready' | 'loading' | 'error';

interface Model {
  id: string;
  name: string;
  type: 'local' | 'api';
  contextSize?: string;
  description?: string;
}

interface ModelSelectorProps {
  currentModel: string;
  status?: ModelStatus;
  onSelectModel: (modelId: string) => void;
  localModels?: Model[];
  apiModels?: Model[];
}

const defaultLocalModels: Model[] = [
  { id: 'qwen2.5-coder:3b', name: 'Qwen 2.5 Coder 3B', type: 'local', contextSize: '32K', description: 'Fast coding model' },
  { id: 'llama3.2:3b', name: 'Llama 3.2 3B', type: 'local', contextSize: '128K', description: 'General purpose' },
  { id: 'mistral:7b', name: 'Mistral 7B', type: 'local', contextSize: '32K', description: 'Balanced performance' },
  { id: 'codellama:7b', name: 'Code Llama 7B', type: 'local', contextSize: '16K', description: 'Code specialist' },
];

const defaultApiModels: Model[] = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', type: 'api', description: 'Anthropic' },
  { id: 'gpt-4o', name: 'GPT-4o', type: 'api', description: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', type: 'api', description: 'OpenAI (fast)' },
];

export function ModelSelector({
  currentModel,
  status = 'ready',
  onSelectModel,
  localModels = defaultLocalModels,
  apiModels = defaultApiModels,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const statusColor = {
    ready: 'var(--accent-emerald)',
    loading: 'var(--accent-sky)',
    error: 'var(--accent-rose)',
  }[status];

  const statusIcon = {
    ready: <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />,
    loading: <Loader2 className="w-3 h-3 animate-spin" style={{ color: statusColor }} />,
    error: <AlertCircle className="w-3 h-3" style={{ color: statusColor }} />,
  }[status];

  // Find display name for current model
  const allModels = [...localModels, ...apiModels];
  const currentModelInfo = allModels.find(m => m.id === currentModel);
  const displayName = currentModelInfo?.name || currentModel;
  const currentModelType = currentModelInfo?.type ?? 'local';

  const handleSelect = (modelId: string) => {
    onSelectModel(modelId);
    setIsOpen(false);
  };

  const modelMeta = [currentModelInfo?.contextSize, currentModelInfo?.description].filter(Boolean).join(' • ');

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md hover:border-[var(--text-tertiary)] transition-colors"
        title={modelMeta ? `${displayName} • ${modelMeta}` : displayName}
      >
        <Zap className="w-3.5 h-3.5 text-[var(--accent-sky)]" />
        {statusIcon}
        <span className={`model-dot ${currentModelType === 'api' ? 'model-dot--api' : 'model-dot--local'}`} />
        <span className="text-xs font-medium text-[var(--text-primary)] max-w-[120px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-64 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-xl overflow-hidden z-50"
        >
          {/* Local Models */}
          <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
              <Cpu className="w-3.5 h-3.5" />
              <span>Local Models</span>
            </div>
          </div>
          <div className="py-1">
            {localModels.map((model) => (
              <button
                key={model.id}
                onClick={() => handleSelect(model.id)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-elevated)] transition-colors text-left"
              >
                <div className="w-4 flex justify-center">
                  {model.id === currentModel && (
                    <Check className="w-4 h-4 text-[var(--accent-emerald)]" />
                  )}
                </div>
                <span className={`model-dot ${model.type === 'api' ? 'model-dot--api' : 'model-dot--local'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {model.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                    {model.contextSize && <span>{model.contextSize}</span>}
                    {model.description && <span>• {model.description}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* API Models */}
          <div className="px-3 py-2 border-y border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
              <Cloud className="w-3.5 h-3.5" />
              <span>API Models</span>
            </div>
          </div>
          <div className="py-1">
            {apiModels.map((model) => (
              <button
                key={model.id}
                onClick={() => handleSelect(model.id)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-elevated)] transition-colors text-left"
              >
                <div className="w-4 flex justify-center">
                  {model.id === currentModel && (
                    <Check className="w-4 h-4 text-[var(--accent-emerald)]" />
                  )}
                </div>
                <span className={`model-dot ${model.type === 'api' ? 'model-dot--api' : 'model-dot--local'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {model.name}
                  </div>
                  {model.description && (
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {model.description}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
