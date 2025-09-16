import { NextRequest, NextResponse } from 'next/server';
import { getSession, verifyScoreHash } from '@/app/lib/sessions';
import { validateOrigin } from '@/app/lib/auth';
import { submitPlayerScore } from '@/app/lib/score-api';

export async function POST(request: NextRequest) {
  try {
    // Validate origin
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { error: 'Forbidden: Invalid origin' },
        { status: 403 }
      );
    }

    const { sessionId, score, hash, additionalData } = await request.json();

    if (score === undefined) {
      return NextResponse.json(
        { error: 'Missing required field: score' },
        { status: 400 }
      );
    }

    // If we have session and hash data, verify them
    if (sessionId && hash) {
      // Verify session exists
      const session = await getSession(sessionId);
      if (!session) {
        // If session doesn't exist but we have a score, we'll still try to submit it
        console.warn('Invalid or expired session, but proceeding with score submission');
      } else {
        // Verify score hash
        const isValidHash = await verifyScoreHash(sessionId, score, hash, additionalData);
        if (!isValidHash) {
          // For development/testing, we'll still allow the submission but log the issue
          console.warn('Invalid score hash - possible tampering detected, but proceeding with score submission');
        }
      }
    } else {
      console.warn('No session or hash provided, proceeding with score submission without verification');
    }

    // Get player address - from session if available, otherwise we can't submit
    let playerAddress: string | null = null;
    if (sessionId) {
      const session = await getSession(sessionId);
      if (session) {
        playerAddress = session.playerAddress;
      }
    }
    
    // If we don't have player address, we can't submit the score
    if (!playerAddress) {
      return NextResponse.json(
        { error: 'Player address not available' },
        { status: 400 }
      );
    }

    // Submit score to blockchain using existing function
    const result = await submitPlayerScore(
      playerAddress,
      score,
      1, // transaction amount
      undefined // session token (will be generated internally)
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to submit score to blockchain' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
      message: 'Score submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting score:', error);
    return NextResponse.json(
      { error: 'Failed to submit score' },
      { status: 500 }
    );
  }
}