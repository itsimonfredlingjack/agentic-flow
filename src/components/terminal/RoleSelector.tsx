"use client";

import React, { useEffect, useState } from 'react';

export type RoleId = 'PLAN' | 'BUILD' | 'REVIEW' | 'DEPLOY';
export type RoleState = 'active' | 'available' | 'completed' | 'locked';

interface Role {
  id: RoleId;
  label: string;
  cssClass: string;
}

const ROLES: Role[] = [
  { id: 'PLAN', label: 'Architect', cssClass: 'architect' },
  { id: 'BUILD', label: 'Engineer', cssClass: 'engineer' },
  { id: 'REVIEW', label: 'Critic', cssClass: 'critic' },
  { id: 'DEPLOY', label: 'Deployer', cssClass: 'deployer' },
];

interface RoleSelectorProps {
  currentRole: RoleId;
  roleStates?: Record<RoleId, RoleState>;
  onSelectRole: (roleId: RoleId) => void;
  showHint?: boolean;
}

export function RoleSelector({
  currentRole,
  roleStates,
  onSelectRole,
  showHint = true,
}: RoleSelectorProps) {
  const [enteringRole, setEnteringRole] = useState<RoleId | null>(null);
  const [exitingRole, setExitingRole] = useState<RoleId | null>(null);

  // Default states: current is active, all others are available
  const getState = (roleId: RoleId): RoleState => {
    if (roleStates) return roleStates[roleId];
    return roleId === currentRole ? 'active' : 'available';
  };

  // Handle role change with animation
  const handleRoleClick = (roleId: RoleId) => {
    const state = getState(roleId);
    if (state === 'locked' || roleId === currentRole) return;

    setExitingRole(currentRole);
    setEnteringRole(roleId);
    onSelectRole(roleId);

    // Clear animation states after animation completes
    setTimeout(() => {
      setExitingRole(null);
      setEnteringRole(null);
    }, 300);
  };

  // Get role order index for TAB navigation
  const getRoleIndex = (roleId: RoleId) => ROLES.findIndex(r => r.id === roleId);

  // Find next available role
  const getNextRole = (): RoleId | null => {
    const currentIndex = getRoleIndex(currentRole);
    for (let i = 1; i <= ROLES.length; i++) {
      const nextIndex = (currentIndex + i) % ROLES.length;
      const nextRole = ROLES[nextIndex];
      const state = getState(nextRole.id);
      if (state !== 'locked') return nextRole.id;
    }
    return null;
  };

  // Find previous available role
  const getPrevRole = (): RoleId | null => {
    const currentIndex = getRoleIndex(currentRole);
    for (let i = 1; i <= ROLES.length; i++) {
      const prevIndex = (currentIndex - i + ROLES.length) % ROLES.length;
      const prevRole = ROLES[prevIndex];
      const state = getState(prevRole.id);
      if (state !== 'locked') return prevRole.id;
    }
    return null;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // TAB → Next agent (only if not in input)
      if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const nextRole = e.shiftKey ? getPrevRole() : getNextRole();
        if (nextRole) handleRoleClick(nextRole);
        return;
      }

      // ⌘+1/2/3/4 → Jump to specific agent
      if ((e.metaKey || e.ctrlKey) && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const roleIndex = parseInt(e.key) - 1;
        const targetRole = ROLES[roleIndex];
        if (targetRole && getState(targetRole.id) !== 'locked') {
          handleRoleClick(targetRole.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentRole, roleStates]);

  return (
    <div className="role-tabs-terminal" role="tablist" aria-label="Agent roles">
      {ROLES.map((role, index) => {
        const state = getState(role.id);
        const isEntering = enteringRole === role.id;
        const isExiting = exitingRole === role.id;
        const statusSymbol = state === 'completed' ? '✓' : state === 'active' ? '⚙' : state === 'locked' ? '×' : '';
        const activeMark = state === 'active' ? '*' : '';
        const tabLabel = `[${index + 1}:${role.label}${activeMark}${statusSymbol}]`;

        // Build class names
        const stateClasses = {
          active: 'text-[var(--text-primary)] bg-[var(--bg-elevated)]',
          available: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]',
          completed: 'text-[var(--text-secondary)]',
          locked: 'text-[var(--text-tertiary)] opacity-50 cursor-not-allowed',
        };

        return (
          <button
            key={role.id}
            onClick={() => handleRoleClick(role.id)}
            disabled={state === 'locked'}
            aria-label={`Switch role to ${role.label}`}
            aria-pressed={state === 'active'}
            role="tab"
            aria-selected={state === 'active'}
            data-role={role.id.toLowerCase()}
            className={`
              role-tab role-tab--${role.cssClass}
              ${state === 'active' ? 'role-tab--active' : ''}
              ${state === 'available' ? 'role-tab--available' : ''}
              ${state === 'completed' ? 'role-tab--completed' : ''}
              ${state === 'locked' ? 'role-tab--locked' : ''}
              ${isEntering ? 'role-tab--entering' : ''}
              ${isExiting ? 'role-tab--exiting' : ''}
              role-tab--terminal
              transition-all duration-150
              ${stateClasses[state]}
            `}
            title={`${role.label} (⌘${index + 1})`}
          >
            <span className="role-tab__label">{tabLabel}</span>
          </button>
        );
      })}

      {/* TAB hint */}
      {showHint && (
        <div className="ml-2 flex items-center gap-1 text-[var(--text-tertiary)]">
          <kbd className="px-1 py-0.5 text-[10px] font-mono bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded">
            TAB
          </kbd>
        </div>
      )}
    </div>
  );
}

export { ROLES };
