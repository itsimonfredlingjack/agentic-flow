"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TerminalLayout, OutputItem, RoleId, RoleState, HandoffBlock } from '@/components/terminal';
import { useAgencyClient } from '@/lib/client';
import type { AgentIntent, TodoItem } from '@/types';
import type { AgentStatus } from '@/components/terminal/StatusPill';
import { ROLES } from '@/lib/roles';
import { parseTodos, matchTodoUpdate } from '@/lib/todoParser';

// Generate a run ID
function generateRunId(): string {
  const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RUN-${num}`;
}

// Demo outputs showing the agent flow
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
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoIds, setNewTodoIds] = useState<Set<string>>(new Set());

  // Track processed event IDs to prevent duplicate processing
  const processedEventsRef = useRef<Set<string>>(new Set());
  // Track current role in a ref to avoid re-running effect on role change
  const currentRoleRef = useRef<RoleId>(currentRole);
  currentRoleRef.current = currentRole;

  const { lastEvent, client, connectionStatus } = useAgencyClient(sessionId);

  // Process incoming events
  useEffect(() => {
    if (!lastEvent) return;

    // Generate unique event key to prevent duplicate processing
    const eventKey = `${lastEvent.header.correlationId}-${lastEvent.type}`;
    if (processedEventsRef.current.has(eventKey)) {
      return; // Skip already processed events
    }
    processedEventsRef.current.add(eventKey);

    // Limit Set size to prevent memory leak
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

        // Parse todos from agent response
        if (lastEvent.response?.message?.content) {
          const responseContent = lastEvent.response.message.content;
          const parseResult = parseTodos(responseContent, role);

          if (parseResult.todos.length > 0) {
            setTodos(prev => {
              const newTodos = [...prev];
              const addedIds = new Set<string>();

              for (const parsedTodo of parseResult.todos) {
                // Check if this updates an existing todo
                const existingMatch = matchTodoUpdate(parsedTodo.text, newTodos);

                if (existingMatch) {
                  // Update existing todo status
                  const idx = newTodos.findIndex(t => t.id === existingMatch.todo.id);
                  if (idx !== -1) {
                    newTodos[idx] = {
                      ...newTodos[idx],
                      status: parsedTodo.status,
                      updatedAt: Date.now(),
                    };
                  }
                } else {
                  // Add new todo
                  newTodos.push(parsedTodo);
                  addedIds.add(parsedTodo.id);
                }
              }

              // Track new todos for animation
              if (addedIds.size > 0) {
                setNewTodoIds(addedIds);
                // Clear animation flags after delay
                setTimeout(() => setNewTodoIds(new Set()), 500);
              }

              return newTodos;
            });
          }
        }
        break;

      case 'OLLAMA_ERROR':
      case 'OLLAMA_CHAT_FAILED':
        setAgentStatus('error');
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
  }, [lastEvent]);

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
    // Update role states
    setRoleStates(prev => {
      const updated = { ...prev };
      // Mark current role as completed if it was active
      if (prev[currentRole] === 'active') {
        updated[currentRole] = 'completed';
      }
      // Mark new role as active
      updated[newRole] = 'active';
      return updated;
    });

    setCurrentRole(newRole);
    setShowHandoff(false);

    // Update model based on role
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

    // Add the user's prompt to outputs immediately
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
    setTodos([]);
    setNewTodoIds(new Set());
    // Clear processed events tracker
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

  // Determine next role for handoff
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
        todos={todos}
        newTodoIds={newTodoIds}
      />

      {/* Handoff overlay - shown when a phase is complete */}
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
