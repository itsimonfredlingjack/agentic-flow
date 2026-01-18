import { StreamItem } from '@/components/AgentWorkspace';

export interface RunGroup {
    id: string;
    userPrompt: string;
    status: 'running' | 'done' | 'failed' | 'cancelled';
    startTime: string;
    items: StreamItem[];
}

export function aggregateRuns(items: StreamItem[]): RunGroup[] {
    const runs: RunGroup[] = [];
    let currentRun: RunGroup | null = null;

    items.forEach((item) => {
        // 1. Detect Run Boundaries (User Input starts a run)
        if (item.isUser) {
            // Close previous run if exists
            if (currentRun) {
                // Determine final status of previous run if not set
                if (currentRun.status === 'running') {
                    currentRun.status = 'done'; // Assumption: if new run starts, old one is done
                }
            }

            // Start new run
            currentRun = {
                id: item.id,
                userPrompt: item.content,
                status: 'running',
                startTime: item.timestamp,
                items: [] // The user prompt itself is the header, not an item in the body
            };
            runs.push(currentRun);
            return;
        }

        // 2. Handle Orphaned Items (System/Init events before first user input)
        if (!currentRun) {
            // Create a pseudo-run for system init
            currentRun = {
                id: 'system-init',
                userPrompt: 'System Initialization',
                status: 'done',
                startTime: item.timestamp,
                items: []
            };
            runs.push(currentRun);
        }

        // 3. Add Item to Current Run
        currentRun.items.push(item);

        // 4. Update Status based on Item
        if (item.type === 'error' || item.severity === 'error') {
            currentRun.status = 'failed';
        }
        // If an item is explicitly a "success" marker (if we had one), we could set 'done'
    });

    return runs;
}
