// Test script to verify the session token fix
const fetch = require('node-fetch');

async function testSessionTokenFix() {
  console.log('Testing session token fix...');
  
  const playerAddress = '0x742d35Cc6634C0532925a3b8D91D0a74b4A3fA3D'; // Test address
  
  // Test 1: Generate session token
  console.log('\n1. Generating session token...');
  try {
    const tokenResponse = await fetch('http://localhost:3001/api/get-session-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerAddress,
        message: `Authenticate for score submission: ${playerAddress} at ${new Date().toISOString()}`,
        signedMessage: `server_generated_token_${Date.now()}`,
        gameState: { level: 1, score: 500, gameId: 'test-game' }
      }),
    });
    
    const tokenResult = await tokenResponse.json();
    console.log('Token response:', tokenResult);
    
    if (tokenResult.success) {
      const sessionToken = tokenResult.sessionToken;
      
      // Test 2: Use session token to update player data
      console.log('\n2. Testing session token validation...');
      const scoreResponse = await fetch('http://localhost:3001/api/update-player-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAddress,
          scoreAmount: 100,
          transactionAmount: 1,
          sessionToken,
          gameState: { level: 1, score: 100 }
        }),
      });
      
      const scoreResult = await scoreResponse.json();
      console.log('Score submission response:', scoreResult);
      
      // Check if we get a different error than 401
      if (scoreResponse.status === 401) {
        console.log('❌ FAILED: Still getting 401 Unauthorized error');
      } else {
        console.log('✅ SUCCESS: No longer getting 401 Unauthorized error');
      }
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log('\nTest completed.');
}

testSessionTokenFix();