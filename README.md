This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Registration

To register for the game, visit [MonadClip](https://monadclip.vercel.app/) to create your account.

## Environment Setup

Before running the application, you need to set up your environment variables:

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the required environment variables in `.env.local`:
   - `WALLET_PRIVATE_KEY`: Your wallet private key for server-side contract interactions
     - This wallet must have the GAME_ROLE on the contract to call updatePlayerData
     - **IMPORTANT**: Make sure this wallet has enough MON tokens for gas fees (at least 0.1 MON recommended)
   - `API_SECRET`: Generate using `openssl rand -hex 32`
   - `NEXT_PUBLIC_APP_URL`: Your application URL (e.g., http://localhost:3000)
   - `NEXT_PUBLIC_PRIVY_APP_ID`: Your Privy app ID for authentication
   - `NEXT_PUBLIC_MONAD_GAMES_ID`: Your Monad Games ID for leaderboard integration
   - `NEXT_PUBLIC_RPC_URL`: The RPC URL for the Monad Testnet (defaults to Alchemy RPC)

⚠️ **Security Note**: Never commit `.env.local` or any file containing real secrets to version control. These files are already ignored by `.gitignore`.

## Funding Your Wallet

To submit scores to the blockchain, your server wallet (specified by WALLET_PRIVATE_KEY) must have MON tokens to pay for gas fees:

1. Get your wallet address from a wallet management tool or by logging the address in the server code
2. Visit the [Monad Testnet Faucet](https://faucet.monad.ai/) to get test MON tokens
3. Send at least 0.1 MON tokens to your server wallet address

## Getting Started

After setting up your environment variables, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.