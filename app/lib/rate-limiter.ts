import { createHash } from 'crypto';

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

// Deduplication store for score submissions
const scoreDeduplicationStore = new Map<string, number>(); // scoreHash -> timestamp

export function isDuplicateScoreSubmission(
  playerAddress: string,
  scoreAmount: number,
  gameStateHash?: string
): boolean {
  // Create a unique hash for this score submission
  const scoreData = `${playerAddress}-${scoreAmount}-${gameStateHash || ''}-${Math.floor(Date.now() / 1000)}`;
  const scoreHash = createHash('sha256').update(scoreData).digest('hex');
  
  const now = Date.now();
  const existingTimestamp = scoreDeduplicationStore.get(scoreHash);
  
  // If we've seen this exact score submission in the last 10 minutes, it's a duplicate
  if (existingTimestamp && now - existingTimestamp < 600000) { // 10 minutes
    return true;
  }
  
  // Store this submission
  scoreDeduplicationStore.set(scoreHash, now);
  
  // Clean up old entries
  for (const [hash, timestamp] of scoreDeduplicationStore.entries()) {
    if (now - timestamp > 600000) { // 10 minutes
      scoreDeduplicationStore.delete(hash);
    }
  }
  
  return false;
}

// Enhanced score validation function
export function validateScoreSubmission(
  playerAddress: string,
  scoreAmount: number,
  transactionAmount: number,
  gameState?: { level?: number; score?: number }
): { valid: boolean; error?: string } {
  // Maximum limits to prevent abuse
  const MAX_SCORE_PER_REQUEST = 1000;
  const MAX_TRANSACTIONS_PER_REQUEST = 1;
  const MAX_SCORE_PER_SECOND = 500;

  // Validate input ranges
  if (scoreAmount < 0 || transactionAmount < 0) {
    return { valid: false, error: "Score and transaction amounts must be non-negative" };
  }

  if (scoreAmount > MAX_SCORE_PER_REQUEST || transactionAmount > MAX_TRANSACTIONS_PER_REQUEST) {
    return { 
      valid: false, 
      error: `Amounts too large. Max score: ${MAX_SCORE_PER_REQUEST}, Max transactions: ${MAX_TRANSACTIONS_PER_REQUEST}` 
    };
  }

  // Validate score progression speed (max 500 points per second)
  const scorePerSecond = scoreAmount / (transactionAmount || 1);
  if (scorePerSecond > MAX_SCORE_PER_SECOND) {
    return { 
      valid: false, 
      error: `Score progression too fast. Maximum: ${MAX_SCORE_PER_SECOND} points per second` 
    };
  }

  // If game state is provided, validate against it
  if (gameState && gameState.score !== undefined) {
    // Check if the submitted score matches the game state
    if (scoreAmount !== gameState.score) {
      return { valid: false, error: "Score mismatch with game state" };
    }
    
    // Validate score against level (simple check)
    const expectedMaxScore = (gameState.level || 1) * 1000;
    if (scoreAmount > expectedMaxScore) {
      return { valid: false, error: `Score too high for current level. Max for level: ${expectedMaxScore}` };
    }
  }

  return { valid: true };
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
  
  // Clean up score deduplication entries
  for (const [hash, timestamp] of scoreDeduplicationStore.entries()) {
    if (now - timestamp > 600000) { // 10 minutes
      scoreDeduplicationStore.delete(hash);
    }
  }
}

setInterval(cleanupExpiredEntries, 60000);