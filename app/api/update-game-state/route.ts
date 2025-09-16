import { NextRequest, NextResponse } from 'next/server';
import { updateGameState } from '@/app/lib/sessions';
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

    // Update game state in session
    const success = await updateGameState(sessionId, gameState);
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Game state updated successfully'
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to update game state' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error updating game state:', error);
    return NextResponse.json(
      { error: 'Failed to update game state' },
      { status: 500 }
    );
  }
}