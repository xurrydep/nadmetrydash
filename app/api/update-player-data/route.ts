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
import { rateLimit } from "@/app/lib/rate-limiter";
import {
  generateRequestId,
  isDuplicateRequest,
  markRequestProcessing,
  markRequestComplete,
} from "@/app/lib/request-deduplication";
import "dotenv/config";

// Add this line after imports
let currentUrlIndex = 0;

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
    const { playerAddress, scoreAmount, transactionAmount, sessionToken } =
      await request.json();

    // Session token authentication - verify the user controls the wallet
    if (!sessionToken || !validateSessionToken(sessionToken, playerAddress)) {
      console.warn('Session token validation failed', { sessionToken, playerAddress });
      return createAuthenticatedResponse(
        { error: "Unauthorized: Invalid or expired session token" },
        401
      );
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

    // Validate that scoreAmount and transactionAmount are positive numbers
    if (scoreAmount < 0 || transactionAmount < 0) {
      return createAuthenticatedResponse(
        { error: "Score and transaction amounts must be non-negative" },
        400
      );
    }

    // Maximum limits to prevent abuse - made more reasonable for legitimate high scores
    const MAX_SCORE_PER_REQUEST = 10000; // Increased from 2000 to allow for legitimate high scores
    const MAX_TRANSACTIONS_PER_REQUEST = 50; // Increased from 10
    const MAX_SCORE_PER_SECOND = 200; // Increased from 50 to allow for legitimate high scores

    // Additional validation: reasonable score ranges
    const MIN_SCORE_PER_REQUEST = 1;
    const MAX_SCORE_PER_TRANSACTION = 10000; // Increased from 2000

    if (
      scoreAmount > MAX_SCORE_PER_REQUEST ||
      transactionAmount > MAX_TRANSACTIONS_PER_REQUEST
    ) {
      return createAuthenticatedResponse(
        {
          error: `Amounts too large. Max score: ${MAX_SCORE_PER_REQUEST}, Max transactions: ${MAX_TRANSACTIONS_PER_REQUEST}`,
        },
        400
      );
    }

    if (scoreAmount < MIN_SCORE_PER_REQUEST && scoreAmount !== 0) {
      return createAuthenticatedResponse(
        { error: `Score amount too small. Minimum: ${MIN_SCORE_PER_REQUEST}` },
        400
      );
    }

    // Validate score-to-transaction ratio to prevent unrealistic scores
    if (
      transactionAmount > 0 &&
      scoreAmount / transactionAmount > MAX_SCORE_PER_TRANSACTION
    ) {
      return createAuthenticatedResponse(
        {
          error: `Score per transaction too high. Maximum: ${MAX_SCORE_PER_TRANSACTION} points per transaction`,
        },
        400
      );
    }

    // Anti-cheat: Validate score progression speed
    const scorePerSecond = scoreAmount / (transactionAmount || 1);
    if (scorePerSecond > MAX_SCORE_PER_SECOND) {
      console.warn(`Potential cheating detected: Score progression too fast (${scorePerSecond} points/sec)`);
      // For very high scores, we'll allow them but log for review
      // Only reject if it's clearly cheating (over 10x the limit)
      if (scorePerSecond > MAX_SCORE_PER_SECOND * 10) {
        return createAuthenticatedResponse(
          {
            error: `Score progression too fast. Maximum: ${MAX_SCORE_PER_SECOND} points per second`,
          },
          400
        );
      }
    }

    // Request deduplication
    const requestId = generateRequestId(
      playerAddress,
      scoreAmount,
      transactionAmount
    );
    if (isDuplicateRequest(requestId)) {
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
      // Don't block the request, just log it
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