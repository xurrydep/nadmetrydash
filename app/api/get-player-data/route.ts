import { NextRequest, NextResponse } from 'next/server';
import { getPlayerData, isValidAddress } from '@/app/lib/blockchain';

export async function GET(request: NextRequest) {
  try {
    // Get player address from URL search params
    const { searchParams } = new URL(request.url);
    const playerAddress = searchParams.get('address');

    if (!playerAddress) {
      return NextResponse.json(
        { error: 'Player address is required' },
        { status: 400 }
      );
    }

    if (!isValidAddress(playerAddress)) {
      return NextResponse.json(
        { error: 'Invalid player address format' },
        { status: 400 }
      );
    }

    const playerData = await getPlayerData(playerAddress);

    return NextResponse.json({
      success: true,
      playerAddress,
      totalScore: playerData.totalScore.toString(),
      totalTransactions: playerData.totalTransactions.toString()
    });

  } catch (error) {
    console.error('Error getting player data:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid chain')) {
        return NextResponse.json(
          { error: 'Invalid blockchain chain configuration.' },
          { status: 500 }
        );
      }
      if (error.message.includes('Invalid address')) {
        return NextResponse.json(
          { error: 'Invalid contract address. Please check contract configuration.' },
          { status: 500 }
        );
      }
      // Handle RPC connection errors
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Failed to connect to blockchain RPC. Please check your RPC configuration.' },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to get player data: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { playerAddress } = await request.json();

    if (!playerAddress) {
      return NextResponse.json(
        { error: 'Player address is required' },
        { status: 400 }
      );
    }

    if (!isValidAddress(playerAddress)) {
      return NextResponse.json(
        { error: 'Invalid player address format' },
        { status: 400 }
      );
    }

    const playerData = await getPlayerData(playerAddress);

    return NextResponse.json({
      success: true,
      playerAddress,
      totalScore: playerData.totalScore.toString(),
      totalTransactions: playerData.totalTransactions.toString()
    });

  } catch (error) {
    console.error('Error getting player data:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid chain')) {
        return NextResponse.json(
          { error: 'Invalid blockchain chain configuration.' },
          { status: 500 }
        );
      }
      if (error.message.includes('Invalid address')) {
        return NextResponse.json(
          { error: 'Invalid contract address. Please check contract configuration.' },
          { status: 500 }
        );
      }
      // Handle RPC connection errors
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Failed to connect to blockchain RPC. Please check your RPC configuration.' },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to get player data: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}