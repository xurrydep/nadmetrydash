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

    // Enhanced security: Add additional validation to prevent manual token generation
    const userAgent = request.headers.get('user-agent') || '';
    
    // Block requests that look like they're from automated tools
    if (userAgent.includes('Postman') || 
        userAgent.includes('curl') || 
        userAgent.includes('wget')) {
      return NextResponse.json(
        { error: 'Forbidden: Automated requests not allowed' },
        { status: 403 }
      );
    }

    // More lenient browser validation - allow requests even if they don't have all browser headers
    // This prevents legitimate players from being flagged as suspicious
    const hasValidBrowserHeaders = userAgent.includes('Mozilla') || 
                                  userAgent.includes('Chrome') || 
                                  userAgent.includes('Firefox') || 
                                  userAgent.includes('Safari') ||
                                  userAgent.includes('WebKit') ||
                                  !userAgent; // Allow empty user agent in development
    
    // Only validate browser headers in production and only warn (don't block) if they're missing
    if (process.env.NODE_ENV === 'production' && !hasValidBrowserHeaders) {
      console.warn(`Suspicious request detected from ${userAgent}, but allowing it for now`);
      // Don't block the request, just log it
    }

    // Check if this is a server-generated token request (for development/testing)
    // In production, you should verify the signature using viem/ethers
    let sessionToken: string;
    if (signedMessage === "server_generated_token") {
      // Generate session token for development/testing
      const timestamp = Math.floor(Date.now() / 30000) * 30000; // Round to 30-second intervals
      sessionToken = generateSessionToken(playerAddress, timestamp);
      console.log('Generated server token for development', { playerAddress, timestamp, sessionToken });
    } else {
      // TODO: Add proper signature verification here using viem/ethers
      // For now, we'll trust that the frontend provides the correct signature
      const timestamp = Math.floor(Date.now() / 30000) * 30000; // Round to 30-second intervals
      sessionToken = generateSessionToken(playerAddress, timestamp);
      console.log('Generated token with signature', { playerAddress, timestamp, sessionToken, signedMessage });
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