// Test script to verify the validation functions directly
const { validateScoreSubmission, isDuplicateScoreSubmission } = require('./app/lib/rate-limiter');

function testScoreValidation() {
  console.log('Testing score validation functions...');
  
  const playerAddress = '0x742d35Cc6634C0532925a3b8D91D0a74b4A3fA3D';
  
  // Test 1: Valid score submission
  console.log('\n1. Testing valid score submission...');
  const result1 = validateScoreSubmission(playerAddress, 500, 1, { level: 1, score: 500 });
  console.log('Valid submission:', result1);
  
  // Test 2: Invalid score (negative)
  console.log('\n2. Testing invalid score (negative)...');
  const result2 = validateScoreSubmission(playerAddress, -100, 1);
  console.log('Negative score:', result2);
  
  // Test 3: Invalid score (too high)
  console.log('\n3. Testing invalid score (too high)...');
  const result3 = validateScoreSubmission(playerAddress, 1500, 1);
  console.log('High score:', result3);
  
  // Test 4: Invalid score progression speed
  console.log('\n4. Testing invalid score progression speed...');
  const result4 = validateScoreSubmission(playerAddress, 1000, 1);
  console.log('Fast progression:', result4);
  
  // Test 5: Score mismatch with game state
  console.log('\n5. Testing score mismatch with game state...');
  const result5 = validateScoreSubmission(playerAddress, 500, 1, { level: 1, score: 300 });
  console.log('Score mismatch:', result5);
  
  // Test 6: Valid score for level
  console.log('\n6. Testing valid score for level...');
  const result6 = validateScoreSubmission(playerAddress, 800, 1, { level: 1, score: 800 });
  console.log('Valid for level:', result6);
  
  // Test 7: Score too high for level
  console.log('\n7. Testing score too high for level...');
  const result7 = validateScoreSubmission(playerAddress, 2000, 1, { level: 1, score: 2000 });
  console.log('Too high for level:', result7);
  
  console.log('\nScore validation tests completed.');
}

function testDuplicateDetection() {
  console.log('\n\nTesting duplicate score submission detection...');
  
  const playerAddress = '0x742d35Cc6634C0532925a3b8D91D0a74b4A3fA3D';
  const scoreAmount = 500;
  const gameStateHash = 'test-hash-123';
  
  // Test 1: First submission (should not be duplicate)
  console.log('\n1. Testing first submission...');
  const result1 = isDuplicateScoreSubmission(playerAddress, scoreAmount, gameStateHash);
  console.log('First submission duplicate:', result1);
  
  // Test 2: Immediate duplicate submission (should be detected as duplicate)
  console.log('\n2. Testing immediate duplicate submission...');
  const result2 = isDuplicateScoreSubmission(playerAddress, scoreAmount, gameStateHash);
  console.log('Immediate duplicate:', result2);
  
  // Test 3: Different score (should not be duplicate)
  console.log('\n3. Testing different score...');
  const result3 = isDuplicateScoreSubmission(playerAddress, 600, gameStateHash);
  console.log('Different score duplicate:', result3);
  
  // Test 4: Different game state hash (should not be duplicate)
  console.log('\n4. Testing different game state hash...');
  const result4 = isDuplicateScoreSubmission(playerAddress, scoreAmount, 'different-hash-456');
  console.log('Different hash duplicate:', result4);
  
  console.log('\nDuplicate detection tests completed.');
}

// Run tests
testScoreValidation();
testDuplicateDetection();