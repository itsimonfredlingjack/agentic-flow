"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useMachine } from '@xstate/react';
import { Maximize2, Sparkles } from 'lucide-react';

import {
  TerminalLayout,
  OutputItem,
  RoleId,
  RoleState,
  ExecutionTask,
  PhaseGateModal,
  PhaseTransition,
  PhaseArtifact,
  AIPairPanel,
  CodeCanvas
} from '@/components/terminal';
import { ROLES } from '@/lib/roles';
import { missionControlMachine } from '@/machines/missionControlMachine';
import type { AgentStatus } from '@/components/terminal/StatusPill';

function generateRunId(): string {
  const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RUN-${num}`;
}

const HANDOFF_RUN_KEY = 'llm-creative-demo-run-id';

const loadRunId = () => {
  if (typeof window === 'undefined') return generateRunId();
  const existing = window.localStorage.getItem(HANDOFF_RUN_KEY);
  if (existing) return existing;
  const next = generateRunId();
  window.localStorage.setItem(HANDOFF_RUN_KEY, next);
  return next;
};

const demoOutputs: OutputItem[] = [
  {
    id: 'demo-1',
    type: 'agent',
    command: 'analyze project requirements',
    content: `## Project Analysis Complete

I've analyzed the requirements and identified the following components:

### Architecture Overview
- **Frontend**: React 19 with Next.js 16
- **State**: XState for agent orchestration  
- **Styling**: Tailwind + CSS variables

### Implementation Plan
1. Set up base terminal UI components
2. Implement agent state machine
3. Add role-based response handling
4. Create transition animations

Ready to hand off to the Engineer for implementation.`,
    status: 'success',
    timestamp: '14:32',
    agentRole: 'PLAN',
  },
];

const demoExecutionTasks: ExecutionTask[] = [
  { id: '1', text: 'Set up base terminal UI components', status: 'completed' },
  { id: '2', text: 'Implement agent state machine', status: 'in-progress' },
  { id: '3', text: 'Add role-based response handling', status: 'pending' },
  { id: '4', text: 'Create transition animations', status: 'pending' },
];

const diffArtifacts = (current: PhaseArtifact[], previous: PhaseArtifact[]) => {
  if (previous.length === 0) return [] as string[];

  const prevMap = new Map(previous.map((artifact) => [artifact.id, artifact]));
  const currMap = new Map(current.map((artifact) => [artifact.id, artifact]));
  const changes: string[] = [];

  current.forEach((artifact) => {
    const prev = prevMap.get(artifact.id);
    if (!prev) {
      changes.push(`Added ${artifact.name}`);
      return;
    }
    const prevPreview = prev.preview || '';
    const currPreview = artifact.preview || '';
    if (prevPreview.trim() != currPreview.trim()) {
      changes.push(`Updated ${artifact.name}`);
    }
  });

  previous.forEach((artifact) => {
    if (!currMap.has(artifact.id)) {
      changes.push(`Removed ${artifact.name}`);
    }
  });

  return changes;
};

export function DemoWorkspace() {
  const [sessionId, setSessionId] = useState(() => loadRunId());
  const [outputs, setOutputs] = useState<OutputItem[]>(demoOutputs);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('ready');
  const [currentRole, setCurrentRole] = useState<RoleId>('PLAN');
  const [roleStates, setRoleStates] = useState<Record<RoleId, RoleState>>({
    PLAN: 'completed',
    BUILD: 'active',
    REVIEW: 'available',
    DEPLOY: 'locked',
  });

  // New feature states
  const [phaseGateOpen, setPhaseGateOpen] = useState(false);
  const [lastHandoffArtifacts, setLastHandoffArtifacts] = useState<PhaseArtifact[]>([]);
  const [lastHandoffAt, setLastHandoffAt] = useState<string | null>(null);
  const [aiPairOpen, setAIPairOpen] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);

  const [snapshot, send] = useMachine(missionControlMachine);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadHandoffArtifacts = async () => {
      if (!sessionId) return;
      try {
        const res = await fetch(`/api/run?runId=${sessionId}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        const snapshot = data?.snapshot as { handoffArtifacts?: PhaseArtifact[] } | null;
        const artifacts = Array.isArray(snapshot?.handoffArtifacts) ? snapshot?.handoffArtifacts : [];
        const timestamp = typeof data?.snapshotTimestamp === 'number' ? data.snapshotTimestamp : null;
        if (isMounted && artifacts.length > 0) {
          setLastHandoffArtifacts(artifacts);
        }
        if (isMounted && timestamp) {
          const formatted = new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(new Date(timestamp));
          setLastHandoffAt(formatted);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    };

    loadHandoffArtifacts();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [sessionId]);

  useEffect(() => {
    if (snapshot.matches('idle')) {
      send({ type: 'NEXT' });
    }
  }, [snapshot, send]);

  const currentPhase = useMemo(() => {
    if (snapshot.matches('build')) return 'build';
    if (snapshot.matches('review')) return 'review';
    if (snapshot.matches('deploy')) return 'deploy';
    return 'plan';
  }, [snapshot]);

  const nanoStepsTitle = useMemo(() => {
    switch (currentPhase) {
      case 'build':
        return 'Build';
      case 'review':
        return 'Review';
      case 'deploy':
        return 'Deploy';
      default:
        return 'Plan';
    }
  }, [currentPhase]);

  const nanoSteps = useMemo(() => {
    if (currentPhase === 'build') {
      const steps = [
        { id: 'scaffold', label: 'Scaffolding', status: 'pending' as const },
        { id: 'codegen', label: 'Codegen', status: 'pending' as const },
        { id: 'verify', label: 'Verifying', status: 'pending' as const },
        { id: 'complete', label: 'Complete', status: 'pending' as const },
      ];

      if (snapshot.matches('build.scaffolding')) {
        steps[0].status = 'active';
        return steps;
      }

      if (snapshot.matches('build.codegen')) {
        steps[0].status = 'completed';
        steps[1].status = 'active';
        return steps;
      }

      if (snapshot.matches('build.verifying')) {
        steps[0].status = 'completed';
        steps[1].status = 'completed';
        steps[2].status = 'active';
        return steps;
      }

      if (snapshot.matches('build.failure')) {
        steps[0].status = 'completed';
        steps[1].status = 'completed';
        steps[2].status = 'blocked';
        return steps;
      }

      if (snapshot.matches('build.complete')) {
        steps[0].status = 'completed';
        steps[1].status = 'completed';
        steps[2].status = 'completed';
        steps[3].status = 'active';
        return steps;
      }

      return steps;
    }

    if (currentPhase === 'review') {
      const steps = [
        { id: 'locked', label: 'Gate Locked', status: 'pending' as const },
        { id: 'unlocked', label: 'Gate Open', status: 'pending' as const },
      ];

      if (snapshot.matches('review.locked')) {
        steps[0].status = 'active';
        return steps;
      }

      if (snapshot.matches('review.unlocked')) {
        steps[0].status = 'completed';
        steps[1].status = 'active';
        return steps;
      }

      return steps;
    }

    if (currentPhase === 'deploy') {
      const steps = [
        { id: 'deploying', label: 'Deploying', status: 'active' as const },
        { id: 'live', label: 'Live', status: 'pending' as const },
      ];

      return steps;
    }

    const steps = [
      { id: 'analyze', label: 'Analyzing', status: 'pending' as const },
      { id: 'plan', label: 'Planning', status: 'pending' as const },
      { id: 'validate', label: 'Validating', status: 'pending' as const },
      { id: 'handoff', label: 'Handoff', status: 'pending' as const },
    ];

    if (snapshot.matches('security_lockdown')) {
      steps[0].status = 'blocked';
      return steps;
    }

    if (snapshot.matches('plan.analyzing')) {
      steps[0].status = 'active';
      return steps;
    }

    if (snapshot.matches('plan.drafting')) {
      steps[0].status = 'completed';
      steps[1].status = 'active';
      return steps;
    }

    if (snapshot.matches('plan.reviewing_plan')) {
      steps[0].status = 'completed';
      steps[1].status = 'completed';
      steps[2].status = 'active';
      return steps;
    }

    if (snapshot.matches('plan.approved')) {
      steps[0].status = 'completed';
      steps[1].status = 'completed';
      steps[2].status = 'completed';
      steps[3].status = 'active';
      return steps;
    }

    return steps;
  }, [currentPhase, snapshot]);

  const currentArtifacts: PhaseArtifact[] = [
      {
        id: 'arch-diagram',
        name: 'System architecture diagram',
        preview: `
[User] → [Gateway] → [Planner]
                ↘ [Vector DB]
[Planner] → [Engineer] → [Reviewer] → [Deployer]

Notes:
- Handoff artifacts stored in Task Ledger
- Runtime emits trace events to Inspect panel
`
      },
      {
        id: 'component-spec',
        name: 'Component specification',
        preview: `
TerminalLayout
  - RoleSelector
  - NanoSteps
  - OutputBlock

InspectPanel
  - Artifacts
  - Diff Viewer
`
      },
      {
        id: 'api-defs',
        name: 'API endpoint definitions',
        preview: `
POST /api/run
GET  /api/run
POST /api/command
`
      },
      {
        id: 'db-schema',
        name: 'Database schema design',
        preview: `
Run(id, status, snapshot)
Action(id, runId, timestamp, type, payload)
Artifact(id, runId, name, checksum)
`
      }
  ];

  const phaseTransition: PhaseTransition = {
    from: 'PLAN',
    to: 'BUILD',
    summary: 'Architecture and implementation plan are complete. All artifacts have been generated and validated.',
    artifacts: currentArtifacts,
    changes: diffArtifacts(currentArtifacts, lastHandoffArtifacts),
    lastHandoffAt: lastHandoffAt || undefined
  };

  const handleRoleChange = (newRole: RoleId) => {
    // Show phase gate modal for demonstration
    if (newRole !== currentRole) {
      setPhaseGateOpen(true);
    }
  };

  const handlePhaseApprove = () => {
    setPhaseGateOpen(false);
    setLastHandoffArtifacts(currentArtifacts);
    const formatted = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
    setLastHandoffAt(formatted);
    void fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: sessionId,
        status: 'handoff',
        context: { handoffArtifacts: currentArtifacts }
      })
    });
    // Proceed with role change
    setRoleStates(prev => ({
      ...prev,
      [currentRole]: 'completed',
      BUILD: 'active'
    }));
    setCurrentRole('BUILD');
    send({ type: 'SET_STAGE', stage: 'build' });
  };

  const handlePhaseReject = () => {
    setPhaseGateOpen(false);
    // Stay in current phase for review
  };

  const handleExecuteShell = async (command: string) => {
    console.log('Execute shell:', command);
  };

  const handleExecuteAgent = async (prompt: string) => {
    console.log('Execute agent:', prompt);
  };

  const handleSendCode = (code: string) => {
    console.log('Code sent to AI pair:', code);
  };

  const handleNextStep = () => {
    if (snapshot.matches('security_lockdown')) {
      send({ type: 'RETRY' });
      return;
    }

    if (snapshot.matches('build.failure')) {
      send({ type: 'RETRY' });
      return;
    }

    if (snapshot.matches('review.locked')) {
      send({ type: 'UNLOCK_GATE' });
      return;
    }

    send({ type: 'NEXT' });
  };

  const handleUnlockGate = () => {
    send({ type: 'UNLOCK_GATE' });
  };

  const handleResetFlow = () => {
    send({ type: 'RESET_RUN' });
  };

  const handleLockdown = () => {
    send({ type: 'SECURITY_VIOLATION', policy: 'demo-lockdown' });
  };

  const handleNewSession = () => {
    const nextId = generateRunId();
    setSessionId(nextId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HANDOFF_RUN_KEY, nextId);
    }
    setLastHandoffArtifacts([]);
    setLastHandoffAt(null);
  };

  const handleGoDeploy = () => {
    send({ type: 'SET_STAGE', stage: 'deploy' });
  };

  const handleGoReview = () => {
    send({ type: 'SET_STAGE', stage: 'review' });
  };

  const handleGoBuild = () => {
    send({ type: 'SET_STAGE', stage: 'build' });
  };

  const isReviewLocked = snapshot.matches('review.locked');
  const isLockdown = snapshot.matches('security_lockdown');

  const agents = [
    { id: 'PLAN', name: 'Architect', description: 'System design, planning', model: ROLES.PLAN.model, isActive: currentRole === 'PLAN' },
    { id: 'BUILD', name: 'Engineer', description: 'Implementation, debugging', model: ROLES.BUILD.model, isActive: currentRole === 'BUILD' },
    { id: 'REVIEW', name: 'Critic', description: 'Code review, security', model: ROLES.REVIEW.model, isActive: currentRole === 'REVIEW' },
    { id: 'DEPLOY', name: 'Deployer', description: 'Deploy, infrastructure', model: ROLES.DEPLOY.model, isActive: currentRole === 'DEPLOY' },
  ];

  return (
    <>
      <TerminalLayout
        sessionId={sessionId}
        currentRole={currentRole}
        roleStates={roleStates}
        onRoleChange={handleRoleChange}
        modelName="qwen2.5-coder:3b"
        agentStatus={agentStatus}
        outputs={outputs}
        onExecuteShell={handleExecuteShell}
        onExecuteAgent={handleExecuteAgent}
        onNewSession={handleNewSession}
        onClear={() => setOutputs([])}
        agents={agents}
        executionTasks={demoExecutionTasks}
        nanoSteps={nanoSteps}
        nanoStepsTitle={nanoStepsTitle}
        tokenCounts={{ input: 1247, output: 856, total: 2103 }}
        tokenLimit={8000}
        tokenWarnAt={0.8}
        headerActions={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNextStep}
              className="shortcut-pill shortcut-pill--interactive"
              title="Advance to next step"
            >
              Next
            </button>
            <button
              type="button"
              onClick={handleUnlockGate}
              className="shortcut-pill shortcut-pill--interactive"
              title="Unlock review gate"
              disabled={!isReviewLocked}
            >
              Unlock
            </button>
            <button
              type="button"
              onClick={handleResetFlow}
              className="shortcut-pill shortcut-pill--interactive"
              title="Reset flow"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleLockdown}
              className="shortcut-pill shortcut-pill--interactive"
              title="Trigger security lockdown"
              disabled={isLockdown}
            >
              Lockdown
            </button>
            <button
              type="button"
              onClick={handleGoDeploy}
              className="shortcut-pill shortcut-pill--interactive"
              title="Jump to deploy phase"
            >
              Deploy
            </button>
            <button
              type="button"
              onClick={handleGoReview}
              className="shortcut-pill shortcut-pill--interactive"
              title="Jump to review phase"
            >
              Review
            </button>
            <button
              type="button"
              onClick={handleGoBuild}
              className="shortcut-pill shortcut-pill--interactive"
              title="Jump to build phase"
            >
              Build
            </button>
            <button
              type="button"
              onClick={handleGoDeploy}
              className="shortcut-pill shortcut-pill--interactive"
              title="Jump to deploy phase"
            >
              Deploy
            </button>
            <button
              type="button"
              onClick={handleGoReview}
              className="shortcut-pill shortcut-pill--interactive"
              title="Jump to review phase"
            >
              Review
            </button>
            <button
              type="button"
              onClick={handleGoBuild}
              className="shortcut-pill shortcut-pill--interactive"
              title="Jump to build phase"
            >
              Build
            </button>
            <button
              type="button"
              onClick={() => setAIPairOpen(!aiPairOpen)}
              className="shortcut-pill shortcut-pill--interactive"
              title="AI Pair Programming"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Pair
            </button>
            <button
              type="button"
              onClick={() => setCanvasOpen(!canvasOpen)}
              className="shortcut-pill shortcut-pill--interactive"
              title="Code Canvas"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Canvas
            </button>
          </div>
        )}
      />

      <PhaseGateModal
        transition={phaseTransition}
        onApprove={handlePhaseApprove}
        onReject={handlePhaseReject}
        isOpen={phaseGateOpen}
      />

      <AIPairPanel
        isOpen={aiPairOpen}
        onClose={() => setAIPairOpen(false)}
        onSendCode={handleSendCode}
      />

      <CodeCanvas
        isOpen={canvasOpen}
        onClose={() => setCanvasOpen(false)}
      />
    </>
  );
}
