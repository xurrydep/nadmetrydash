interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  resetTime?: number;
}

export function rateLimit(identifier: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetTime) {
    const resetTime = now + config.windowMs;
    rateLimitMap.set(identifier, { count: 1, resetTime });
    return { allowed: true, remaining: config.maxRequests - 1, resetTime };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime };
}

// Specialized rate limiter for score submissions (only 1 save score per game session)
const scoreRateLimitStore = new Map<string, RateLimitEntry>();

export function scoreRateLimit(
  playerAddress: string,
  scoreAmount: number
): RateLimitResult {
  const now = Date.now();
  const key = `score_${playerAddress}`;
  const entry = scoreRateLimitStore.get(key);

  // Check if this is a suspiciously high score submission
  if (scoreAmount > 1000) { // Maximum score per request is 1000
    // For high scores, apply stricter limits
    const strictKey = `high_score_${playerAddress}`;
    const strictEntry = scoreRateLimitStore.get(strictKey);
    
    if (!strictEntry || strictEntry.resetTime <= now) {
      scoreRateLimitStore.set(strictKey, {
        count: 1,
        resetTime: now + 300000, // 5 minutes
      });
    } else if (strictEntry.count >= 1) {
      // Only allow one high score submission per 5 minutes
      return {
        allowed: false,
        resetTime: strictEntry.resetTime,
      };
    } else {
      strictEntry.count++;
      scoreRateLimitStore.set(strictKey, strictEntry);
    }
  }

  if (!entry || entry.resetTime <= now) {
    // First request or window has expired
    scoreRateLimitStore.set(key, {
      count: 1,
      resetTime: now + 60000, // 1 minute window for score submissions
    });
    return { allowed: true };
  }

  // Only allow 1 save score per game as per requirement
  if (entry.count >= 1) {
    // Rate limit exceeded
    return {
      allowed: false,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  scoreRateLimitStore.set(key, entry);
  return { allowed: true };
}

export function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
  
  // Clean up score rate limit entries
  for (const [key, entry] of scoreRateLimitStore.entries()) {
    if (now > entry.resetTime) {
      scoreRateLimitStore.delete(key);
    }
  }
}

setInterval(cleanupExpiredEntries, 60000);