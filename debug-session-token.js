// Debug script to test session token generation and validation
const crypto = require('crypto');

// Simulate the server-side functions
function getServerApiSecret() {
  // This should match your API_SECRET in .env.local
  return process.env.API_SECRET || 'your_api_secret_here';
}

function generateSessionToken(playerAddress, timestamp) {
  const data = `${playerAddress}-${timestamp}-${getServerApiSecret()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

function validateSessionToken(token, playerAddress, timestampWindow = 300000) {
  const now = Date.now();
  
  // Check tokens within the timestamp window (default 5 minutes)
  for (let i = 0; i < timestampWindow; i += 30000) { // Check every 30 seconds
    const timestamp = now - i;
    const expectedToken = generateSessionToken(playerAddress, Math.floor(timestamp / 30000) * 30000);
    if (token === expectedToken) {
      return true;
    }
  }
  
  return false;
}

// Test with sample data
const playerAddress = "0x1234567890123456789012345678901234567890";
const timestamp = Math.floor(Date.now() / 30000) * 30000;
const sessionToken = generateSessionToken(playerAddress, timestamp);

console.log("Player Address:", playerAddress);
console.log("Timestamp:", timestamp);
console.log("Generated Token:", sessionToken);
console.log("Validation Result:", validateSessionToken(sessionToken, playerAddress));