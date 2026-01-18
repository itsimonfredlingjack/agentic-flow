// src/lib/runtimeManager.ts
import { HostRuntime } from './runtime';

// Use a global to persist the runtime during development/HMR
const globalForRuntime = global as unknown as {
  runtime: HostRuntime | undefined;
  cleanupRegistered?: boolean;
};

export function getRuntime(runId: string): HostRuntime {
  if (!globalForRuntime.runtime) {
    globalForRuntime.runtime = new HostRuntime(runId);
  } else {
    // Update the active runId if different - ensures events are stored under correct session
    globalForRuntime.runtime.setActiveRunId(runId);
  }

  // Register process cleanup handlers once (for graceful shutdown)
  if (!globalForRuntime.cleanupRegistered) {
    globalForRuntime.cleanupRegistered = true;

    const cleanup = () => {
      if (globalForRuntime.runtime) {
        console.log('[RuntimeManager] Cleaning up runtime on process exit');
        globalForRuntime.runtime.destroy();
        globalForRuntime.runtime = undefined;
      }
    };

    // Handle graceful shutdown
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);

    // Handle HMR module disposal in development
    if (process.env.NODE_ENV === 'development' && (module as NodeModule & { hot?: { dispose: (cb: () => void) => void } }).hot) {
      (module as NodeModule & { hot: { dispose: (cb: () => void) => void } }).hot.dispose(cleanup);
    }
  }

  return globalForRuntime.runtime;
}

/**
 * Manually destroy the runtime instance.
 * Useful for testing or explicit cleanup scenarios.
 */
export function destroyRuntime(): void {
  if (globalForRuntime.runtime) {
    globalForRuntime.runtime.destroy();
    globalForRuntime.runtime = undefined;
  }
}

export const runtimeManager = {
  getRuntime,
  destroyRuntime
};
