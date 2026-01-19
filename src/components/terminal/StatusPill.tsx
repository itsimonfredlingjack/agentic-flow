"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';

export type AgentStatus = 'ready' | 'thinking' | 'running' | 'error';

interface StatusPillProps {
  status: AgentStatus;
  agentName?: string;
  modelName?: string;
  sessionId?: string;
  onClick?: () => void;
}

const STATUS_CONFIG = {
  ready: { label: 'Ready', color: 'var(--accent-emerald)' },
  thinking: { label: 'Thinking', color: 'var(--accent-violet)' },
  running: { label: 'Running', color: 'var(--accent-sky)' },
  error: { label: 'Error', color: 'var(--accent-rose)' },
} as const;

// Snappy spring animation
const snapSpring: Transition = { type: 'spring', stiffness: 500, damping: 30 };

export function StatusPill({
  status,
  agentName,
  modelName,
  sessionId,
  onClick,
}: StatusPillProps) {
  const [expanded, setExpanded] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);

  // Close expanded view when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    if (expanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [expanded]);

  const config = STATUS_CONFIG[status];
  const isActive = status === 'thinking' || status === 'running';

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setExpanded(!expanded);
    }
  };

  return (
    <div className="relative" ref={pillRef}>
      <motion.div
        className="status-pill cursor-pointer"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        // Breathing animation for active states
        animate={isActive ? {
          scale: [1, 1.03, 1],
        } : { scale: 1 }}
        transition={isActive ? {
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut'
        } : snapSpring}
        whileTap={{ scale: 0.97 }}
      >
        {/* Status dot with color transition */}
        <motion.span
          className="status-pill__dot"
          style={{ backgroundColor: config.color }}
          animate={{
            boxShadow: isActive 
              ? `0 0 8px 2px ${config.color}`
              : `0 0 0 0px ${config.color}`
          }}
          transition={{ duration: 0.3 }}
        />
        
        {/* Animated label with presence */}
        <AnimatePresence mode="wait">
          <motion.span
            key={status}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={snapSpring}
          >
            {config.label}
          </motion.span>
        </AnimatePresence>

        {/* Three-dot loader for thinking */}
        {status === 'thinking' && (
          <div className="flex gap-0.5 ml-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1 h-1 rounded-full"
                style={{ backgroundColor: config.color }}
                animate={{ y: [0, -3, 0] }}
                transition={{
                  duration: 0.4,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: 'easeInOut'
                }}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Expanded dropdown with spring animation */}
      <AnimatePresence>
        {expanded && (agentName || modelName || sessionId) && (
          <motion.div
            className="absolute right-0 top-full mt-2 p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-lg z-50 min-w-[180px]"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={snapSpring}
          >
            {agentName && (
              <motion.div 
                className="flex justify-between items-center mb-2"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...snapSpring, delay: 0.05 }}
              >
                <span className="text-[var(--text-tertiary)] text-xs">Agent</span>
                <span className="text-[var(--text-primary)] text-sm font-medium">{agentName}</span>
              </motion.div>
            )}
            {modelName && (
              <motion.div 
                className="flex justify-between items-center mb-2"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...snapSpring, delay: 0.1 }}
              >
                <span className="text-[var(--text-tertiary)] text-xs">Model</span>
                <span className="text-[var(--text-secondary)] text-xs font-mono">{modelName}</span>
              </motion.div>
            )}
            {sessionId && (
              <motion.div 
                className="flex justify-between items-center"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...snapSpring, delay: 0.15 }}
              >
                <span className="text-[var(--text-tertiary)] text-xs">Session</span>
                <span className="text-[var(--text-secondary)] text-xs font-mono">{sessionId}</span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
