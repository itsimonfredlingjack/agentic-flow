import { z } from 'zod';

export const RoleIdSchema = z.enum(['PLAN', 'BUILD', 'REVIEW', 'DEPLOY']);

export const OutputItemSchema = z.object({
  id: z.string(),
  type: z.enum(['shell', 'agent']),
  command: z.string(),
  content: z.string(),
  status: z.enum(['running', 'success', 'error', 'idle']),
  timestamp: z.string(),
  agentRole: RoleIdSchema.optional(),
  action: z
    .discriminatedUnion('kind', [
      z.object({
        kind: z.literal('permission'),
        requestId: z.string(),
        command: z.string(),
      }),
    ])
    .optional(),
});

export const ExecutionTaskSchema = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum(['pending', 'in-progress', 'completed']),
});

export const TokenCountsSchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const RoleMemorySchema = z.object({
  outputs: z.array(OutputItemSchema),
  executionTasks: z.array(ExecutionTaskSchema),
  tokenCounts: TokenCountsSchema.optional(),
});

export const V2SnapshotSchema = z.object({
  version: z.literal(1),
  runId: z.string(),
  currentRole: RoleIdSchema,
  roleMemory: z.record(RoleIdSchema, RoleMemorySchema),
  selectedModels: z.record(RoleIdSchema, z.string()).optional(),
});

export type V2Snapshot = z.infer<typeof V2SnapshotSchema>;

export function coerceV2Snapshot(input: unknown): V2Snapshot | null {
  const result = V2SnapshotSchema.safeParse(input);
  return result.success ? result.data : null;
}
