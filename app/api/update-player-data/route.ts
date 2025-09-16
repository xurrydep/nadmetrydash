import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http } from 'viem';
import { monadTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { CONTRACT_ADDRESS, CONTRACT_ABI, isValidAddress, publicClient } from '@/app/lib/blockchain';
import { validateSessionToken, validateOrigin, createAuthenticatedResponse } from '@/app/lib/auth';
import { rateLimit } from '@/app/lib/rate-limiter';
import { generateRequestId, isDuplicateRequest, markRequestProcessing, markRequestComplete } from '@/app/lib/request-deduplication';

export async function POST(request: NextRequest) {
  try {
    console.log('Update player data request received');
    
    // Security checks - Origin validation first
    if (!validateOrigin(request)) {
      console.log('Origin validation failed');
      return createAuthenticatedResponse({ error: 'Forbidden: Invalid origin' }, 403);
    }

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = rateLimit(clientIp, { maxRequests: 10, windowMs: 60000 }); // 10 requests per minute
    
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      return createAuthenticatedResponse({
        error: 'Too many requests',
        resetTime: rateLimitResult.resetTime
      }, 429);
    }

    // Parse request body
    const { playerAddress, scoreAmount, transactionAmount, sessionToken } = await request.json();
    console.log(`Processing request for player ${playerAddress} with score ${scoreAmount} and transactions ${transactionAmount}`);

    // Session token authentication - verify the user controls the wallet
    if (!sessionToken || !validateSessionToken(sessionToken, playerAddress)) {
      console.log('Session token validation failed');
      return createAuthenticatedResponse({ error: 'Unauthorized: Invalid or expired session token' }, 401);
    }

    // Validate input
    if (!playerAddress || scoreAmount === undefined || transactionAmount === undefined) {
      console.log('Missing required fields');
      return createAuthenticatedResponse(
        { error: 'Missing required fields: playerAddress, scoreAmount, transactionAmount' },
        400
      );
    }

    // Validate player address format
    if (!isValidAddress(playerAddress)) {
      console.log('Invalid player address format');
      return createAuthenticatedResponse(
        { error: 'Invalid player address format' },
        400
      );
    }

    // Validate that scoreAmount and transactionAmount are positive numbers
    if (scoreAmount < 0 || transactionAmount < 0) {
      console.log('Negative score or transaction amounts');
      return createAuthenticatedResponse(
        { error: 'Score and transaction amounts must be non-negative' },
        400
      );
    }

    // Maximum limits to prevent abuse - made more restrictive
    const MAX_SCORE_PER_REQUEST = 1000; // Reduced from 10000
    const MAX_TRANSACTIONS_PER_REQUEST = 10; // Reduced from 100
    
    // Additional validation: reasonable score ranges
    const MIN_SCORE_PER_REQUEST = 1;
    const MAX_SCORE_PER_TRANSACTION = 10000; // Max 10000 points per transaction

    if (scoreAmount > MAX_SCORE_PER_REQUEST || transactionAmount > MAX_TRANSACTIONS_PER_REQUEST) {
      console.log('Score or transaction amounts too large');
      return createAuthenticatedResponse(
        { error: `Amounts too large. Max score: ${MAX_SCORE_PER_REQUEST}, Max transactions: ${MAX_TRANSACTIONS_PER_REQUEST}` },
        400
      );
    }

    if (scoreAmount < MIN_SCORE_PER_REQUEST && scoreAmount !== 0) {
      console.log('Score amount too small');
      return createAuthenticatedResponse(
        { error: `Score amount too small. Minimum: ${MIN_SCORE_PER_REQUEST}` },
        400
      );
    }

    // Validate score-to-transaction ratio to prevent unrealistic scores
    if (transactionAmount > 0 && (scoreAmount / transactionAmount) > MAX_SCORE_PER_TRANSACTION) {
      console.log('Score per transaction ratio too high');
      return createAuthenticatedResponse(
        { error: `Score per transaction too high. Maximum: ${MAX_SCORE_PER_TRANSACTION} points per transaction` },
        400
      );
    }

    // Request deduplication
    const requestId = generateRequestId(playerAddress, scoreAmount, transactionAmount);
    if (isDuplicateRequest(requestId)) {
      console.log(`Duplicate request detected: ${requestId}`);
      return createAuthenticatedResponse(
        { error: 'Duplicate request detected. Please wait before retrying.' },
        409
      );
    }

    markRequestProcessing(requestId);

    // Get private key from environment variable
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      console.error('WALLET_PRIVATE_KEY environment variable not set');
      return createAuthenticatedResponse(
        { error: 'Server configuration error: WALLET_PRIVATE_KEY not set' },
        500
      );
    }

    // Validate private key format
    if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
      console.error('Invalid WALLET_PRIVATE_KEY format');
      return createAuthenticatedResponse(
        { error: 'Server configuration error: Invalid WALLET_PRIVATE_KEY format' },
        500
      );
    }

    // Check if API_SECRET is set
    if (!process.env.API_SECRET) {
      console.error('API_SECRET environment variable not set');
      return createAuthenticatedResponse(
        { error: 'Server configuration error: API_SECRET not set' },
        500
      );
    }

    // Create account from private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    // Log the server wallet address for debugging
    console.log('Server wallet address:', account.address);

    // Create wallet client
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || undefined)
    });

    // Validate RPC connection by getting block number
    try {
      const blockNumber = await publicClient.getBlockNumber();
      console.log('RPC connection successful. Current block number:', blockNumber);
    } catch (rpcError) {
      console.error('RPC connection failed:', rpcError);
      return createAuthenticatedResponse(
        { error: 'Failed to connect to blockchain RPC. Please check your RPC configuration.' },
        500
      );
    }
    
    // Check wallet balance and warn if it's low
    try {
      const balance = await publicClient.getBalance({ address: account.address });
      const balanceInEther = Number(balance) / 10**18;
      console.log(`Server wallet (${account.address}) balance: ${balanceInEther} MON`);
      
      // If balance is below 0.01 MON, reject the transaction
      if (balanceInEther < 0.01) {
        console.warn(`Server wallet balance is critically low: ${balanceInEther} MON. Transaction rejected.`);
        return createAuthenticatedResponse(
          { 
            error: `SERVER WALLET ISSUE: The server wallet (controlled by the application) has insufficient MON tokens for gas fees. Current balance: ${balanceInEther.toFixed(6)} MON. Please fund the server wallet (address: ${account.address}) with at least 0.1 MON. This is DIFFERENT from your personal wallet. Visit https://faucet.monad.ai/ to get test tokens.` 
          },
          400
        );
      }
      // Warn if balance is below 0.05 MON
      else if (balanceInEther < 0.05) {
        console.warn(`Server wallet balance is low: ${balanceInEther} MON. Please add more funds soon.`);
      }
    } catch (balanceError) {
      console.warn('Could not check wallet balance:', balanceError);
    }

    // Call the updatePlayerData function
    console.log(`Calling updatePlayerData for player ${playerAddress} with score ${scoreAmount} and transactions ${transactionAmount}`);
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'updatePlayerData',
      args: [{
        player: playerAddress as `0x${string}`,
        score: BigInt(scoreAmount),
        transactions: BigInt(transactionAmount)
      }]
    });
    console.log(`Transaction successful with hash: ${hash}`);

    markRequestComplete(requestId);

    return createAuthenticatedResponse({
      success: true,
      transactionHash: hash,
      message: 'Player data updated successfully'
    });

  } catch (error) {
    console.error('Error updating player data:', error);
    
    // Handle specific viem errors
    if (error instanceof Error) {
      if (error.message.includes('insufficient funds') || error.message.includes('insufficient balance')) {
        return createAuthenticatedResponse(
          { error: 'Server wallet has insufficient MON tokens for gas fees. Please fund the server wallet.' },
          400
        );
      }
      if (error.message.includes('execution reverted')) {
        return createAuthenticatedResponse(
          { error: 'Contract execution failed - check if wallet has GAME_ROLE permission' },
          400
        );
      }
      if (error.message.includes('AccessControlUnauthorizedAccount')) {
        return createAuthenticatedResponse(
          { error: 'Unauthorized: Wallet does not have GAME_ROLE permission' },
          403
        );
      }
      // Handle RPC connection errors
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        return createAuthenticatedResponse(
          { error: 'Failed to connect to blockchain RPC. Please check your RPC configuration.' },
          500
        );
      }
      // Handle invalid chain errors
      if (error.message.includes('Invalid chain')) {
        return createAuthenticatedResponse(
          { error: 'Invalid blockchain chain configuration.' },
          500
        );
      }
      // Handle contract address errors
      if (error.message.includes('Invalid address')) {
        return createAuthenticatedResponse(
          { error: 'Invalid contract address. Please check contract configuration.' },
          500
        );
      }
    }

    return createAuthenticatedResponse(
      { error: 'Failed to update player data: ' + (error instanceof Error ? error.message : 'Unknown error') },
      500
    );
  }
}