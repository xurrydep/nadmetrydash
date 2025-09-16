// Utility functions for wallet management
interface WalletBalanceResponse {
  success: boolean;
  address?: string;
  balance?: number;
  error?: string;
}

// Check server wallet balance
export async function checkServerWalletBalance(): Promise<WalletBalanceResponse> {
  try {
    const response = await fetch('/api/get-wallet-balance');
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        address: data.address,
        balance: data.balance
      };
    }
    
    return {
      success: false,
      error: data.error || 'Failed to get wallet balance'
    };
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    return {
      success: false,
      error: 'Network error while checking wallet balance'
    };
  }
}

// Check if wallet has sufficient funds
export function hasSufficientFunds(balance: number, requiredAmount: number = 0.01): boolean {
  return balance >= requiredAmount;
}

// Format wallet balance for display
export function formatBalance(balance: number): string {
  return balance.toFixed(6);
}