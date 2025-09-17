// Test script to verify backend score validation and duplication prevention
const fetch = require('node-fetch');

async function testScoreValidation() {
  console.log('Testing backend score validation and duplication prevention...');
  
  const playerAddress = '0x742d35Cc6634C0532925a3b8D91D0a74b4A3fA3D'; // Test address
  const scoreAmount = 500;
  const transactionAmount = 1;
  
  // Test 1: Valid score submission
  console.log('\n1. Testing valid score submission...');
  try {
    const response1 = await fetch('http://localhost:3000/api/update-player-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerAddress,
        scoreAmount,
        transactionAmount,
        sessionToken: 'test-token', // This will fail validation but we're testing the structure
      }),
    });
    
    const result1 = await response1.json();
    console.log('Response:', result1);
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  // Test 2: Invalid score (too high)
  console.log('\n2. Testing invalid score (too high)...');
  try {
    const response2 = await fetch('http://localhost:3000/api/update-player-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerAddress,
        scoreAmount: 1500, // Too high
        transactionAmount,
        sessionToken: 'test-token',
      }),
    });
    
    const result2 = await response2.json();
    console.log('Response:', result2);
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  // Test 3: Invalid score progression speed
  console.log('\n3. Testing invalid score progression speed...');
  try {
    const response3 = await fetch('http://localhost:3000/api/update-player-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerAddress,
        scoreAmount: 1000,
        transactionAmount: 1,
        sessionToken: 'test-token',
      }),
    });
    
    const result3 = await response3.json();
    console.log('Response:', result3);
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log('\nTest completed.');
}

testScoreValidation();