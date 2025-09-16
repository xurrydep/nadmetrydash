import { createClient } from 'redis';
import { randomBytes } from 'crypto';

// Redis client initialization
let redisClient: ReturnType<typeof createClient> | null = null;

// Initialize Redis client
export async function initRedis() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis Client Error', err);
    });
    
    await redisClient.connect();
  }
  return redisClient;
}

// Session data structure
interface SessionData {
  playerAddress: string;
  encodedKeys: string;
  gameState: any;
  createdAt: number;
  expiresAt: number;
}

// Create a new session
export async function createSession(playerAddress: string, encodedKeys: string): Promise<string> {
  await initRedis();
  
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
  await redisClient!.setex(
    `session:${sessionId}`,
    30 * 60, // 30 minutes in seconds
    JSON.stringify(sessionData)
  );
  
  return sessionId;
}

// Get session data
export async function getSession(sessionId: string): Promise<SessionData | null> {
  await initRedis();
  
  const sessionData = await redisClient!.get(`session:${sessionId}`);
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
export async function updateGameState(sessionId: string, gameState: any): Promise<boolean> {
  const session = await getSession(sessionId);
  if (!session) {
    return false;
  }
  
  session.gameState = { ...session.gameState, ...gameState };
  
  await redisClient!.setex(
    `session:${sessionId}`,
    30 * 60, // 30 minutes in seconds
    JSON.stringify(session)
  );
  
  return true;
}

// Get current game state from session
export async function getGameState(sessionId: string): Promise<any | null> {
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }
  
  return session.gameState;
}

// Delete session
export async function deleteSession(sessionId: string): Promise<void> {
  await initRedis();
  await redisClient!.del(`session:${sessionId}`);
}

// Generate hash for score verification
export function generateScoreHash(sessionId: string, score: number, additionalData: any = {}): string {
  const data = `${sessionId}-${score}-${JSON.stringify(additionalData)}-${process.env.API_SECRET || 'fallback_secret'}`;
  return require('crypto').createHash('sha256').update(data).digest('hex');
}

// Verify score hash
export async function verifyScoreHash(sessionId: string, score: number, hash: string, additionalData: any = {}): Promise<boolean> {
  const expectedHash = generateScoreHash(sessionId, score, additionalData);
  return expectedHash === hash;
}