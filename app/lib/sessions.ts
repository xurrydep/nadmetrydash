import { createClient } from 'redis';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';

// Redis client initialization
let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnectionFailed = false;

// Initialize Redis client
export async function initRedis() {
  // If we've already failed to connect, don't try again
  if (redisConnectionFailed) {
    return null;
  }
  
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis Client Error', err);
      redisConnectionFailed = true;
    });
    
    try {
      await redisClient.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      redisConnectionFailed = true;
      return null;
    }
  }
  return redisClient;
}

// Session data structure
interface SessionData {
  playerAddress: string;
  encodedKeys: string;
  gameState: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
}

// Create a new session
export async function createSession(playerAddress: string, encodedKeys: string): Promise<string> {
  const client = await initRedis();
  if (!client) {
    // If Redis is not available, generate a session ID but don't store it
    console.warn('Redis not available, creating session without storage');
    return randomBytes(32).toString('hex');
  }
  
  // Generate a unique session ID
  const sessionId = randomBytes(32).toString('hex');
  
  // Set session expiration (30 minutes)
  const createdAt = Date.now();
  const expiresAt = createdAt + 30 * 60 * 1000; // 30 minutes
  
  const sessionData: SessionData = {
    playerAddress,
    encodedKeys,
    gameState: {},
    createdAt,
    expiresAt
  };
  
  // Store session in Redis with expiration
  await client.setex(
    `session:${sessionId}`,
    30 * 60, // 30 minutes in seconds
    JSON.stringify(sessionData)
  );
  
  return sessionId;
}

// Get session data
export async function getSession(sessionId: string): Promise<SessionData | null> {
  const client = await initRedis();
  if (!client) {
    // If Redis is not available, we can't retrieve session data
    return null;
  }
  
  const sessionData = await client.get(`session:${sessionId}`);
  if (!sessionData) {
    return null;
  }
  
  const session = JSON.parse(sessionData) as SessionData;
  
  // Check if session has expired
  if (session.expiresAt < Date.now()) {
    await deleteSession(sessionId);
    return null;
  }
  
  return session;
}

// Update game state in session
export async function updateGameState(sessionId: string, gameState: Record<string, unknown>): Promise<boolean> {
  const client = await initRedis();
  if (!client) {
    // If Redis is not available, we can't update session data
    return false;
  }
  
  const session = await getSession(sessionId);
  if (!session) {
    return false;
  }
  
  session.gameState = { ...session.gameState, ...gameState };
  
  await client.setex(
    `session:${sessionId}`,
    30 * 60, // 30 minutes in seconds
    JSON.stringify(session)
  );
  
  return true;
}

// Get current game state from session
export async function getGameState(sessionId: string): Promise<Record<string, unknown> | null> {
  const client = await initRedis();
  if (!client) {
    // If Redis is not available, we can't retrieve session data
    return null;
  }
  
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }
  
  return session.gameState;
}

// Delete session
export async function deleteSession(sessionId: string): Promise<void> {
  const client = await initRedis();
  if (!client) {
    // If Redis is not available, we can't delete session data
    return;
  }
  await client.del(`session:${sessionId}`);
}

// Generate hash for score verification
export function generateScoreHash(sessionId: string, score: number, additionalData: Record<string, unknown> = {}): string {
  // If no session ID, generate a hash without it (less secure but allows gameplay)
  const sessionIdPart = sessionId || 'no-session';
  const data = `${sessionIdPart}-${score}-${JSON.stringify(additionalData)}-${process.env.API_SECRET || 'fallback_secret'}`;
  return createHash('sha256').update(data).digest('hex');
}

// Verify score hash
export async function verifyScoreHash(sessionId: string, score: number, hash: string, additionalData: Record<string, unknown> = {}): Promise<boolean> {
  // If no session ID, we can't verify the hash properly
  if (!sessionId) {
    console.warn('No session ID provided for hash verification');
    return false;
  }
  
  const expectedHash = generateScoreHash(sessionId, score, additionalData);
  return expectedHash === hash;
}