// Test script to verify backend score validation and duplication prevention
const fetch = require('node-fetch');

async function testBackendValidation() {
  console.log('Testing backend score validation and duplication prevention...');
  
  const playerAddress = '0x742d35Cc6634C0532925a3b8D91D0a74b4A3fA3D'; // Test address
  const scoreAmount = 500;
  const transactionAmount = 1;
  
  // Generate a proper session token first
  console.log('\n1. Generating session token...');
  try {
    const tokenResponse = await fetch('http://localhost:3000/api/get-session-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerAddress,
        message: `Authenticate for score submission: ${playerAddress} at ${new Date().toISOString()}`,
        signedMessage: `server_generated_token_${Date.now()}`,
        gameState: { level: 1, score: scoreAmount, gameId: 'test-game' }
      }),
    });
    
    const tokenResult = await tokenResponse.json();
    console.log('Token response:', tokenResult);
    
    if (tokenResult.success) {
      const sessionToken = tokenResult.sessionToken;
      
      // Test valid score submission
      console.log('\n2. Testing valid score submission...');
      try {
        const response = await fetch('http://localhost:3000/api/update-player-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerAddress,
            scoreAmount,
            transactionAmount,
            sessionToken,
            gameState: { level: 1, score: scoreAmount },
            gameStateHash: Buffer.from(JSON.stringify({
              player: { x: 100, y: 100 },
              score: scoreAmount,
              timestamp: Date.now()
            })).toString('base64')
          }),
        });
        
        const result = await response.json();
        console.log('Valid submission response:', result);
      } catch (error) {
        console.log('Error:', error.message);
      }
      
      // Test invalid score (too high)
      console.log('\n3. Testing invalid score (too high)...');
      try {
        const response = await fetch('http://localhost:3000/api/update-player-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerAddress,
            scoreAmount: 1500, // Too high
            transactionAmount,
            sessionToken,
            gameState: { level: 1, score: 1500 }
          }),
        });
        
        const result = await response.json();
        console.log('High score response:', result);
      } catch (error) {
        console.log('Error:', error.message);
      }
      
      // Test invalid score progression speed
      console.log('\n4. Testing invalid score progression speed...');
      try {
        const response = await fetch('http://localhost:3000/api/update-player-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerAddress,
            scoreAmount: 1000,
            transactionAmount: 1,
            sessionToken,
            gameState: { level: 1, score: 1000 }
          }),
        });
        
        const result = await response.json();
        console.log('Fast progression response:', result);
      } catch (error) {
        console.log('Error:', error.message);
      }
      
      // Test duplicate submission
      console.log('\n5. Testing duplicate submission...');
      try {
        // First submission
        const gameStateHash = Buffer.from(JSON.stringify({
          player: { x: 100, y: 100 },
          score: 300,
          timestamp: Date.now()
        })).toString('base64');
        
        const response1 = await fetch('http://localhost:3000/api/update-player-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerAddress,
            scoreAmount: 300,
            transactionAmount,
            sessionToken,
            gameState: { level: 1, score: 300 },
            gameStateHash
          }),
        });
        
        const result1 = await response1.json();
        console.log('First submission response:', result1);
        
        // Second submission (should be detected as duplicate)
        const response2 = await fetch('http://localhost:3000/api/update-player-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerAddress,
            scoreAmount: 300,
            transactionAmount,
            sessionToken,
            gameState: { level: 1, score: 300 },
            gameStateHash
          }),
        });
        
        const result2 = await response2.json();
        console.log('Duplicate submission response:', result2);
      } catch (error) {
        console.log('Error:', error.message);
      }
    }
  } catch (error) {
    console.log('Error generating session token:', error.message);
  }
  
  console.log('\nTest completed.');
}

testBackendValidation();