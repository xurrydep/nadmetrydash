# Server Wallet Setup Guide

## Problem Description

Players cannot save their scores because the server wallet doesn't have enough MON tokens to pay for gas fees when executing blockchain transactions.

## Solution

To fix this issue, you need to:

1. Set up the server wallet with the correct environment variables
2. Fund the server wallet with MON tokens

## Step-by-Step Instructions

### 1. Set Up Environment Variables

Create a `.env.local` file in the root directory of your project by copying the example:

```bash
cp .env.example .env.local
```

Then edit the `.env.local` file and fill in the required values:

```env
# Wallet private key for server-side contract interactions
# IMPORTANT: This wallet must have the GAME_ROLE on the contract to call updatePlayerData
# Make sure this wallet has enough MON tokens for gas fees
WALLET_PRIVATE_KEY=your_actual_wallet_private_key_here

# Generate using: openssl rand -hex 32
API_SECRET=your_generated_api_secret_here

NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Custom RPC URL for Monad Testnet
NEXT_PUBLIC_RPC_URL=https://monad-testnet.g.alchemy.com/v2/your_api_key_here

NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here

NEXT_PUBLIC_MONAD_GAMES_ID=your_monad_games_id_here
```

### 2. Get Your Server Wallet Address

Start your development server:

```bash
npm run dev
```

Then visit `http://localhost:3000/api/get-wallet-balance` in your browser to see your server wallet address.

Alternatively, check the server console logs when attempting to save a score - the error message will include the server wallet address.

### 3. Fund Your Server Wallet

Visit the [Monad Testnet Faucet](https://faucet.monad.ai/) to get test MON tokens and send at least 0.1 MON to your server wallet address.

### 4. Verify the Fix

After funding your wallet:
1. Restart your development server
2. Play the game and try to save your score
3. The transaction should now complete successfully

## Common Issues and Solutions

### Issue: "Server wallet has insufficient MON tokens for gas fees"
**Solution:** Fund your server wallet with at least 0.1 MON tokens using the Monad Testnet Faucet.

### Issue: "Unauthorized: Wallet does not have GAME_ROLE permission"
**Solution:** Make sure your server wallet has the GAME_ROLE on the contract. This typically requires the contract owner to grant this role.

### Issue: "Failed to connect to blockchain RPC"
**Solution:** Check your RPC URL configuration in the environment variables.

## Wallet Best Practices

1. **Separate Wallets**: Remember that the server wallet is different from player wallets. The server wallet pays for gas fees when saving scores.

2. **Minimum Balance**: Keep at least 0.1 MON in the server wallet to ensure smooth operation.

3. **Security**: Never commit your `.env.local` file or any file containing real secrets to version control.

4. **Monitoring**: Regularly check your server wallet balance to ensure it has sufficient funds.