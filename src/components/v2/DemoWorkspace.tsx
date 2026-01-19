"use client";

import React, { useState } from 'react';
import {
  TerminalLayout,
  OutputItem,
  RoleId,
  RoleState,
  ExecutionTask,
  PhaseGateModal,
  PhaseTransition,
  AIPairPanel,
  CodeCanvas
} from '@/components/terminal';
import type { AgentStatus } from '@/components/terminal/StatusPill';
import { ROLES } from '@/lib/roles';
import { Sparkles, Maximize2 } from 'lucide-react';

function generateRunId(): string {
  const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RUN-${num}`;
}

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
  { id: "1", text: "Set up base terminal UI components", status: "completed" },
  { id: "2", text: "Implement agent state machine", status: "in-progress" },
  { id: "3", text: "Add role-based response handling", status: "pending" },
  { id: "4", text: "Create transition animations", status: "pending" },
];

export function DemoWorkspace() {
  const [sessionId, setSessionId] = useState(() => generateRunId());
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
  const [aiPairOpen, setAIPairOpen] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);

  const phaseTransition: PhaseTransition = {
    from: 'PLAN',
    to: 'BUILD',
    summary: 'Architecture and implementation plan are complete. All artifacts have been generated and validated.',
    artifacts: [
      'System architecture diagram',
      'Component specification',
      'API endpoint definitions',
      'Database schema design'
    ]
  };

  const handleRoleChange = (newRole: RoleId) => {
    // Show phase gate modal for demonstration
    if (newRole !== currentRole) {
      setPhaseGateOpen(true);
    }
  };

  const handlePhaseApprove = () => {
    setPhaseGateOpen(false);
    // Proceed with role change
    setRoleStates(prev => ({
      ...prev,
      [currentRole]: 'completed',
      BUILD: 'active'
    }));
    setCurrentRole('BUILD');
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
        onNewSession={() => setSessionId(generateRunId())}
        onClear={() => setOutputs([])}
        agents={agents}
        executionTasks={demoExecutionTasks}
        tokenCounts={{ input: 1247, output: 856, total: 2103 }}
        headerActions={(
          <div className="flex items-center gap-2">
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
