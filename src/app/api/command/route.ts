import { NextResponse } from 'next/server';
import { runtimeManager } from '@/lib/runtimeManager';
import { AgentIntent } from '@/types';
import { z } from 'zod';
import { rateLimiter, getClientIdentifier, RATE_LIMIT_CONFIGS } from '@/lib/rateLimit';
import { auditLog } from '@/lib/auditLog';

export const runtime = 'nodejs';

// Zod schemas for runtime validation of AgentIntent
const MessageHeaderSchema = z.object({
    sessionId: z.string(),
    correlationId: z.string(),
    timestamp: z.number(),
});

const OllamaOptionsSchema = z.record(z.string(), z.unknown()).optional();

const OllamaChatMessageSchema = z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
});

const AgentIntentSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('INTENT_START_BUILD'),
        header: MessageHeaderSchema,
        blueprint: z.record(z.string(), z.unknown()).optional(),
    }),
    z.object({
        type: z.literal('INTENT_EXEC_CMD'),
        header: MessageHeaderSchema,
        command: z.string().min(1),
    }),
    z.object({
        type: z.literal('INTENT_CANCEL'),
        header: MessageHeaderSchema,
        targetCorrelationId: z.string(),
    }),
    z.object({
        type: z.literal('INTENT_GRANT_PERMISSION'),
        header: MessageHeaderSchema,
        requestId: z.string(),
    }),
    z.object({
        type: z.literal('INTENT_DENY_PERMISSION'),
        header: MessageHeaderSchema,
        requestId: z.string(),
    }),
    z.object({
        type: z.literal('INTENT_RESET'),
        header: MessageHeaderSchema,
    }),
    z.object({
        type: z.literal('INTENT_OLLAMA_GENERATE'),
        header: MessageHeaderSchema,
        model: z.string().optional(),
        prompt: z.string().min(1),
        options: OllamaOptionsSchema,
    }),
    z.object({
        type: z.literal('INTENT_OLLAMA_CHAT'),
        header: MessageHeaderSchema,
        messages: z.array(OllamaChatMessageSchema).min(1),
        model: z.string().optional(),
        options: OllamaOptionsSchema,
    }),
]);

const RequestBodySchema = z.object({
    runId: z.string().min(1),
    intent: AgentIntentSchema,
});

export async function POST(request: Request) {
    // Rate limiting check
    const clientId = getClientIdentifier(request);
    const rateCheck = rateLimiter.check(`command:${clientId}`, RATE_LIMIT_CONFIGS.command);

    if (!rateCheck.allowed) {
        auditLog.logRateLimitHit(clientId, '/api/command', rateCheck.retryAfter);
        const headers = rateLimiter.getHeaders(`command:${clientId}`, RATE_LIMIT_CONFIGS.command);
        return NextResponse.json(
            { error: 'Too many requests', retryAfter: rateCheck.retryAfter },
            { status: 429, headers }
        );
    }

    // Parse JSON with error handling for malformed requests
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // Validate request body with Zod schema
    const parseResult = RequestBodySchema.safeParse(body);
    if (!parseResult.success) {
        const errors = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
        return NextResponse.json({
            error: 'Validation failed',
            details: errors.slice(0, 5) // Limit error details to prevent info leakage
        }, { status: 400 });
    }

    const { runId, intent } = parseResult.data;

    // Audit log for security-relevant intents
    if (intent.type === 'INTENT_EXEC_CMD') {
        auditLog.logCommandExecuted(clientId, intent.command, runId);
    } else if (intent.type === 'INTENT_GRANT_PERMISSION') {
        auditLog.logPermissionGranted(clientId, intent.requestId, runId);
    } else if (intent.type === 'INTENT_DENY_PERMISSION') {
        auditLog.logPermissionDenied(clientId, intent.requestId, runId);
    }

    const hostRuntime = runtimeManager.getRuntime(runId);
    hostRuntime.dispatch(intent as AgentIntent);

    return NextResponse.json({ success: true });
}