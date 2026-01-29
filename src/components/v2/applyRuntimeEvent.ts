import type { ExecutionTask } from '@/components/terminal/ExecutionPlan';
import type { RoleId } from '@/components/terminal';
import type { OutputItem } from '@/components/terminal/TerminalLayout';
import type { RuntimeEvent } from '@/types';

export type RoleMemory = {
  outputs: OutputItem[];
  executionTasks: ExecutionTask[];
  tokenCounts?: {
    input: number;
    output: number;
    total: number;
  };
};

export type OutputIndex = Map<string, { role: RoleId; outputId: string }>;

type FormatTimestamp = (ts: number) => string;

const defaultFormatTimestamp: FormatTimestamp = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function appendOutput(roleMemory: Record<RoleId, RoleMemory>, role: RoleId, item: OutputItem) {
  const memory = roleMemory[role];
  const next: RoleMemory = {
    ...memory,
    outputs: [...(memory.outputs ?? []), item],
  };

  return {
    ...roleMemory,
    [role]: next,
  };
}

function updateOutput(
  roleMemory: Record<RoleId, RoleMemory>,
  role: RoleId,
  outputId: string,
  updater: (output: OutputItem) => OutputItem
) {
  const memory = roleMemory[role];
  const outputs = memory.outputs ?? [];

  const nextOutputs = outputs.map((output) =>
    output.id === outputId ? updater(output) : output
  );

  return {
    ...roleMemory,
    [role]: {
      ...memory,
      outputs: nextOutputs,
    },
  };
}

function findOutput(index: OutputIndex, correlationId: string) {
  return index.get(correlationId) || null;
}

