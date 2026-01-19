"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TerminalLayout, OutputItem, RoleId, RoleState, HandoffBlock } from '@/components/terminal';
import { useAgencyClient } from '@/lib/client';
import type { AgentIntent, PlanTask, SessionMetrics, PhaseMetrics } from '@/types';
import type { AgentStatus } from '@/components/terminal/StatusPill';
import { ROLES } from '@/lib/roles';
import { parsePlanTasks, updateTaskStatus, findTaskByText } from '@/lib/planParser';

// Generate a run ID
function generateRunId(): string {
  const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RUN-${num}`;
}

// Create initial metrics
function createInitialMetrics(): SessionMetrics {
  const now = Date.now();
  return {
    totalTokens: 0,
    sessionStartTime: now,
    phases: {
      PLAN: { phase: 'PLAN', startTime: null, endTime: null, elapsedMs: 0, requests: 0, successes: 0, failures: 0 },
      BUILD: { phase: 'BUILD', startTime: null, endTime: null, elapsedMs: 0, requests: 0, successes: 0, failures: 0 },
      REVIEW: { phase: 'REVIEW', startTime: null, endTime: null, elapsedMs: 0, requests: 0, successes: 0, failures: 0 },
      DEPLOY: { phase: 'DEPLOY', startTime: null, endTime: null, elapsedMs: 0, requests: 0, successes: 0, failures: 0 },
    },
  };
}

// Demo outputs showing the agent flow
const demoOutputs: OutputItem[] = [
  {
    id: 'demo-1',
    type: 'agent',
    command: 'analyze project requirements',
    content: `## Project Analysis Complete

I've analyzed the requirements and identified the following components:

### Execution Plan
- [ ] Set up base terminal UI components
- [ ] Implement agent state machine
- [ ] Add role-based response handling
- [ ] Create transition animations

Ready to hand off to the Engineer for implementation.`,
    status: 'success',
    timestamp: '14:32',
    agentRole: 'PLAN',
  },
];

// Parse tasks from demo output for initial state
const initialTasks = parsePlanTasks(demoOutputs[0].content);

export default function TerminalPage() {
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
  const [showHandoff, setShowHandoff] = useState(true);
  const [currentModel, setCurrentModel] = useState('qwen2.5-coder:3b');
  const [planTasks, setPlanTasks] = useState<PlanTask[]>(initialTasks);
  const [newTaskIds, setNewTaskIds] = useState<Set<string>>(new Set());
  const [metrics, setMetrics] = useState<SessionMetrics>(() => {
    // Initialize with demo data
    const initial = createInitialMetrics();
    initial.totalTokens = 342; // Demo tokens
    initial.phases.PLAN = {
      ...initial.phases.PLAN,
      startTime: Date.now() - 15000,
      endTime: Date.now() - 3000,
      elapsedMs: 12000,
      requests: 1,
      successes: 1,
      failures: 0,
    };
    return initial;
  });

  // Track processed event IDs to prevent duplicate processing
  const processedEventsRef = useRef<Set<string>>(new Set());
  // Track current role in a ref to avoid re-running effect on role change
  const currentRoleRef = useRef<RoleId>(currentRole);
  currentRoleRef.current = currentRole;
  // Track phase start times for elapsed calculation
  const phaseStartRef = useRef<number | null>(null);

  const { lastEvent, client, connectionStatus } = useAgencyClient(sessionId);

  // Update phase timing when role changes
  useEffect(() => {
    const now = Date.now();
    
    setMetrics(prev => {
      const updated = { ...prev, phases: { ...prev.phases } };
      
      // End timing for previous phases that are active
      Object.keys(updated.phases).forEach(key => {
        const phase = updated.phases[key];
        if (phase.startTime && !phase.endTime && key !== currentRole) {
          updated.phases[key] = {
            ...phase,
            endTime: now,
            elapsedMs: now - phase.startTime,
          };
        }
      });
      
      // Start timing for current phase if not already started
      if (!updated.phases[currentRole].startTime) {
        updated.phases[currentRole] = {
          ...updated.phases[currentRole],
          startTime: now,
        };
      }
      
      return updated;
    });
    
    phaseStartRef.current = Date.now();
  }, [currentRole]);

  // Update elapsed time for active phase
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => {
        const phase = prev.phases[currentRole];
        if (phase.startTime && !phase.endTime) {
          return {
            ...prev,
            phases: {
              ...prev.phases,
              [currentRole]: {
                ...phase,
                elapsedMs: Date.now() - phase.startTime,
              },
            },
          };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentRole]);

  // Extract and update task status from response text
  const processTaskUpdates = useCallback((responseText: string) => {
    const statusPatterns = [
      { regex: /- \[>\]\s*(?:Currently working on:|Active:)?\s*(.+)/gi, status: 'active' as const },
      { regex: /- \[x\]\s*(?:Completed:|Done:)?\s*(.+)/gi, status: 'complete' as const },
      { regex: /- \[!\]\s*(?:Failed:)?\s*(.+)/gi, status: 'failed' as const },
      { regex: /- \[~\]\s*(?:Skipped:)?\s*(.+)/gi, status: 'skipped' as const },
    ];

    setPlanTasks(currentTasks => {
      let updatedTasks = [...currentTasks];
      
      for (const { regex, status } of statusPatterns) {
        let match;
        while ((match = regex.exec(responseText)) !== null) {
          const taskText = match[1].trim();
          const foundTask = findTaskByText(updatedTasks, taskText);
          if (foundTask) {
            updatedTasks = updateTaskStatus(updatedTasks, foundTask.id, status);
          }
        }
      }

      return updatedTasks;
    });
  }, []);

  // Process incoming events
  useEffect(() => {
    if (!lastEvent) return;

    const eventKey = `${lastEvent.header.correlationId}-${lastEvent.type}`;
    if (processedEventsRef.current.has(eventKey)) {
      return;
    }
    processedEventsRef.current.add(eventKey);

    if (processedEventsRef.current.size > 1000) {
      const entries = Array.from(processedEventsRef.current);
      processedEventsRef.current = new Set(entries.slice(-500));
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const role = currentRoleRef.current;

    switch (lastEvent.type) {
      case 'PROCESS_STARTED':
        setAgentStatus('running');
        setOutputs(prev => [...prev, {
          id: lastEvent.header.correlationId,
          type: 'shell',
          command: lastEvent.command,
          content: '',
          status: 'running',
          timestamp,
        }]);
        break;

      case 'STDOUT_CHUNK':
        setOutputs(prev => {
          const last = prev[prev.length - 1];
          if (last && last.status === 'running' && last.type === 'shell') {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + lastEvent.content }
            ];
          }
          return prev;
        });
        break;

      case 'STDERR_CHUNK':
        setOutputs(prev => {
          const last = prev[prev.length - 1];
          if (last && last.status === 'running') {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + lastEvent.content, status: 'error' }
            ];
          }
          return prev;
        });
        break;

      case 'PROCESS_EXITED':
        setAgentStatus('ready');
        setOutputs(prev => {
          const last = prev[prev.length - 1];
          if (last && last.type === 'shell') {
            const status = lastEvent.code === 0 ? 'success' : 'error';
            return [
              ...prev.slice(0, -1),
              { ...last, status, duration: Date.now() }
            ];
          }
          return prev;
        });
        break;

      case 'OLLAMA_CHAT_STARTED':
        setAgentStatus('thinking');
        // Increment request count for current phase
        setMetrics(prev => ({
          ...prev,
          phases: {
            ...prev.phases,
            [role]: {
              ...prev.phases[role],
              requests: prev.phases[role].requests + 1,
            },
          },
        }));
        setOutputs(prev => [...prev, {
          id: lastEvent.header.correlationId,
          type: 'agent',
          command: 'thinking...',
          content: '',
          status: 'running',
          timestamp,
          agentRole: role,
        }]);
        break;

      case 'OLLAMA_CHAT_COMPLETED':
        setAgentStatus('ready');
        
        // Update metrics: success count and tokens
        const tokenCount = lastEvent.response?.eval_count || 0;
        setMetrics(prev => ({
          ...prev,
          totalTokens: prev.totalTokens + tokenCount,
          phases: {
            ...prev.phases,
            [role]: {
              ...prev.phases[role],
              successes: prev.phases[role].successes + 1,
            },
          },
        }));

        setOutputs(prev => {
          const last = prev[prev.length - 1];
          if (last && last.type === 'agent' && last.status === 'running') {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                command: 'response',
                content: lastEvent.response.message.content,
                status: 'success',
              }
            ];
          }
          return [...prev, {
            id: `${lastEvent.header.correlationId}-completed`,
            type: 'agent',
            command: 'response',
            content: lastEvent.response.message.content,
            status: 'success',
            timestamp,
            agentRole: role,
          }];
        });

        // Process plan tasks from agent response
        if (lastEvent.response?.message?.content) {
          const responseContent = lastEvent.response.message.content;
          
          if (role === 'PLAN') {
            const newTasks = parsePlanTasks(responseContent);
            if (newTasks.length > 0) {
              setPlanTasks(newTasks);
              const ids = new Set(newTasks.map(t => t.id));
              newTasks.forEach(t => t.children?.forEach(c => ids.add(c.id)));
              setNewTaskIds(ids);
              setTimeout(() => setNewTaskIds(new Set()), 500);
            }
          } else {
            processTaskUpdates(responseContent);
          }
        }
        break;

      case 'OLLAMA_ERROR':
      case 'OLLAMA_CHAT_FAILED':
        setAgentStatus('error');
        // Update metrics: failure count
        setMetrics(prev => ({
          ...prev,
          phases: {
            ...prev.phases,
            [role]: {
              ...prev.phases[role],
              failures: prev.phases[role].failures + 1,
            },
          },
        }));
        setOutputs(prev => {
          const last = prev[prev.length - 1];
          if (last && last.type === 'agent' && last.status === 'running') {
            return [
              ...prev.slice(0, -1),
              { ...last, content: lastEvent.error, status: 'error' }
            ];
          }
          return prev;
        });
        break;

      case 'WORKFLOW_ERROR':
        setAgentStatus('error');
        setOutputs(prev => [...prev, {
          id: `${lastEvent.header.correlationId}-error`,
          type: 'shell',
          command: 'error',
          content: lastEvent.error,
          status: 'error',
          timestamp,
        }]);
        break;
    }
  }, [lastEvent, processTaskUpdates]);

  // Update status based on connection
  useEffect(() => {
    if (connectionStatus === 'error') {
      setAgentStatus('error');
    } else if (connectionStatus === 'open' && agentStatus === 'error') {
      setAgentStatus('ready');
    }
  }, [connectionStatus, agentStatus]);

  // Handle role change
  const handleRoleChange = useCallback((newRole: RoleId) => {
    setRoleStates(prev => {
      const updated = { ...prev };
      if (prev[currentRole] === 'active') {
        updated[currentRole] = 'completed';
      }
      updated[newRole] = 'active';
      return updated;
    });

    setCurrentRole(newRole);
    setShowHandoff(false);

    const roleModel = ROLES[newRole]?.model || 'qwen2.5-coder:3b';
    setCurrentModel(roleModel);
  }, [currentRole]);

  const handleExecuteShell = useCallback(async (command: string) => {
    if (!client) return;

    const intent: Omit<Extract<AgentIntent, { type: 'INTENT_EXEC_CMD' }>, 'header'> = {
      type: 'INTENT_EXEC_CMD',
      command,
    };

    try {
      await client.send(intent);
    } catch (err) {
      console.error('Failed to execute shell command:', err);
    }
  }, [client]);

  const handleExecuteAgent = useCallback(async (prompt: string) => {
    if (!client) return;

    const roleSpec = ROLES[currentRole];

    const intent: Omit<Extract<AgentIntent, { type: 'INTENT_OLLAMA_CHAT' }>, 'header'> = {
      type: 'INTENT_OLLAMA_CHAT',
      messages: [
        { role: 'system', content: roleSpec.systemPrompt },
        { role: 'user', content: prompt }
      ],
      model: roleSpec.model,
      options: { temperature: 0.2 },
    };

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setOutputs(prev => [...prev, {
      id: `user-${Date.now()}`,
      type: 'agent',
      command: prompt,
      content: '',
      status: 'idle',
      timestamp,
      agentRole: currentRole,
    }]);

    try {
      await client.send(intent);
    } catch (err) {
      console.error('Failed to send to agent:', err);
    }
  }, [client, currentRole]);

  const handleModelChange = useCallback((modelId: string) => {
    setCurrentModel(modelId);
  }, []);

  const handleNewSession = useCallback(() => {
    setSessionId(generateRunId());
    setOutputs([]);
    setAgentStatus('ready');
    setCurrentRole('PLAN');
    setRoleStates({
      PLAN: 'active',
      BUILD: 'available',
      REVIEW: 'available',
      DEPLOY: 'locked',
    });
    setShowHandoff(false);
    setPlanTasks([]);
    setNewTaskIds(new Set());
    setMetrics(createInitialMetrics());
    processedEventsRef.current.clear();
  }, []);

  const handleClear = useCallback(() => {
    setOutputs([]);
  }, []);

  const agents = [
    { id: 'PLAN', name: 'Architect', description: 'System design, planning', model: ROLES.PLAN.model, isActive: currentRole === 'PLAN' },
    { id: 'BUILD', name: 'Engineer', description: 'Implementation, debugging', model: ROLES.BUILD.model, isActive: currentRole === 'BUILD' },
    { id: 'REVIEW', name: 'Critic', description: 'Code review, security', model: ROLES.REVIEW.model, isActive: currentRole === 'REVIEW' },
    { id: 'DEPLOY', name: 'Deployer', description: 'Deploy, infrastructure', model: ROLES.DEPLOY.model, isActive: currentRole === 'DEPLOY' },
  ];

  const getNextRole = (): RoleId | null => {
    const order: RoleId[] = ['PLAN', 'BUILD', 'REVIEW', 'DEPLOY'];
    const currentIndex = order.indexOf(currentRole);
    if (currentIndex < order.length - 1) {
      return order[currentIndex + 1];
    }
    return null;
  };

  const nextRole = getNextRole();

  return (
    <>
      <TerminalLayout
        sessionId={sessionId}
        currentRole={currentRole}
        roleStates={roleStates}
        onRoleChange={handleRoleChange}
        modelName={currentModel}
        agentStatus={agentStatus}
        outputs={outputs}
        onExecuteShell={handleExecuteShell}
        onExecuteAgent={handleExecuteAgent}
        onModelChange={handleModelChange}
        onNewSession={handleNewSession}
        onClear={handleClear}
        agents={agents}
        planTasks={planTasks}
        newTaskIds={newTaskIds}
        metrics={metrics}
      />

      {showHandoff && nextRole && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <HandoffBlock
            completedPhase="Plan Complete"
            completedRole={currentRole}
            nextRole={nextRole}
            message="Architecture and implementation plan are ready. The Engineer will now implement the components."
            onSwitch={() => handleRoleChange(nextRole)}
          />
        </div>
      )}
    </>
  );
}
