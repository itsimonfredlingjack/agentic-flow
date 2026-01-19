"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Code2, X } from 'lucide-react';

interface AIPairPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSendCode: (code: string) => void;
}

interface FeedbackMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: string;
}

export function AIPairPanel({
  isOpen,
  onClose,
  onSendCode,
}: AIPairPanelProps) {
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<FeedbackMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const codeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const feedbackEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedbackEndRef.current) {
      feedbackEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [feedback]);

  const handleCodeChange = (value: string) => {
    setCode(value);
    
    // Simulated instant feedback (in real impl, this would call the agent)
    if (value.length > 20 && !isAnalyzing) {
      setIsAnalyzing(true);
      setTimeout(() => {
        const newFeedback: FeedbackMessage = {
          id: Date.now().toString(),
          type: 'agent',
          content: '💡 Suggestion: Consider adding error handling here',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setFeedback(prev => [...prev, newFeedback]);
        setIsAnalyzing(false);
      }, 1500);
    }
  };

  const handleSend = () => {
    if (!code.trim()) return;

    const userMessage: FeedbackMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: code,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setFeedback(prev => [...prev, userMessage]);
    onSendCode(code);
    setCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="ai-pair-panel">
      {/* Header */}
      <div className="ai-pair-panel__header">
        <div className="ai-pair-panel__title-group">
          <Sparkles className="ai-pair-panel__icon" />
          <h3 className="ai-pair-panel__title">AI Pair Programming</h3>
        </div>
        <button
          onClick={onClose}
          className="ai-pair-panel__close"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Code Editor */}
      <div className="ai-pair-panel__editor">
        <div className="ai-pair-panel__editor-header">
          <Code2 className="w-3.5 h-3.5" />
          <span>Your Code</span>
        </div>
        <textarea
          ref={codeTextareaRef}
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="ai-pair-panel__textarea"
          placeholder="// Type or paste your code here...
// The AI will give instant feedback"
          spellCheck={false}
        />
        <button
          onClick={handleSend}
          className="ai-pair-panel__send-button"
          disabled={!code.trim()}
        >
          <Send className="w-3.5 h-3.5" />
          Send for Review
        </button>
      </div>

      {/* Feedback Stream */}
      <div className="ai-pair-panel__feedback">
        <div className="ai-pair-panel__feedback-header">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Live Feedback</span>
        </div>
        <div className="ai-pair-panel__feedback-list">
          {feedback.length === 0 ? (
            <div className="ai-pair-panel__feedback-empty">
              Start typing code to get instant AI feedback...
            </div>
          ) : (
            feedback.map((msg) => (
              <div
                key={msg.id}
                className={`ai-pair-panel__message ai-pair-panel__message--${msg.type}`}
              >
                <div className="ai-pair-panel__message-content">{msg.content}</div>
                <div className="ai-pair-panel__message-time">{msg.timestamp}</div>
              </div>
            ))
          )}
          {isAnalyzing && (
            <div className="ai-pair-panel__analyzing">
              <div className="ai-pair-panel__analyzing-dot" />
              <div className="ai-pair-panel__analyzing-dot" />
              <div className="ai-pair-panel__analyzing-dot" />
            </div>
          )}
          <div ref={feedbackEndRef} />
        </div>
      </div>
    </div>
  );
}
