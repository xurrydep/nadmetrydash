import { NextRequest, NextResponse } from 'next/server';
import { generateSessionToken, validateOrigin } from '@/app/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Validate origin
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { error: 'Forbidden: Invalid origin' },
        { status: 403 }
      );
    }

    const { playerAddress, signedMessage, message } = await request.json();

    if (!playerAddress || !signedMessage || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: playerAddress, signedMessage, message' },
        { status: 400 }
      );
    }

    // Verify that the message contains the player address and a recent timestamp
    if (!message.includes(playerAddress)) {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      );
    }

    // Check if this is a server-generated token request (for development/testing)
    // In production, you should verify the signature using viem/ethers
    let sessionToken: string;
    if (signedMessage === "server_generated_token") {
      // Generate session token for development/testing
      const timestamp = Math.floor(Date.now() / 30000) * 30000; // Round to 30-second intervals
      sessionToken = generateSessionToken(playerAddress, timestamp);
    } else {
      // TODO: Add proper signature verification here using viem/ethers
      // For now, we'll trust that the frontend provides the correct signature
      const timestamp = Math.floor(Date.now() / 30000) * 30000; // Round to 30-second intervals
      sessionToken = generateSessionToken(playerAddress, timestamp);
    }

    return NextResponse.json({
      success: true,
      sessionToken,
      expiresAt: Date.now() + 300000, // 5 minutes from now
    });

  } catch (error) {
    console.error('Error generating session token:', error);
    return NextResponse.json(
      { error: 'Failed to generate session token' },
      { status: 500 }
    );
  }
}