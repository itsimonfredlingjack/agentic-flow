// src/lib/rateLimit.ts
// Simple in-memory rate limiter for API protection

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

// Default configs for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  // Command execution - more restrictive
  command: { windowMs: 60_000, maxRequests: 30 },
  // LLM chat - expensive operation
  ollama: { windowMs: 60_000, maxRequests: 20 },
  // File operations - moderate
  apply: { windowMs: 60_000, maxRequests: 50 },
  // Read operations - lenient
  default: { windowMs: 60_000, maxRequests: 100 },
} as const;

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  /**
   * Check if a request should be allowed.
   * Returns { allowed: true } or { allowed: false, retryAfter: seconds }
   */
  public check(
    identifier: string,
    config: RateLimitConfig = RATE_LIMIT_CONFIGS.default
  ): { allowed: true } | { allowed: false; retryAfter: number } {
    const now = Date.now();
    const key = identifier;
    const entry = this.store.get(key);

    // No existing entry or window expired - allow and create new entry
    if (!entry || now > entry.resetTime) {
      this.store.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return { allowed: true };
    }

    // Within window - check count
    if (entry.count < config.maxRequests) {
      entry.count++;
      return { allowed: true };
    }

    // Rate limited
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  /**
   * Get rate limit headers for response
   */
  public getHeaders(
    identifier: string,
    config: RateLimitConfig = RATE_LIMIT_CONFIGS.default
  ): Record<string, string> {
    const entry = this.store.get(identifier);
    const now = Date.now();

    if (!entry || now > entry.resetTime) {
      return {
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': String(config.maxRequests),
        'X-RateLimit-Reset': String(Math.ceil((now + config.windowMs) / 1000)),
      };
    }

    return {
      'X-RateLimit-Limit': String(config.maxRequests),
      'X-RateLimit-Remaining': String(Math.max(0, config.maxRequests - entry.count)),
      'X-RateLimit-Reset': String(Math.ceil(entry.resetTime / 1000)),
    };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  public destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Extract client identifier from request.
 * Uses IP address or falls back to a default for local development.
 */
export function getClientIdentifier(request: Request): string {
  // Try various headers for real IP (behind proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback for local development
  return 'local-client';
}
