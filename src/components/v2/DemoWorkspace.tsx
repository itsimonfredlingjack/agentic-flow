"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sparkles, Maximize2 } from 'lucide-react';

import {
  TerminalLayout,
  type RoleId,
  type RoleState,
  type ExecutionTask,
  PhaseGateModal,
  type PhaseTransition,
  AIPairPanel,
  CodeCanvas,
} from '@/components/terminal';
import type { AgentStatus } from '@/components/terminal/StatusPill';
import type { OllamaChatMessage } from '@/types';
import { parsePlanTasks } from '@/lib/planParser';
import { useAgencyClient } from '@/lib/client';
import { ROLES } from '@/lib/roles';
import { createRun, resumeRun, listRuns, saveSnapshot } from '@/lib/runApi';

import { coerceV2Snapshot } from './v2Snapshot';
import { planTasksToExecutionTasks } from './planToExecutionTasks';
import { applyRuntimeEvent, type OutputIndex, type RoleMemory } from './applyRuntimeEvent';

const ROLE_ORDER: RoleId[] = ['PLAN', 'BUILD', 'REVIEW', 'DEPLOY'];

function createEmptyRoleMemory(tasks: ExecutionTask[] = []): Record<RoleId, RoleMemory> {
  return {
    PLAN: { outputs: [], executionTasks: tasks },
    BUILD: { outputs: [], executionTasks: tasks },
    REVIEW: { outputs: [], executionTasks: tasks },
    DEPLOY: { outputs: [], executionTasks: tasks },
  };
}

function createDefaultModels(): Record<RoleId, string> {
  return {
    PLAN: ROLES.PLAN.model,
    BUILD: ROLES.BUILD.model,
    REVIEW: ROLES.REVIEW.model,
    DEPLOY: ROLES.DEPLOY.model,
  };
}

