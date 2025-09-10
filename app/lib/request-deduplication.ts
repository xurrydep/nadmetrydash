// Request deduplication with timeout handling
const pendingRequests = new Map<string, { timestamp: number; processing: boolean }>();
const REQUEST_TIMEOUT = 45000; // 45 seconds timeout (increased from 30)

// Generate a unique request ID based on player address and data
export function generateRequestId(playerAddress: string, scoreAmount: number, transactionAmount: number): string {
  return `${playerAddress}-${scoreAmount}-${transactionAmount}`;
}

// Check if request is a duplicate
export function isDuplicateRequest(requestId: string): boolean {
  const request = pendingRequests.get(requestId);
  
  // Clean up old requests
  cleanupOldRequests();
  
  // If request exists and is still processing, it's a duplicate
  if (request && request.processing) {
    // Check if the request has timed out
    if (Date.now() - request.timestamp > REQUEST_TIMEOUT) {
      // Request has timed out, remove it and allow retry
      pendingRequests.delete(requestId);
      console.log(`Request timeout for ${requestId}, allowing retry`);
      return false;
    }
    console.log(`Duplicate request detected for ${requestId}`);
    return true;
  }
  
  // If request exists but is not processing, it might be stuck
  if (request && !request.processing) {
    // If it's been too long, remove it and allow retry
    if (Date.now() - request.timestamp > REQUEST_TIMEOUT) {
      pendingRequests.delete(requestId);
      console.log(`Stuck request removed for ${requestId}, allowing retry`);
      return false;
    }
    // Otherwise, mark it as processing and continue
    pendingRequests.set(requestId, { timestamp: Date.now(), processing: true });
    console.log(`Marking stuck request as processing for ${requestId}`);
    return false;
  }
  
  // New request, add it to the map
  pendingRequests.set(requestId, { timestamp: Date.now(), processing: true });
  console.log(`New request added for ${requestId}`);
  return false;
}

// Mark request as processing
export function markRequestProcessing(requestId: string): void {
  const request = pendingRequests.get(requestId);
  if (request) {
    pendingRequests.set(requestId, { ...request, processing: true });
  } else {
    pendingRequests.set(requestId, { timestamp: Date.now(), processing: true });
  }
  console.log(`Request marked as processing for ${requestId}`);
}

// Mark request as complete (remove from map)
export function markRequestComplete(requestId: string): void {
  pendingRequests.delete(requestId);
  console.log(`Request completed and removed for ${requestId}`);
}

// Clean up old requests that have been pending for too long
function cleanupOldRequests(): void {
  const now = Date.now();
  let cleanedCount = 0;
  for (const [requestId, request] of pendingRequests.entries()) {
    if (now - request.timestamp > REQUEST_TIMEOUT) {
      pendingRequests.delete(requestId);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} old requests`);
  }
}

// Get pending requests count (for debugging)
export function getPendingRequestsCount(): number {
  cleanupOldRequests();
  return pendingRequests.size;
}

// Force clear all requests (for debugging)
export function clearAllRequests(): void {
  const count = pendingRequests.size;
  pendingRequests.clear();
  console.log(`Cleared all ${count} pending requests`);
}