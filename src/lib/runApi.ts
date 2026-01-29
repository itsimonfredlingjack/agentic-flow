export type RunBootstrapResponse = {
  id: string;
  snapshot: unknown | null;
  snapshotTimestamp: number | null;
  isResumed: boolean;
};

export type RunListResponse = {
  sessions: Array<{ id: string; createdAt: number; eventCount: number }>;
};

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 500);
  } catch {
    return '';
  }
}

export async function createRun(): Promise<RunBootstrapResponse> {
  const response = await fetch('/api/run', { method: 'GET' });
  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
  return response.json();
}

export async function resumeRun(runId: string): Promise<RunBootstrapResponse> {
  const url = new URL('/api/run', window.location.origin);
  url.searchParams.set('runId', runId);
  const response = await fetch(url.toString(), { method: 'GET' });
  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
  return response.json();
}

export async function listRuns(limit = 20): Promise<RunListResponse> {
  const url = new URL('/api/run', window.location.origin);
  url.searchParams.set('list', 'true');
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString(), { method: 'GET' });
  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
  return response.json();
}

export async function loadRecentEvents(runId: string, _limit = 100): Promise<unknown> {
  const url = new URL('/api/events', window.location.origin);
  url.searchParams.set('runId', runId);
  const response = await fetch(url.toString(), { method: 'GET' });
  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
  return response.json();
}

export async function saveSnapshot(runId: string, snapshot: unknown): Promise<void> {
  const response = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: runId, snapshot, status: 'ui' }),
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
}
