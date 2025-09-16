import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/app/lib/sessions';
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

    const { playerAddress, encodedKeys } = await request.json();

    if (!playerAddress || !encodedKeys) {
      return NextResponse.json(
        { error: 'Missing required fields: playerAddress, encodedKeys' },
        { status: 400 }
      );
    }

    // Create a new session
    const sessionId = await createSession(playerAddress, encodedKeys);
    
    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Session created successfully'
    });

  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
