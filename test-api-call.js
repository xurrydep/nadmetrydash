// Test script to call the update-player-data API endpoint directly
const fetch = require('node-fetch');

async function testApiCall() {
  try {
    // First get a session token
    const sessionResponse = await fetch('https://nadmetrydash.vercel.app/api/get-session-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerAddress: '0x1234567890123456789012345678901234567890',
        message: 'Authenticate for score submission: 0x1234567890123456789012345678901234567890',
        signedMessage: 'server_generated_token'
      })
    });

    const sessionData = await sessionResponse.json();
    console.log('Session token response:', sessionData);

    if (!sessionData.success) {
      console.log('Failed to get session token');
      return;
    }

    // Now try to update player data
    const updateResponse = await fetch('https://nadmetrydash.vercel.app/api/update-player-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerAddress: '0x1234567890123456789012345678901234567890',
        scoreAmount: 100,
        transactionAmount: 1,
        sessionToken: sessionData.sessionToken
      })
    });

    console.log('Update player data response status:', updateResponse.status);
    const updateData = await updateResponse.json();
    console.log('Update player data response:', updateData);

  } catch (error) {
    console.error('Error:', error);
  }
}

testApiCall();