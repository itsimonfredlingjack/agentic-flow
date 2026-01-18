// src/lib/auditLog.ts
// Security audit logging for tracking sensitive operations

import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type AuditEventType =
  | 'COMMAND_EXECUTED'
  | 'COMMAND_DENIED'
  | 'PERMISSION_REQUESTED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_DENIED'
  | 'FILE_WRITTEN'
  | 'FILE_WRITE_BLOCKED'
  | 'SECURITY_VIOLATION'
  | 'RATE_LIMIT_HIT'
  | 'AUTH_FAILURE';

export interface AuditEvent {
  timestamp: string;
  type: AuditEventType;
  clientId: string;
  sessionId?: string;
  details: Record<string, unknown>;
}

/**
 * Get the audit log file path.
 * Uses AUDIT_LOG_PATH env var if set, otherwise ~/.glass-pipeline/audit.log
 */
function getAuditLogPath(): string {
  if (process.env.AUDIT_LOG_PATH) {
    return process.env.AUDIT_LOG_PATH;
  }

  const dataDir = join(homedir(), '.glass-pipeline');

  try {
    mkdirSync(dataDir, { recursive: true });
  } catch {
    // Directory might already exist
  }

  return join(dataDir, 'audit.log');
}

class AuditLogger {
  private logPath: string;
  private enabled: boolean;

  constructor() {
    this.logPath = getAuditLogPath();
    // Can be disabled via env var for development
    this.enabled = process.env.DISABLE_AUDIT_LOG !== 'true';

    if (this.enabled) {
      console.log(`[AuditLog] Audit logging enabled at: ${this.logPath}`);
    }
  }

  /**
   * Log a security-relevant event
   */
  public log(
    type: AuditEventType,
    clientId: string,
    details: Record<string, unknown>,
    sessionId?: string
  ): void {
    if (!this.enabled) return;

    const event: AuditEvent = {
      timestamp: new Date().toISOString(),
      type,
      clientId,
      sessionId,
      details,
    };

    try {
      const line = JSON.stringify(event) + '\n';
      appendFileSync(this.logPath, line, 'utf8');
    } catch (err) {
      // Don't crash if audit logging fails - just warn
      console.warn('[AuditLog] Failed to write audit log:', err);
    }
  }

  // Convenience methods for common event types

  public logCommandExecuted(
    clientId: string,
    command: string,
    sessionId?: string
  ): void {
    this.log('COMMAND_EXECUTED', clientId, { command }, sessionId);
  }

  public logCommandDenied(
    clientId: string,
    command: string,
    reason: string,
    sessionId?: string
  ): void {
    this.log('COMMAND_DENIED', clientId, { command, reason }, sessionId);
  }

  public logPermissionRequested(
    clientId: string,
    requestId: string,
    command: string,
    sessionId?: string
  ): void {
    this.log('PERMISSION_REQUESTED', clientId, { requestId, command }, sessionId);
  }

  public logPermissionGranted(
    clientId: string,
    requestId: string,
    sessionId?: string
  ): void {
    this.log('PERMISSION_GRANTED', clientId, { requestId }, sessionId);
  }

  public logPermissionDenied(
    clientId: string,
    requestId: string,
    sessionId?: string
  ): void {
    this.log('PERMISSION_DENIED', clientId, { requestId }, sessionId);
  }

  public logFileWritten(
    clientId: string,
    path: string,
    bytes: number,
    sessionId?: string
  ): void {
    this.log('FILE_WRITTEN', clientId, { path, bytes }, sessionId);
  }

  public logFileWriteBlocked(
    clientId: string,
    path: string,
    reason: string,
    sessionId?: string
  ): void {
    this.log('FILE_WRITE_BLOCKED', clientId, { path, reason }, sessionId);
  }

  public logSecurityViolation(
    clientId: string,
    policy: string,
    attemptedAction: string,
    sessionId?: string
  ): void {
    this.log('SECURITY_VIOLATION', clientId, { policy, attemptedAction }, sessionId);
  }

  public logRateLimitHit(
    clientId: string,
    endpoint: string,
    retryAfter: number
  ): void {
    this.log('RATE_LIMIT_HIT', clientId, { endpoint, retryAfter });
  }
}

// Singleton instance
export const auditLog = new AuditLogger();
