import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  isValidAddress,
} from "@/app/lib/blockchain";
import {
  validateSessionToken,
  validateOrigin,
  createAuthenticatedResponse,
} from "@/app/lib/auth";
import { 
  rateLimit, 
  scoreRateLimit, 
  isDuplicateScoreSubmission, 
  validateScoreSubmission,
  type RateLimitResult 
} from "@/app/lib/rate-limiter";
import {
  generateRequestId,
  isDuplicateRequest,
  markRequestProcessing,
  markRequestComplete,
} from "@/app/lib/request-deduplication";
import "dotenv/config";

// Add this line after imports
let currentUrlIndex = 0;

// Anti-cheat: Store recent score submissions for validation
const recentSubmissions = new Map<string, { timestamp: number, score: number, transactions: number }>();

// Anti-cheat: Track client-side behavior patterns
const clientBehaviorPatterns = new Map<string, { 
  requestCount: number; 
  lastRequestTime: number;
  suspiciousPatterns: string[];
}>();

export async function POST(request: NextRequest) {
  try {
    //* Security checks - Origin validation first
    if (!validateOrigin(request)) {
      return createAuthenticatedResponse(
        { error: "Forbidden: Invalid origin" },
        403
      );
    }

    // Rate limiting
    const clientIp =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rateLimitResult = rateLimit(clientIp, {
      maxRequests: 10,
      windowMs: 60000,
    }); // 10 requests per minute

    if (!rateLimitResult.allowed) {
      return createAuthenticatedResponse(
        {
          error: "Too many requests",
          resetTime: rateLimitResult.resetTime,
        },
        429
      );
    }

    // Parse request body
    const { playerAddress, scoreAmount, transactionAmount, sessionToken, gameStateHash, gameState } =
      await request.json();

    // Anti-cheat: Track client behavior patterns
    const clientId = `${playerAddress}-${clientIp}`;
    let clientBehavior = clientBehaviorPatterns.get(clientId);
    if (!clientBehavior) {
      clientBehavior = { 
        requestCount: 0, 
        lastRequestTime: Date.now(),
        suspiciousPatterns: []
      };
      clientBehaviorPatterns.set(clientId, clientBehavior);
    }
    
    clientBehavior.requestCount++;
    const timeSinceLastRequest = Date.now() - clientBehavior.lastRequestTime;
    clientBehavior.lastRequestTime = Date.now();
    
    // Detect suspicious rapid requests
    if (timeSinceLastRequest < 1000 && clientBehavior.requestCount > 5) {
      clientBehavior.suspiciousPatterns.push('rapid_requests');
      console.warn(`Suspicious rapid requests detected from ${clientId}`);
    }

    // Specialized rate limiting for score submissions
    const scoreRateLimitResult: RateLimitResult = scoreRateLimit(playerAddress, scoreAmount);
    if (!scoreRateLimitResult.allowed) {
      return createAuthenticatedResponse(
        {
          error: "You're submitting scores too frequently. Please wait before trying again.",
          resetTime: scoreRateLimitResult.resetTime,
          message: "You can submit up to 5 scores every 10 minutes. This limit prevents abuse while allowing normal gameplay."
        },
        429
      );
    }

    // Anti-cheat: Check for duplicate score submissions
    if (isDuplicateScoreSubmission(playerAddress, scoreAmount, gameStateHash)) {
      console.warn(`Duplicate score submission detected from ${playerAddress}`);
      return createAuthenticatedResponse(
        { error: "Duplicate score submission detected" },
        400
      );
    }

    // Session token authentication - verify the user controls the wallet and game state
    if (!sessionToken || !validateSessionToken(sessionToken, playerAddress, gameState)) {
      console.warn('Session token validation failed', { 
        sessionToken, 
        playerAddress, 
        gameState,
        tokenLength: sessionToken ? sessionToken.length : 0,
        nodeEnv: process.env.NODE_ENV
      });
      
      // Provide more detailed error information
      if (!sessionToken) {
        return createAuthenticatedResponse(
          { 
            error: "Unauthorized: Missing session token",
            debug: {
              playerAddress,
              timestamp: Date.now(),
              nodeEnv: process.env.NODE_ENV
            }
          },
          401
        );
      }
      
      // If we have a token but validation failed, provide more details
      return createAuthenticatedResponse(
        { 
          error: "Unauthorized: Invalid or expired session token",
          debug: {
            playerAddress,
            tokenLength: sessionToken.length,
            nodeEnv: process.env.NODE_ENV,
            message: "Token validation failed - this could be due to token expiration, mismatched game state, or network issues"
          }
        },
        401
      );
    }

    // Anti-cheat: Validate game state hash if provided
    if (gameStateHash) {
      try {
        const gameStateData = JSON.parse(atob(gameStateHash));
        
        // Basic validation of game state
        if (!gameStateData.player || gameStateData.score === undefined || !gameStateData.timestamp) {
          console.warn('Invalid game state hash structure');
          return createAuthenticatedResponse(
            { error: "Invalid game state data" },
            400
          );
        }
        
        // Check if the timestamp is recent (within 5 minutes)
        const timeDiff = Date.now() - gameStateData.timestamp;
        if (timeDiff > 300000 || timeDiff < 0) { // 5 minutes
          console.warn('Game state timestamp too old or in the future');
          return createAuthenticatedResponse(
            { error: "Game state data expired" },
            400
          );
        }
        
        // Validate that the score matches the game state
        if (gameStateData.score !== scoreAmount) {
          console.warn('Score mismatch between game state and request');
          return createAuthenticatedResponse(
            { error: "Score data mismatch" },
            400
          );
        }
        
        // Additional validation: Check player position consistency
        if (gameStateData.player.x < 0 || gameStateData.player.x > 800 || 
            gameStateData.player.y < 0 || gameStateData.player.y > 600) {
          console.warn('Player position out of bounds in game state');
          clientBehavior.suspiciousPatterns.push('position_manipulation');
          return createAuthenticatedResponse(
            { error: "Invalid player position data" },
            400
          );
        }
        
        // Validate game state against session data
        if (gameState) {
          // Check if level matches
          if (gameState.level !== undefined && gameStateData.level !== gameState.level) {
            console.warn('Level mismatch between session and game state');
            clientBehavior.suspiciousPatterns.push('level_manipulation');
            return createAuthenticatedResponse(
              { error: "Game state level mismatch" },
              400
            );
          }
          
          // Check if score is reasonable for the game state
          if (gameStateData.score > (gameStateData.level || 1) * 1000) {
            console.warn('Score too high for current level');
            clientBehavior.suspiciousPatterns.push('score_manipulation');
            return createAuthenticatedResponse(
              { error: "Score too high for current level" },
              400
            );
          }
        }
      } catch (e) {
        console.warn('Failed to parse game state hash', e);
        clientBehavior.suspiciousPatterns.push('hash_manipulation');
        // Don't fail the request, just log the issue
      }
    } else {
      // In production, game state hash is required
      if (process.env.NODE_ENV === 'production') {
        console.warn('Missing game state hash in production');
        return createAuthenticatedResponse(
          { error: "Missing required game state validation" },
          400
        );
      }
    }

    // Validate input
    if (
      !playerAddress ||
      scoreAmount === undefined ||
      transactionAmount === undefined
    ) {
      return createAuthenticatedResponse(
        {
          error:
            "Missing required fields: playerAddress, scoreAmount, transactionAmount",
        },
        400
      );
    }

    // Validate player address format
    if (!isValidAddress(playerAddress)) {
      return createAuthenticatedResponse(
        { error: "Invalid player address format" },
        400
      );
    }

    // Enhanced score validation
    const scoreValidation = validateScoreSubmission(playerAddress, scoreAmount, transactionAmount, gameState);
    if (!scoreValidation.valid) {
      return createAuthenticatedResponse(
        { error: scoreValidation.error },
        400
      );
    }

    // Anti-cheat: Check for suspicious score patterns
    const playerId = `${playerAddress}-${clientIp}`;
    const now = Date.now();
    
    // Check if we have recent submissions from this player
    if (recentSubmissions.has(playerId)) {
      const lastSubmission = recentSubmissions.get(playerId)!;
      
      // Check if submission is too frequent (less than 5 seconds apart)
      if (now - lastSubmission.timestamp < 5000) {
        console.warn(`Suspicious rapid submission detected from ${playerId}`);
        clientBehavior.suspiciousPatterns.push('rapid_submission');
        return createAuthenticatedResponse(
          { error: "Too many rapid submissions. Please wait before trying again." },
          429
        );
      }
      
      // Check for unrealistic score jumps (more than 200% increase in a short time)
      const timeDiff = (now - lastSubmission.timestamp) / 1000; // in seconds
      const scoreDiff = scoreAmount - lastSubmission.score;
      
      if (timeDiff < 60 && scoreDiff > 0) { // Within 1 minute
        const scoreIncreaseRate = scoreDiff / timeDiff;
        if (scoreIncreaseRate > 500) { // More than 500 points per second increase
          console.warn(`Suspicious score jump detected from ${playerId}: ${lastSubmission.score} -> ${scoreAmount} in ${timeDiff}s`);
          clientBehavior.suspiciousPatterns.push('score_jump');
          return createAuthenticatedResponse(
            { error: "Suspicious score increase detected." },
            400
          );
        }
      }
    }
    
    // Store this submission for future validation
    recentSubmissions.set(playerId, {
      timestamp: now,
      score: scoreAmount,
      transactions: transactionAmount
    });
    
    // Clean up old submissions (older than 10 minutes)
    for (const [key, value] of recentSubmissions.entries()) {
      if (now - value.timestamp > 600000) { // 10 minutes
        recentSubmissions.delete(key);
      }
    }

    // Request deduplication
    const requestId = generateRequestId(
      playerAddress,
      scoreAmount,
      transactionAmount
    );
    if (isDuplicateRequest(requestId)) {
      clientBehavior.suspiciousPatterns.push('duplicate_request');
      return createAuthenticatedResponse(
        { error: "Duplicate request detected. Please wait before retrying." },
        409
      );
    }

    markRequestProcessing(requestId);

    // Get private key from environment variable
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      console.error("WALLET_PRIVATE_KEY environment variable not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Create account from private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    // Create wallet client
    const ALCHEMY_RPC_URLS = [
      process.env.ALCHEMY_RPC_URL,
      process.env.ALCHEMY_RPC_URL_2,
      process.env.ALCHEMY_RPC_URL_3,
      process.env.ALCHEMY_RPC_URL_4,
      process.env.ALCHEMY_RPC_URL_5,
    ].filter(Boolean);

    // Fallback to default RPC URL if none are configured
    if (ALCHEMY_RPC_URLS.length === 0) {
      ALCHEMY_RPC_URLS.push('https://monad-testnet.g.alchemy.com/v2/L4mvj1NkUhphM3YY14DPO');
    }

    const selectedUrl = ALCHEMY_RPC_URLS[currentUrlIndex % ALCHEMY_RPC_URLS.length];
    const usedIndex = currentUrlIndex % ALCHEMY_RPC_URLS.length;
    currentUrlIndex = (currentUrlIndex + 1) % ALCHEMY_RPC_URLS.length;

    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(selectedUrl),
    });

    console.log(`Using RPC URL index: ${usedIndex}`);
    const urlDomain = selectedUrl ? new URL(selectedUrl).hostname : 'unknown';
    console.log(`RPC Domain: ${urlDomain}`);

    // Anti-cheat: Add additional validation to prevent console manipulation
    // Check for suspicious patterns that indicate manual request manipulation
    const userAgent = request.headers.get('user-agent') || '';
    
    // Block requests that look like they're from automated tools or manual manipulation
    if (userAgent.includes('Postman') || 
        userAgent.includes('curl') || 
        userAgent.includes('wget')) {
      console.warn(`Blocked suspicious request from ${clientIp}: ${userAgent}`);
      clientBehavior.suspiciousPatterns.push('automated_tool');
      return createAuthenticatedResponse(
        { error: "Forbidden: Suspicious request detected" },
        403
      );
    }

    // More lenient validation - allow requests even if they don't have all browser headers
    // This prevents legitimate players from being flagged as suspicious
    const hasValidBrowserHeaders = userAgent.includes('Mozilla') || 
                                  userAgent.includes('Chrome') || 
                                  userAgent.includes('Firefox') || 
                                  userAgent.includes('Safari') ||
                                  userAgent.includes('WebKit') ||
                                  !userAgent; // Allow empty user agent in development
    
    // Only validate browser headers in production and only warn (don't block) if they're missing
    if (process.env.NODE_ENV === 'production' && !hasValidBrowserHeaders) {
      console.warn(`Suspicious request detected from ${clientIp}: ${userAgent}, but allowing it for now`);
      clientBehavior.suspiciousPatterns.push('missing_headers');
      // Don't block the request, just log it
    }

    // If too many suspicious patterns detected, reject the request
    if (clientBehavior.suspiciousPatterns.length > 3) {
      console.warn(`Too many suspicious patterns detected from ${clientId}:`, clientBehavior.suspiciousPatterns);
      return createAuthenticatedResponse(
        { error: "Suspicious activity detected. Request blocked for security reasons." },
        403
      );
    }

    // Call the updatePlayerData function
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "updatePlayerData",
      args: [
        {
          player: playerAddress as `0x${string}`,
          score: BigInt(scoreAmount),
          transactions: BigInt(transactionAmount),
        }
      ],
    });

    markRequestComplete(requestId);

    return createAuthenticatedResponse({
      success: true,
      transactionHash: hash,
      message: "Player data updated successfully",
    });
  } catch (error) {
    console.error("Error updating player data:", error);

    // Handle specific viem errors
    if (error instanceof Error) {
      if (error.message.includes("insufficient funds")) {
        return createAuthenticatedResponse(
          { error: "Insufficient funds to complete transaction" },
          400
        );
      }
      if (error.message.includes("execution reverted")) {
        return createAuthenticatedResponse(
          {
            error:
              "Contract execution failed - check if wallet has GAME_ROLE permission",
          },
          400
        );
      }
      if (error.message.includes("AccessControlUnauthorizedAccount")) {
        return createAuthenticatedResponse(
          { error: "Unauthorized: Wallet does not have GAME_ROLE permission" },
          403
        );
      }
    }

    return createAuthenticatedResponse(
      { error: "Failed to update player data" },
      500
    );
  }
}