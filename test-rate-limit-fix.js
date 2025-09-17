// Test script to verify the rate limit fix
const fetch = require('node-fetch');

async function testRateLimitFix() {
  console.log('Testing rate limit fix...');
  
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
        gameState: { level: 1, score: 100, gameId: 'test-game' }
      }),
    });
    
    const tokenResult = await tokenResponse.json();
    console.log('Token response:', tokenResult);
    
    if (tokenResult.success) {
      const sessionToken = tokenResult.sessionToken;
      
      // Test 2: Submit multiple scores to test rate limiting
      console.log('\n2. Testing score submissions...');
      
      for (let i = 1; i <= 6; i++) {
        console.log(`\n--- Submission ${i} ---`);
        const scoreAmount = 100 * i;
        
        const scoreResponse = await fetch('http://localhost:3001/api/update-player-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerAddress,
            scoreAmount,
            transactionAmount: 1,
            sessionToken,
            gameState: { level: 1, score: scoreAmount }
          }),
        });
        
        const scoreResult = await scoreResponse.json();
        console.log(`Score ${scoreAmount} submission response:`, scoreResult);
        
        // Check the response status
        if (scoreResponse.status === 429) {
          console.log(`✅ Rate limit correctly applied for submission ${i}`);
        } else if (scoreResponse.status === 401) {
          console.log(`❌ FAILED: Still getting 401 Unauthorized error for submission ${i}`);
        } else {
          console.log(`✅ SUCCESS: Submission ${i} processed (status: ${scoreResponse.status})`);
        }
      }
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log('\nTest completed.');
}

testRateLimitFix();