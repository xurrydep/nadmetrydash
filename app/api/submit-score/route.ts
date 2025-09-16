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

    // Validate required fields
    if (score === undefined || sessionId === undefined || hash === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, score, hash' },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    // Verify score hash
    const isValidHash = await verifyScoreHash(sessionId, score, hash, additionalData);
    if (!isValidHash) {
      return NextResponse.json(
        { error: 'Invalid score hash - possible tampering detected' },
        { status: 400 }
      );
    }

    // Submit score to blockchain
    const result = await submitPlayerScore(
      session.playerAddress,
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