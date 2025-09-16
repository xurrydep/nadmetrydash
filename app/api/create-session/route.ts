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
    
    // Even if Redis is not available, we still return a session ID to allow gameplay
    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Session created successfully'
    });

  } catch (error) {
    console.error('Error creating session:', error);
    // Even if there's an error, we still allow gameplay by returning a dummy session ID
    const dummySessionId = 'dummy-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    return NextResponse.json({
      success: true,
      sessionId: dummySessionId,
      message: 'Session created with limited functionality'
    }, { status: 200 });
  }
}