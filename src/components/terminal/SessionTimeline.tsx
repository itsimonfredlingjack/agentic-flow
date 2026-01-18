"use client";

import React from 'react';
import { Check, Play, Circle, Compass, Wrench, Eye, Rocket } from 'lucide-react';
import type { RoleId, RoleState } from './RoleSelector';

interface SessionTimelineProps {
  currentRole: RoleId;
  roleStates: Record<RoleId, RoleState>;
  onSelectRole?: (roleId: RoleId) => void;
}

const TIMELINE_ROLES: Array<{
  id: RoleId;
  label: string;
  icon: React.ElementType;
  color: string;
}> = [
  { id: 'PLAN', label: 'Architect', icon: Compass, color: 'var(--agent-architect)' },
  { id: 'BUILD', label: 'Engineer', icon: Wrench, color: 'var(--agent-engineer)' },
  { id: 'REVIEW', label: 'Critic', icon: Eye, color: 'var(--agent-critic)' },
  { id: 'DEPLOY', label: 'Deployer', icon: Rocket, color: 'var(--agent-deployer)' },
];

export function SessionTimeline({
  currentRole,
  roleStates,
  onSelectRole,
}: SessionTimelineProps) {
  return (
    <div className="session-timeline">
      <div className="session-timeline__title">Session Flow</div>

      {TIMELINE_ROLES.map((role, index) => {
        const state = roleStates[role.id];
        const isActive = state === 'active';
        const isCompleted = state === 'completed';
        const isUpcoming = state === 'available' || state === 'locked';
        const Icon = role.icon;

        const canClick = state !== 'locked' && onSelectRole;

        return (
          <React.Fragment key={role.id}>
            {/* Connector line (except for first item) */}
            {index > 0 && (
              <div
                className={`session-timeline__connector ${
                  roleStates[TIMELINE_ROLES[index - 1].id] === 'completed'
                    ? 'session-timeline__connector--completed'
                    : ''
                }`}
              />
            )}

            {/* Timeline item */}
            <div
              onClick={() => canClick && onSelectRole(role.id)}
              className={`
                session-timeline__item
                ${isActive ? 'session-timeline__item--active' : ''}
                ${isCompleted ? 'session-timeline__item--completed' : ''}
                ${isUpcoming ? 'session-timeline__item--upcoming' : ''}
                ${canClick ? 'cursor-pointer hover:bg-[var(--bg-elevated)]' : ''}
              `}
            >
              {/* Status icon */}
              <div className="session-timeline__icon">
                {isCompleted ? (
                  <Check
                    className="w-4 h-4 session-timeline__icon--completed"
                    style={{ color: 'var(--accent-emerald)' }}
                  />
                ) : isActive ? (
                  <Play
                    className="w-4 h-4 session-timeline__icon--active"
                    style={{ color: role.color }}
                  />
                ) : (
                  <Circle className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                )}
              </div>

              {/* Role icon */}
              <Icon
                className="w-4 h-4"
                style={{
                  color: isActive ? role.color : isCompleted ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                }}
              />

              {/* Label */}
              <span className="session-timeline__label">{role.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
