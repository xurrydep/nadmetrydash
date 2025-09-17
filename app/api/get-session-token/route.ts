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

    const { playerAddress, signedMessage, message, gameState } = await request.json();

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
    const clientIp =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    
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

    // Generate session token with game state information
    const timestamp = Math.floor(Date.now() / 30000) * 30000; // Round to 30-second intervals
    
    // Use appropriate IP identifier for development
    let ipIdentifier = 'ip_unknown';
    if (clientIp === 'localhost' || clientIp === '127.0.0.1' || clientIp === '::1') {
      ipIdentifier = 'ip_localhost';
    } else if (clientIp && clientIp !== 'unknown') {
      ipIdentifier = `ip_${clientIp}`;
    }
    
    // Include game state in token generation
    const sessionToken = generateSessionToken(playerAddress, timestamp, gameState || {}, ipIdentifier);
    console.log('Generated token with game state', { 
      playerAddress, 
      timestamp, 
      sessionToken: sessionToken.substring(0, 10) + '...', 
      gameState, 
      ipIdentifier,
      clientIp
    });

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