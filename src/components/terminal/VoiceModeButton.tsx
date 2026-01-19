"use client";

import React, { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceModeButtonProps {
  onToggle?: (enabled: boolean) => void;
}

export function VoiceModeButton({ onToggle }: VoiceModeButtonProps) {
  const [isEnabled, setIsEnabled] = useState(false);

  const handleClick = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    onToggle?.(newState);
  };

  return (
    <button
      onClick={handleClick}
      className={`voice-mode-button ${isEnabled ? 'voice-mode-button--active' : ''}`}
      aria-label={isEnabled ? 'Disable voice mode' : 'Enable voice mode'}
      title="Voice Mode (Coming Soon)"
    >
      {isEnabled ? (
        <Mic className="voice-mode-button__icon" />
      ) : (
        <MicOff className="voice-mode-button__icon" />
      )}
      <span className="voice-mode-button__label">
        {isEnabled ? 'Voice Active' : 'Voice Mode'}
      </span>
      {isEnabled && (
        <span className="voice-mode-button__pulse" />
      )}
    </button>
  );
}
