"use client";

import React, { useState, useRef } from 'react';
import { Maximize2, Minimize2, Trash2, Copy, Download } from 'lucide-react';

export interface CanvasCodeBlock {
  id: string;
  content: string;
  language: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CodeCanvasProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CodeCanvas({ isOpen, onClose }: CodeCanvasProps) {
  const [blocks, setBlocks] = useState<CanvasCodeBlock[]>([]);
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent, blockId: string) => {
    e.dataTransfer.setData('text/plain', blockId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedBlock(blockId);
    const block = blocks.find(b => b.id === blockId);
    if (block) {
      setDragOffset({
        x: e.clientX - block.x,
        y: e.clientY - block.y,
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/x-llm-code-block')) {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const payload = e.dataTransfer.getData('application/x-llm-code-block');

    if (payload) {
      try {
        const parsed = JSON.parse(payload) as { content?: string; language?: string; filePath?: string };
        if (parsed && typeof parsed.content === 'string') {
          const content = parsed.content;
          const label = parsed.filePath || parsed.language || 'text';
          const lines = content.split('\n');
          const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
          const width = Math.min(Math.max(260, longestLine * 7 + 80), 520);
          const height = Math.min(Math.max(160, lines.length * 18 + 80), 420);
          const x = Math.max(8, Math.min(rect.width - width - 8, e.clientX - rect.left - width / 2));
          const y = Math.max(8, Math.min(rect.height - height - 8, e.clientY - rect.top - 24));

          setBlocks(prev => ([
            ...prev,
            {
              id: `block-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
              content,
              language: label,
              x,
              y,
              width,
              height,
            },
          ]));
          return;
        }
      } catch (err) {
        console.warn('Invalid code block payload', err);
      }
    }

    if (!draggedBlock) return;

    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;

    setBlocks(prev =>
      prev.map(block =>
        block.id === draggedBlock
          ? { ...block, x, y }
          : block
      )
    );
    setDraggedBlock(null);
  };

  const handleDeleteBlock = (blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId));
  };

  const handleCopyBlock = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  if (!isOpen) return null;

  return (
    <div className="code-canvas-overlay">
      <div className="code-canvas">
        {/* Header */}
        <div className="code-canvas__header">
          <div className="code-canvas__title-group">
            <Maximize2 className="code-canvas__icon" />
            <h3 className="code-canvas__title">Code Canvas</h3>
            <span className="code-canvas__count">{blocks.length} blocks</span>
          </div>
          <div className="code-canvas__actions">
            <button
              className="code-canvas__action-button"
              title="Download as image"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="code-canvas__action-button"
              title="Minimize canvas"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          ref={canvasRef}
          className="code-canvas__workspace"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {blocks.length === 0 ? (
            <div className="code-canvas__empty">
              <div className="code-canvas__empty-icon">📦</div>
              <p className="code-canvas__empty-text">
                Drag code blocks from terminal output here
              </p>
              <p className="code-canvas__empty-hint">
                Arrange them visually to plan your architecture
              </p>
            </div>
          ) : (
            blocks.map((block) => (
              <div
                key={block.id}
                className="code-canvas__block"
                style={{
                  left: `${block.x}px`,
                  top: `${block.y}px`,
                  width: `${block.width}px`,
                  height: `${block.height}px`,
                }}
                draggable
                onDragStart={(e) => handleDragStart(e, block.id)}
              >
                <div className="code-canvas__block-header">
                  <span className="code-canvas__block-language">{block.language}</span>
                  <div className="code-canvas__block-actions">
                    <button
                      onClick={() => handleCopyBlock(block.content)}
                      className="code-canvas__block-action"
                      title="Copy"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteBlock(block.id)}
                      className="code-canvas__block-action"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <pre className="code-canvas__block-content">
                  <code>{block.content}</code>
                </pre>
              </div>
            ))
          )}
        </div>

        {/* Instructions */}
        <div className="code-canvas__footer">
          <div className="code-canvas__hint">
            💡 Tip: Look for the drag handle on code blocks in terminal output
          </div>
        </div>
      </div>
    </div>
  );
}
