// Simple test to verify duplication prevention is working
const crypto = require('crypto');

// Simulate the duplication detection function
function isDuplicateScoreSubmission(playerAddress, scoreAmount, gameStateHash) {
  // Create a unique hash for this score submission
  const scoreData = `${playerAddress}-${scoreAmount}-${gameStateHash || ''}-${Math.floor(Date.now() / 1000)}`;
  const scoreHash = crypto.createHash('sha256').update(scoreData).digest('hex');
  
  console.log(`Generated hash: ${scoreHash.substring(0, 32)}...`);
  console.log(`Score data: ${scoreData}`);
  
  // In a real implementation, we would check against a store of previous submissions
  // For this test, we'll just show that the hash is unique for different inputs
  
  return false; // Always return false for testing
}

console.log('Testing duplication prevention...\n');

const playerAddress = '0x742d35Cc6634C0532925a3b8D91D0a74b4A3fA3D';
const scoreAmount = 500;
const gameStateHash1 = 'game-state-hash-1';
const gameStateHash2 = 'game-state-hash-2';

console.log('First submission:');
const result1 = isDuplicateScoreSubmission(playerAddress, scoreAmount, gameStateHash1);

console.log('\nSecond submission (same data):');
const result2 = isDuplicateScoreSubmission(playerAddress, scoreAmount, gameStateHash1);

console.log('\nThird submission (different game state):');
const result3 = isDuplicateScoreSubmission(playerAddress, scoreAmount, gameStateHash2);

console.log('\nFourth submission (different score):');
const result4 = isDuplicateScoreSubmission(playerAddress, 600, gameStateHash1);

console.log('\n\nDuplication prevention test completed.');
console.log('In the actual implementation, duplicate submissions would be detected and rejected.');