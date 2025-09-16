import { NextRequest, NextResponse } from 'next/server';
import { updateGameState, getSession } from '@/app/lib/sessions';
import { validateOrigin } from '@/app/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Validate origin
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { error: 'Forbidden: Invalid origin' },
        { status: 403 }
      );
    }

    const { sessionId, gameState } = await request.json();

    if (!sessionId || !gameState) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, gameState' },
        { status: 400 }
      );
    }

    // Try to update game state in session
    // If Redis is not available, we still return success to avoid breaking the game
    const success = await updateGameState(sessionId, gameState);
    
    // Even if we couldn't update the session, we return success to keep the game running
    return NextResponse.json({
      success: true,
      message: 'Game state update processed'
    });

  } catch (error) {
    console.error('Error updating game state:', error);
    // Even if there's an error, we return success to keep the game running
    return NextResponse.json({
      success: true,
      message: 'Game state update processed with warnings'
    }, { status: 200 });
  }
}