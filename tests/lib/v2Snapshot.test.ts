import { describe, expect, it } from 'vitest';

import { coerceV2Snapshot } from '@/components/v2/v2Snapshot';

describe('coerceV2Snapshot', () => {
  it('parses a valid snapshot', () => {
    const snapshot = {
      version: 1,
      runId: 'RUN-test',
      currentRole: 'PLAN',
      roleMemory: {
        PLAN: { outputs: [], executionTasks: [], tokenCounts: { input: 0, output: 0, total: 0 } },
        BUILD: { outputs: [], executionTasks: [] },
        REVIEW: { outputs: [], executionTasks: [] },
        DEPLOY: { outputs: [], executionTasks: [] },
      },
      selectedModels: {
        PLAN: 'm1',
        BUILD: 'm2',
        REVIEW: 'm3',
        DEPLOY: 'm4',
      },
    };

    const parsed = coerceV2Snapshot(snapshot);
    expect(parsed).not.toBeNull();
    expect(parsed?.runId).toBe('RUN-test');
    expect(parsed?.currentRole).toBe('PLAN');
  });

  it('returns null for invalid version', () => {
    const snapshot = {
      version: 2,
      runId: 'RUN-test',
      currentRole: 'PLAN',
      roleMemory: {
        PLAN: { outputs: [], executionTasks: [] },
        BUILD: { outputs: [], executionTasks: [] },
        REVIEW: { outputs: [], executionTasks: [] },
        DEPLOY: { outputs: [], executionTasks: [] },
      },
    };

    expect(coerceV2Snapshot(snapshot)).toBeNull();
  });

  it('accepts permission action outputs', () => {
    const snapshot = {
      version: 1,
      runId: 'RUN-test',
      currentRole: 'PLAN',
      roleMemory: {
        PLAN: {
          outputs: [
            {
              id: 'shell-1',
              type: 'shell',
              command: 'rm -rf /',
              content: 'Permission required',
              status: 'error',
              timestamp: '12:00',
              agentRole: 'PLAN',
              action: { kind: 'permission', requestId: 'req-1', command: 'rm -rf /' },
            },
          ],
          executionTasks: [],
        },
        BUILD: { outputs: [], executionTasks: [] },
        REVIEW: { outputs: [], executionTasks: [] },
        DEPLOY: { outputs: [], executionTasks: [] },
      },
    };

    const parsed = coerceV2Snapshot(snapshot);
    expect(parsed).not.toBeNull();
    expect(parsed?.roleMemory.PLAN.outputs[0].action?.kind).toBe('permission');
  });
});