function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSessionTimestamp(createdAt: number) {
  const d = new Date(createdAt);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const date = d.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n... (truncated)`;
}

function getLatestAgentOutput(roleMemory: Record<RoleId, RoleMemory>, role: RoleId) {
  const outputs = roleMemory[role]?.outputs ?? [];
  for (let i = outputs.length - 1; i >= 0; i -= 1) {
    const output = outputs[i];
    if (output.type === 'agent' && output.content && output.status === 'success') {
      return output;
    }
  }
  return null;
}

function collectRecentErrors(roleMemory: Record<RoleId, RoleMemory>, maxItems: number) {
  const errors: string[] = [];
  for (const role of ROLE_ORDER) {
    const outputs = roleMemory[role]?.outputs ?? [];
    for (let i = outputs.length - 1; i >= 0; i -= 1) {
      const output = outputs[i];
      if (output.status === 'error' && output.content) {
        errors.push(`[${role}] ${truncateText(output.content, 400)}`);
        if (errors.length >= maxItems) {
          return errors;
        }
      }
    }
  }
  return errors;
}

function buildRoleSystemPrompt(role: RoleId, roleMemory: Record<RoleId, RoleMemory>) {
  const projectInfo = 'Project: Agentic Flow (Next.js 16 / React 19)';
  const planOutput = getLatestAgentOutput(roleMemory, 'PLAN')?.content ?? '';
  const buildOutput = getLatestAgentOutput(roleMemory, 'BUILD')?.content ?? '';
  const reviewOutput = getLatestAgentOutput(roleMemory, 'REVIEW')?.content ?? '';
  const errors = collectRecentErrors(roleMemory, 3);

  let prompt = ROLES[role].systemPrompt;
  prompt = prompt.replaceAll('{{projectInfo}}', projectInfo);
  prompt = prompt.replaceAll('{{planContext}}', planOutput ? truncateText(planOutput, 4000) : '');
  prompt = prompt.replaceAll('{{errorContext}}', errors.length ? errors.join('\n') : '');
  prompt = prompt.replaceAll('{{buildContext}}', buildOutput ? truncateText(buildOutput, 4000) : '');
  prompt = prompt.replaceAll('{{reviewContext}}', reviewOutput ? truncateText(reviewOutput, 4000) : '');
  return prompt;
}

function buildChatMessages(
  role: RoleId,
  roleMemory: Record<RoleId, RoleMemory>,
  prompt: string,
  maxHistory = 4
): OllamaChatMessage[] {
  const system: OllamaChatMessage = {
    role: 'system',
    content: buildRoleSystemPrompt(role, roleMemory),
  };

  const historyOutputs = (roleMemory[role]?.outputs ?? [])
    .filter((output) => output.type === 'agent' && output.content && output.status === 'success')
    .slice(-maxHistory);

  const history: OllamaChatMessage[] = [];
  historyOutputs.forEach((output) => {
    history.push({ role: 'user', content: output.command });
    history.push({ role: 'assistant', content: output.content });
  });

  return [system, ...history, { role: 'user', content: prompt }];
}

export function DemoWorkspace() {
  const [runId, setRunId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<RoleId>('PLAN');
  const [roleMemory, setRoleMemory] = useState<Record<RoleId, RoleMemory>>(() => createEmptyRoleMemory());
  const [selectedModels, setSelectedModels] = useState<Record<RoleId, string>>(() => createDefaultModels());
  const [pendingRole, setPendingRole] = useState<RoleId | null>(null);

  const [phaseGateOpen, setPhaseGateOpen] = useState(false);
  const [aiPairOpen, setAIPairOpen] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);

  const [sessions, setSessions] = useState<Array<{
    id: string;
    timestamp: string;
    agent: string;
    blockCount: number;
    status: 'active' | 'success' | 'warning';
  }>>([]);

  const outputIndexRef = useRef<OutputIndex>(new Map());
  const autosaveRef = useRef<number | null>(null);

  const { lastEvent, client, connectionStatus } = useAgencyClient(runId);

  const refreshSessions = useCallback(async (activeId: string | null) => {
    try {
      const result = await listRuns(20);
      const mapped = result.sessions.map((session) => {
        const status: 'active' | 'success' | 'warning' = session.id === activeId
          ? 'active'
          : session.eventCount > 0
            ? 'success'
            : 'warning';

        return {
          id: session.id,
          timestamp: formatSessionTimestamp(session.createdAt),
          agent: 'System',
          blockCount: session.eventCount,
          status,
        };
      });
      setSessions(mapped);
    } catch (err) {
      console.error('[v2] Failed to list runs:', err);
    }
  }, []);

  const hydrateFromSnapshot = useCallback((snapshot: unknown) => {
    const parsed = coerceV2Snapshot(snapshot);
    if (!parsed) return false;

    setCurrentRole(parsed.currentRole);
    setRoleMemory(parsed.roleMemory);
    setSelectedModels({ ...createDefaultModels(), ...(parsed.selectedModels ?? {}) });
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const boot = await createRun();
      if (cancelled) return;

      setRunId(boot.id);

      const didHydrate = boot.snapshot ? hydrateFromSnapshot(boot.snapshot) : false;
      if (!didHydrate) {
        setCurrentRole('PLAN');
        setRoleMemory(createEmptyRoleMemory());
        setSelectedModels(createDefaultModels());
        outputIndexRef.current = new Map();
      }

      await refreshSessions(boot.id);
    })().catch((err) => {
      console.error('[v2] Failed to boot run:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [hydrateFromSnapshot, refreshSessions]);

  useEffect(() => {
    if (!runId) return;
    void refreshSessions(runId);
  }, [runId, refreshSessions]);

  const roleStates = useMemo<Record<RoleId, RoleState>>(() => {
    return ROLE_ORDER.reduce((acc, role) => {
      if (role === currentRole) {
        acc[role] = 'active';
      } else if ((roleMemory[role]?.outputs?.length ?? 0) > 0) {
        acc[role] = 'completed';
      } else {
        acc[role] = 'available';
      }
      return acc;
    }, {} as Record<RoleId, RoleState>);
  }, [currentRole, roleMemory]);

  const activeMemory = roleMemory[currentRole] ?? createEmptyRoleMemory()[currentRole];
  const outputs = activeMemory.outputs ?? [];
  const executionTasks = activeMemory.executionTasks ?? [];
  const tokenCounts = activeMemory.tokenCounts;

  const agentStatus: AgentStatus = useMemo(() => {
    if (!runId) return 'error';

    if (connectionStatus === 'connecting') return 'running';
    if (connectionStatus === 'error' || connectionStatus === 'closed') return 'error';

    const hasRunningAgent = outputs.some((o) => o.status === 'running' && o.type === 'agent');
    if (hasRunningAgent) return 'thinking';

    const hasRunning = outputs.some((o) => o.status === 'running');
    if (hasRunning) return 'running';

    return 'ready';
  }, [connectionStatus, outputs, runId]);

  const phaseTransition: PhaseTransition = useMemo(() => {
    const toRole = pendingRole ?? currentRole;
    const fromRole = currentRole;

    const fromOutputs = roleMemory[fromRole]?.outputs ?? [];
    const lastStamp = fromOutputs[fromOutputs.length - 1]?.timestamp;
    const snippetCount = fromOutputs.reduce((acc, output) => acc + (output.content.includes('```') ? 1 : 0), 0);
    const artifacts: string[] = [
      `${fromOutputs.length} blocks`,
      `${snippetCount} snippets`,
      lastStamp ? `Last update: ${lastStamp}` : 'No updates yet',
    ];

    const summary = pendingRole
      ? `Preparing to hand off from ${fromRole} to ${toRole}. Review the transfer package before switching.`
      : `Currently focused on ${fromRole}.`;

    return {
      from: fromRole,
      to: toRole,
      summary,
      artifacts,
    };
  }, [currentRole, pendingRole, roleMemory]);

  const updateRoleMemory = useCallback((role: RoleId, updater: (memory: RoleMemory) => RoleMemory) => {
    setRoleMemory((prev) => {
      const current = prev[role] ?? createEmptyRoleMemory()[role];
      return {
        ...prev,
        [role]: updater(current),
      };
    });
  }, []);

  const handleRoleChange = (newRole: RoleId) => {
    if (newRole === currentRole) return;
    setPendingRole(newRole);
    setPhaseGateOpen(true);
  };

  const handlePhaseApprove = () => {
    if (!pendingRole) return;
    setPhaseGateOpen(false);
    setCurrentRole(pendingRole);
    setPendingRole(null);
  };

  const handlePhaseReject = () => {
    setPhaseGateOpen(false);
    setPendingRole(null);
  };

  const handleNewSession = useCallback(async () => {
    const boot = await createRun();
    setRunId(boot.id);
    setCurrentRole('PLAN');
    setRoleMemory(createEmptyRoleMemory());
    setSelectedModels(createDefaultModels());
    outputIndexRef.current = new Map();
    setPendingRole(null);
    setPhaseGateOpen(false);
    await refreshSessions(boot.id);
  }, [refreshSessions]);

  const handleSelectSession = useCallback(async (id: string) => {
    const boot = await resumeRun(id);
    setRunId(boot.id);

    const didHydrate = boot.snapshot ? hydrateFromSnapshot(boot.snapshot) : false;
    if (!didHydrate) {
      setCurrentRole('PLAN');
      setRoleMemory(createEmptyRoleMemory());
      setSelectedModels(createDefaultModels());
      outputIndexRef.current = new Map();
    }

    await refreshSessions(boot.id);
  }, [hydrateFromSnapshot, refreshSessions]);

  const handleExecuteShell = useCallback(async (command: string) => {
    const role = currentRole;
    const correlationId = uuidv4();
    const id = `shell-${correlationId}`;
    const timestamp = formatClock(Date.now());

    updateRoleMemory(role, (memory) => ({
      ...memory,
      outputs: [
        ...memory.outputs,
        {
          id,
          type: 'shell',
          command,
          content: '',
          status: 'running',
          timestamp,
          agentRole: role,
        },
      ],
    }));

    outputIndexRef.current.set(correlationId, { role, outputId: id });

    try {
      await client.send({
        type: 'INTENT_EXEC_CMD',
        command,
        header: { correlationId },
      });
    } catch (err) {
      updateRoleMemory(role, (memory) => ({
        ...memory,
        outputs: memory.outputs.map((output) =>
          output.id === id
            ? {
                ...output,
                status: 'error',
                content: err instanceof Error ? err.message : 'Failed to send command',
              }
            : output
        ),
      }));
    }
  }, [client, currentRole, updateRoleMemory]);

  const handleExecuteAgent = useCallback(async (prompt: string) => {
    const role = currentRole;
    const correlationId = uuidv4();
    const id = `agent-${correlationId}`;
    const timestamp = formatClock(Date.now());

    updateRoleMemory(role, (memory) => ({
      ...memory,
      outputs: [
        ...memory.outputs,
        {
          id,
          type: 'agent',
          command: prompt,
          content: '',
          status: 'running',
          timestamp,
          agentRole: role,
        },
      ],
    }));

    outputIndexRef.current.set(correlationId, { role, outputId: id });

    try {
      const messages = buildChatMessages(role, roleMemory, prompt);

      await client.send({
        type: 'INTENT_OLLAMA_CHAT',
        model: selectedModels[role],
        messages,
        header: { correlationId },
      });
    } catch (err) {
      updateRoleMemory(role, (memory) => ({
        ...memory,
        outputs: memory.outputs.map((output) =>
          output.id === id
            ? {
                ...output,
                status: 'error',
                content: err instanceof Error ? err.message : 'Failed to send prompt',
              }
            : output
        ),
      }));
    }
  }, [client, currentRole, roleMemory, selectedModels, updateRoleMemory]);

  const handleGrantPermission = useCallback(async (requestId: string) => {
    try {
      await client.send({ type: 'INTENT_GRANT_PERMISSION', requestId });
    } catch (err) {
      console.error('[v2] Failed to grant permission:', err);
    }
  }, [client]);

  const handleDenyPermission = useCallback(async (requestId: string) => {
    try {
      await client.send({ type: 'INTENT_DENY_PERMISSION', requestId });
    } catch (err) {
      console.error('[v2] Failed to deny permission:', err);
    }
  }, [client]);

  useEffect(() => {
    if (!lastEvent) return;

    setRoleMemory((prev) => {
      const hasAnyOutput = Object.values(prev).some((memory) => (memory.outputs ?? []).length > 0);
      if (lastEvent.type === 'SYS_READY' && hasAnyOutput) {
        return prev;
      }

      const mapped = outputIndexRef.current.get(lastEvent.header.correlationId);
      const mappedRole = mapped?.role ?? currentRole;

      const applied = applyRuntimeEvent({
        roleMemory: prev,
        outputIndex: outputIndexRef.current,
        currentRole,
        event: lastEvent,
      });
      outputIndexRef.current = applied.outputIndex;

      let next = applied.roleMemory;

      if (lastEvent.type === 'OLLAMA_CHAT_COMPLETED') {
        const inputDelta = lastEvent.response.prompt_eval_count ?? 0;
        const outputDelta = lastEvent.response.eval_count ?? 0;
        const existing = next[mappedRole].tokenCounts ?? { input: 0, output: 0, total: 0 };

        next = {
          ...next,
          [mappedRole]: {
            ...next[mappedRole],
            tokenCounts: {
              input: existing.input + inputDelta,
              output: existing.output + outputDelta,
              total: existing.total + inputDelta + outputDelta,
            },
          },
        };

        if (mappedRole === 'PLAN') {
          const parsedTasks = parsePlanTasks(lastEvent.response.message.content);
          const tasks = planTasksToExecutionTasks(parsedTasks);

          if (tasks.length) {
            next = {
              PLAN: { ...next.PLAN, executionTasks: tasks },
              BUILD: { ...next.BUILD, executionTasks: tasks },
              REVIEW: { ...next.REVIEW, executionTasks: tasks },
              DEPLOY: { ...next.DEPLOY, executionTasks: tasks },
            };
          }
        }
      }

      return next;
    });
  }, [currentRole, lastEvent]);

  useEffect(() => {
    if (!runId) return;

    if (autosaveRef.current) {
      window.clearTimeout(autosaveRef.current);
    }

    autosaveRef.current = window.setTimeout(() => {
      const snapshot = {
        version: 1,
        runId,
        currentRole,
        roleMemory,
        selectedModels,
      };

      saveSnapshot(runId, snapshot).catch((err) => {
        console.error('[v2] Failed to save snapshot:', err);
      });
    }, 800);

    return () => {
      if (autosaveRef.current) {
        window.clearTimeout(autosaveRef.current);
        autosaveRef.current = null;
      }
    };
  }, [currentRole, roleMemory, runId, selectedModels]);

  const agents = useMemo(() => ([
    { id: 'PLAN', name: 'Architect', description: 'System design, planning', model: selectedModels.PLAN, isActive: currentRole === 'PLAN' },
    { id: 'BUILD', name: 'Engineer', description: 'Implementation, debugging', model: selectedModels.BUILD, isActive: currentRole === 'BUILD' },
    { id: 'REVIEW', name: 'Critic', description: 'Code review, security', model: selectedModels.REVIEW, isActive: currentRole === 'REVIEW' },
    { id: 'DEPLOY', name: 'Deployer', description: 'Deploy, infrastructure', model: selectedModels.DEPLOY, isActive: currentRole === 'DEPLOY' },
  ]), [currentRole, selectedModels]);

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModels((prev) => ({
      ...prev,
      [currentRole]: modelId,
    }));
  }, [currentRole]);

  return (
    <>
      <TerminalLayout
        sessionId={runId ?? '—'}
        currentRole={currentRole}
        roleStates={roleStates}
        onRoleChange={handleRoleChange}
        modelName={selectedModels[currentRole]}
        onModelChange={handleModelChange}
        agentStatus={agentStatus}
        outputs={outputs}
        onExecuteShell={handleExecuteShell}
        onExecuteAgent={handleExecuteAgent}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        onClear={() => updateRoleMemory(currentRole, (memory) => ({ ...memory, outputs: [] }))}
        agents={agents}
        executionTasks={executionTasks}
        tokenCounts={tokenCounts}
        sessions={sessions}
        onGrantPermission={handleGrantPermission}
        onDenyPermission={handleDenyPermission}
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
        onSendCode={(code) => console.log('Code sent to AI pair:', code)}
      />

      <CodeCanvas
        isOpen={canvasOpen}
        onClose={() => setCanvasOpen(false)}
      />
    </>
  );
}