export function applyRuntimeEvent(input: {
  roleMemory: Record<RoleId, RoleMemory>;
  outputIndex: OutputIndex;
  currentRole: RoleId;
  event: RuntimeEvent;
  formatTimestamp?: FormatTimestamp;
}): { roleMemory: Record<RoleId, RoleMemory>; outputIndex: OutputIndex } {
  const { currentRole, event } = input;
  const formatTimestamp = input.formatTimestamp ?? defaultFormatTimestamp;

  const outputIndex = new Map(input.outputIndex);
  const correlationId = event.header.correlationId;
  const mapped = findOutput(outputIndex, correlationId);

  const baseId = `evt-${event.type}-${correlationId}-${event.header.timestamp}`;
  const timestamp = formatTimestamp(event.header.timestamp);

  if (event.type === 'STDOUT_CHUNK' || event.type === 'STDERR_CHUNK') {
    if (!mapped) {
      return {
        roleMemory: appendOutput(input.roleMemory, currentRole, {
          id: baseId,
          type: 'shell',
          command: event.type,
          content: event.content,
          status: event.type === 'STDERR_CHUNK' ? 'error' : 'success',
          timestamp,
          agentRole: currentRole,
        }),
        outputIndex,
      };
    }

    const nextRoleMemory = updateOutput(input.roleMemory, mapped.role, mapped.outputId, (output) => {
      const prefix = event.type === 'STDERR_CHUNK' ? '\n[stderr]\n' : '';
      return {
        ...output,
        content: `${output.content || ''}${prefix}${event.content}`,
      };
    });

    return { roleMemory: nextRoleMemory, outputIndex };
  }

  if (event.type === 'PROCESS_EXITED') {
    if (!mapped) {
      return {
        roleMemory: appendOutput(input.roleMemory, currentRole, {
          id: baseId,
          type: 'shell',
          command: 'Process exited',
          content: `Exit Code: ${event.code}`,
          status: event.code === 0 ? 'success' : 'error',
          timestamp,
          agentRole: currentRole,
        }),
        outputIndex,
      };
    }

    const nextRoleMemory = updateOutput(input.roleMemory, mapped.role, mapped.outputId, (output) => {
      const status = event.code === 0 ? 'success' : 'error';
      const suffix = `\n(exit ${event.code})`;
      return {
        ...output,
        status,
        content: `${output.content || ''}${suffix}`,
      };
    });

    return { roleMemory: nextRoleMemory, outputIndex };
  }

  if (event.type === 'PERMISSION_REQUESTED') {
    if (mapped) {
      const nextRoleMemory = updateOutput(input.roleMemory, mapped.role, mapped.outputId, (output) => ({
        ...output,
        status: 'error',
        action: { kind: 'permission', requestId: event.requestId, command: event.command },
        content: output.content || `Permission required for: ${event.command}`,
      }));
      return { roleMemory: nextRoleMemory, outputIndex };
    }

    const item: OutputItem = {
      id: baseId,
      type: 'shell',
      command: 'Permission required',
      content: `Command: ${event.command}`,
      status: 'error',
      timestamp,
      agentRole: currentRole,
      action: { kind: 'permission', requestId: event.requestId, command: event.command },
    };

    return {
      roleMemory: appendOutput(input.roleMemory, currentRole, item),
      outputIndex,
    };
  }

  if (event.type === 'WORKFLOW_ERROR') {
    if (mapped) {
      const nextRoleMemory = updateOutput(input.roleMemory, mapped.role, mapped.outputId, (output) => ({
        ...output,
        status: 'error',
        content: `${output.content || ''}\n[error] ${event.error}`.trim(),
      }));
      return { roleMemory: nextRoleMemory, outputIndex };
    }

    const item: OutputItem = {
      id: baseId,
      type: 'shell',
      command: 'Workflow error',
      content: event.error,
      status: 'error',
      timestamp,
      agentRole: currentRole,
    };

    return { roleMemory: appendOutput(input.roleMemory, currentRole, item), outputIndex };
  }

  if (event.type === 'SECURITY_VIOLATION') {
    const item: OutputItem = {
      id: baseId,
      type: 'shell',
      command: `Security violation: ${event.policy}`,
      content: event.attemptedPath,
      status: 'error',
      timestamp,
      agentRole: currentRole,
    };

    return { roleMemory: appendOutput(input.roleMemory, currentRole, item), outputIndex };
  }

  if (event.type === 'OLLAMA_BIT') {
    if (!mapped) {
      return {
        roleMemory: appendOutput(input.roleMemory, currentRole, {
          id: baseId,
          type: 'agent',
          command: 'LLM stream',
          content: event.delta,
          status: 'running',
          timestamp,
          agentRole: currentRole,
        }),
        outputIndex,
      };
    }

    const nextRoleMemory = updateOutput(input.roleMemory, mapped.role, mapped.outputId, (output) => ({
      ...output,
      status: 'running',
      content: `${output.content || ''}${event.delta}`,
    }));

    return { roleMemory: nextRoleMemory, outputIndex };
  }

  if (event.type === 'OLLAMA_CHAT_COMPLETED') {
    if (!mapped) {
      return {
        roleMemory: appendOutput(input.roleMemory, currentRole, {
          id: baseId,
          type: 'agent',
          command: 'LLM',
          content: event.response.message.content,
          status: 'success',
          timestamp,
          agentRole: currentRole,
        }),
        outputIndex,
      };
    }

    const nextRoleMemory = updateOutput(input.roleMemory, mapped.role, mapped.outputId, (output) => ({
      ...output,
      status: 'success',
      content: event.response.message.content,
    }));

    return { roleMemory: nextRoleMemory, outputIndex };
  }

  if (event.type === 'OLLAMA_CHAT_FAILED' || event.type === 'OLLAMA_ERROR') {
    const errorMessage = event.error;

    if (mapped) {
      const nextRoleMemory = updateOutput(input.roleMemory, mapped.role, mapped.outputId, (output) => ({
        ...output,
        status: 'error',
        content: `${output.content || ''}\n[ollama] ${errorMessage}`.trim(),
      }));
      return { roleMemory: nextRoleMemory, outputIndex };
    }

    const item: OutputItem = {
      id: baseId,
      type: 'agent',
      command: 'Ollama error',
      content: errorMessage,
      status: 'error',
      timestamp,
      agentRole: currentRole,
    };

    return { roleMemory: appendOutput(input.roleMemory, currentRole, item), outputIndex };
  }

  if (event.type === 'SYS_READY') {
    const item: OutputItem = {
      id: baseId,
      type: 'shell',
      command: 'System ready',
      content: `Run: ${event.runId}`,
      status: 'success',
      timestamp,
      agentRole: currentRole,
    };

    return { roleMemory: appendOutput(input.roleMemory, currentRole, item), outputIndex };
  }

  return { roleMemory: input.roleMemory, outputIndex };
}
