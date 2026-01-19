"use client";

import React, { useEffect } from 'react';
import { Check, X, AlertCircle, ArrowRight } from 'lucide-react';

export type PhaseTransition = {
  from: string;
  to: string;
  summary: string;
  artifacts?: string[];
};

interface PhaseGateModalProps {
  transition: PhaseTransition;
  onApprove: () => void;
  onReject: () => void;
  isOpen: boolean;
}

export function PhaseGateModal({
  transition,
  onApprove,
  onReject,
  isOpen,
}: PhaseGateModalProps) {
  if (!isOpen) return null;

  const roleLabels: Record<string, string> = {
    PLAN: 'Architect',
    BUILD: 'Engineer',
    REVIEW: 'Critic',
    DEPLOY: 'Deployer',
  };

  const fromLabel = roleLabels[transition.from] || transition.from;
  const toLabel = roleLabels[transition.to] || transition.to;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!isOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onReject();
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        onApprove();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onApprove, onReject]);

  return (
    <div className="phase-gate-overlay">
      <div className="phase-gate-modal">
        {/* Header */}
        <div className="phase-gate-modal__header">
          <div className="phase-gate-modal__badge">
            <AlertCircle className="phase-gate-modal__icon" />
            Checkpoint
          </div>
          <div className="phase-gate-modal__title-group">
            <h2 className="phase-gate-modal__title">
              Ready to {toLabel}?
            </h2>
            <p className="phase-gate-modal__subtitle">
              Confirm handoff from {fromLabel} to {toLabel}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="phase-gate-modal__content">
          <div className="phase-gate-modal__summary">
            <div className="phase-gate-modal__transition">
              <span className="phase-gate-modal__phase phase-gate-modal__phase--from">
                {fromLabel}
              </span>
              <ArrowRight className="phase-gate-modal__arrow" />
              <span className="phase-gate-modal__phase phase-gate-modal__phase--to">
                {toLabel}
              </span>
            </div>

            <p className="phase-gate-modal__summary-text">{transition.summary}</p>
            <div className="phase-gate-modal__keys">
              <span><kbd>Enter</kbd> Approve</span>
              <span><kbd>Esc</kbd> Review</span>
            </div>
          </div>

          <div className="phase-gate-modal__artifacts">
            <div className="phase-gate-modal__artifacts-header">
              <h3 className="phase-gate-modal__artifacts-title">Transfer Package</h3>
              <span className="phase-gate-modal__artifacts-count">
                {transition.artifacts?.length || 0} items
              </span>
            </div>
            {transition.artifacts && transition.artifacts.length > 0 ? (
              <ul className="phase-gate-modal__artifacts-list">
                {transition.artifacts.map((artifact, i) => (
                  <li key={i} className="phase-gate-modal__artifact">
                    <span className="phase-gate-modal__artifact-status">
                      <Check className="phase-gate-modal__artifact-icon" />
                    </span>
                    <span>{artifact}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="phase-gate-modal__artifacts-empty">
                No artifacts attached to this handoff.
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="phase-gate-modal__actions">
          <button
            onClick={onReject}
            className="phase-gate-modal__button phase-gate-modal__button--reject"
          >
            <X className="w-4 h-4" />
            Review Needed
          </button>
          <button
            onClick={onApprove}
            className="phase-gate-modal__button phase-gate-modal__button--approve"
          >
            <Check className="w-4 h-4" />
            Approve Handoff
          </button>
        </div>
      </div>
    </div>
  );
}
