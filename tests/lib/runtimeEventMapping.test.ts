import { describe, expect, it } from 'vitest';

import { applyRuntimeEvent } from '@/components/v2/applyRuntimeEvent';
import type { RoleMemory } from '@/components/v2/applyRuntimeEvent';
import type { RoleId } from '@/components/terminal';

function createRoleMemory(): Record<RoleId, RoleMemory> {
  return {
    PLAN: { outputs: [], executionTasks: [] },
    BUILD: { outputs: [], executionTasks: [] },
    REVIEW: { outputs: [], executionTasks: [] },
    DEPLOY: { outputs: [], executionTasks: [] },
  };
}

describe('applyRuntimeEvent', () => {
  it('appends STDOUT to mapped output and marks exit status on PROCESS_EXITED', () => {
    const role: RoleId = 'PLAN';
    const correlationId = 'c1';
    const outputId = 'shell-c1';

    const outputIndex = new Map([[correlationId, { role, outputId }]]);
    const roleMemory: Record<RoleId, RoleMemory> = {
      ...createRoleMemory(),
      PLAN: {
        outputs: [
          {
            id: outputId,
            type: 'shell',
            command: 'echo hello',
            content: '',
            status: 'running',
            timestamp: '12:00',
            agentRole: role,
          },
        ],
        executionTasks: [],
      },
    };

    const header = { sessionId: 'RUN-test', correlationId, timestamp: 1 };

    const afterStdout = applyRuntimeEvent({
      roleMemory,
      outputIndex,
      currentRole: role,
      event: { type: 'STDOUT_CHUNK', header, content: 'hello\n' },
      formatTimestamp: () => '12:00',
    });

    expect(afterStdout.roleMemory.PLAN.outputs[0].content).toContain('hello');

    const afterExit = applyRuntimeEvent({
      roleMemory: afterStdout.roleMemory,
      outputIndex: afterStdout.outputIndex,
      currentRole: role,
      event: { type: 'PROCESS_EXITED', header, code: 0 },
      formatTimestamp: () => '12:00',
    });

    expect(afterExit.roleMemory.PLAN.outputs[0].status).toBe('success');
    expect(afterExit.roleMemory.PLAN.outputs[0].content).toContain('(exit 0)');
  });

  it('attaches permission action to mapped output', () => {
    const role: RoleId = 'PLAN';
    const correlationId = 'c2';
    const outputId = 'shell-c2';

    const outputIndex = new Map([[correlationId, { role, outputId }]]);
    const roleMemory: Record<RoleId, RoleMemory> = {
      ...createRoleMemory(),
      PLAN: {
        outputs: [
          {
            id: outputId,
            type: 'shell',
            command: 'rm -rf /',
            content: '',
            status: 'running',
            timestamp: '12:00',
            agentRole: role,
          },
        ],
        executionTasks: [],
      },
    };

    const header = { sessionId: 'RUN-test', correlationId, timestamp: 1 };

    const next = applyRuntimeEvent({
      roleMemory,
      outputIndex,
      currentRole: role,
      event: {
        type: 'PERMISSION_REQUESTED',
        header,
        requestId: 'req-1',
        command: 'rm -rf /',
        riskLevel: 'high',
      },
      formatTimestamp: () => '12:00',
    });

    const output = next.roleMemory.PLAN.outputs[0];
    expect(output.action?.kind).toBe('permission');
    expect(output.action?.requestId).toBe('req-1');
  });
});
