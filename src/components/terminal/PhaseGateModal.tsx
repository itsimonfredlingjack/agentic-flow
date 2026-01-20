"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Check, X, AlertCircle, ArrowRight } from 'lucide-react';

export type PhaseArtifact = {
  id: string;
  name: string;
  preview?: string;
  meta?: string;
};

export type PhaseTransition = {
  from: string;
  to: string;
  summary: string;
  artifacts?: Array<string | PhaseArtifact>;
  changes?: string[];
  lastHandoffAt?: string;
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

  const artifacts = useMemo<PhaseArtifact[]>(() => (
    transition.artifacts || []
  ).map((artifact, index) => {
    if (typeof artifact === 'string') {
      return {
        id: `artifact-${index}`,
        name: artifact,
      };
    }

    return {
      id: artifact.id || `artifact-${index}`,
      name: artifact.name,
      preview: artifact.preview,
      meta: artifact.meta,
    };
  }), [transition.artifacts]);

  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (artifacts.length === 0) {
      setSelectedArtifactId(null);
      return;
    }
    const firstWithPreview = artifacts.find((artifact) => artifact.preview)?.id;
    setSelectedArtifactId((prev) => prev || firstWithPreview || artifacts[0].id);
  }, [artifacts, isOpen]);

  const selectedArtifact = artifacts.find((artifact) => artifact.id === selectedArtifactId) || artifacts[0];

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
          {transition.lastHandoffAt && (
            <div className="phase-gate-modal__handoff-badge">Last handoff: {transition.lastHandoffAt}</div>
          )}
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

            <div className="phase-gate-modal__changes">
              <div className="phase-gate-modal__changes-header">Changes since last handoff</div>
              {transition.changes && transition.changes.length > 0 ? (
                <ul className="phase-gate-modal__changes-list">
                  {transition.changes.map((change, index) => (
                    <li key={index} className="phase-gate-modal__change-item">
                      {change}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="phase-gate-modal__changes-empty">
                  No changes detected since the previous handoff.
                </div>
              )}
            </div>
          </div>

          <div className="phase-gate-modal__artifacts">
            <div className="phase-gate-modal__artifacts-header">
              <h3 className="phase-gate-modal__artifacts-title">Transfer Package</h3>
              <span className="phase-gate-modal__artifacts-count">
                {artifacts.length} items
              </span>
            </div>
            {artifacts.length > 0 ? (
              <ul className="phase-gate-modal__artifacts-list">
                {artifacts.map((artifact) => (
                  <li key={artifact.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedArtifactId(artifact.id)}
                      className={`phase-gate-modal__artifact ${artifact.id === selectedArtifact?.id ? 'phase-gate-modal__artifact--active' : ''}`}
                    >
                      <span className="phase-gate-modal__artifact-status">
                        <Check className="phase-gate-modal__artifact-icon" />
                      </span>
                      <span className="phase-gate-modal__artifact-name">{artifact.name}</span>
                      {artifact.meta && (
                        <span className="phase-gate-modal__artifact-meta">{artifact.meta}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="phase-gate-modal__artifacts-empty">
                No artifacts attached to this handoff.
              </div>
            )}

            <div className="phase-gate-modal__preview">
              <div className="phase-gate-modal__preview-header">
                <span>Artifact Preview</span>
                {selectedArtifact?.name && (
                  <span className="phase-gate-modal__preview-label">{selectedArtifact.name}</span>
                )}
              </div>
              <div className="phase-gate-modal__preview-body">
                {selectedArtifact?.preview ? (
                  <pre className="phase-gate-modal__preview-content">{selectedArtifact.preview}</pre>
                ) : (
                  <div className="phase-gate-modal__preview-empty">
                    Select an artifact to see a preview.
                  </div>
                )}
              </div>
            </div>
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
