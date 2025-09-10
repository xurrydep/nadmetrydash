import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { publicClient } from '@/app/lib/blockchain';

export async function GET(request: NextRequest) {
  try {
    // Get private key from environment variable
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: 'Server configuration error: WALLET_PRIVATE_KEY not set' },
        { status: 500 }
      );
    }

    // Validate private key format
    if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
      return NextResponse.json(
        { error: 'Server configuration error: Invalid WALLET_PRIVATE_KEY format' },
        { status: 500 }
      );
    }

    // Create account from private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    // Get wallet balance
    const balance = await publicClient.getBalance({ address: account.address });
    const balanceInEther = Number(balance) / 10**18;

    return NextResponse.json({
      success: true,
      address: account.address,
      balance: balanceInEther,
      balanceInWei: balance.toString(),
      message: `Server wallet balance: ${balanceInEther} MON`
    });

  } catch (error) {
    console.error('Error getting wallet balance:', error);
    return NextResponse.json(
      { error: 'Failed to get wallet balance: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}