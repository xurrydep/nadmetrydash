# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application bootstrapped with `create-next-app`, using React 19, TypeScript, and Tailwind CSS. The project is a blockchain-based game that integrates with the Monad Testnet.

## Development Commands

- `npm run dev` - Start development server with Turbopack (runs on http://localhost:3000)
- `npm run build` - Build the application for production
- `npm start` - Start the production server
- `npm run lint` - Run ESLint to check code quality

## Architecture

This application follows the Next.js App Router architecture:

- `app/` - Contains all routes and layout components using the App Router
  - `layout.tsx` - Root layout with font configuration (Geist fonts)
  - `page.tsx` - Homepage component
  - `globals.css` - Global CSS styles
  - `api/` - API routes for blockchain interactions
  - `components/` - React components including the game dashboard
  - `lib/` - Utility functions for blockchain, authentication, and score management
- `public/` - Static assets (SVG icons and images)
- `types/` - TypeScript type definitions

## Blockchain Integration

This game integrates with the Monad Testnet blockchain:

- **Contract Address**: 0x4b91a6541Cab9B2256EA7E6787c0aa6BE38b39c0
- **RPC Endpoint**: https://monad-testnet.g.alchemy.com/v2/L4mvj1NkUhphM3YY14DPO
- **Game Registration**: Players register through MonadClip at https://monadclip.vercel.app/

## Score Management

The application includes robust score management features:

- **Batch Updates**: Use `batchUpdatePlayerData` for efficient score submissions
- **Transaction Queue**: Automatic retry mechanism for failed transactions
- **Rate Limiting**: Protection against abuse with IP and player-specific limits
- **Security**: Session token validation and input sanitization

## Configuration

- **TypeScript**: Configured with strict mode and absolute imports using `@/*` path mapping
- **ESLint**: Uses Next.js core web vitals and TypeScript rules
- **Tailwind CSS**: Version 4 with PostCSS integration
- **Fonts**: Uses Next.js font optimization with Geist Sans and Geist Mono

## Development Notes

- The project uses Turbopack for faster development builds
- Hot reload is enabled - changes to `app/page.tsx` will be reflected immediately
- TypeScript is configured with strict mode for better type safety
- The app uses CSS variables for theming support (light/dark mode ready)
- Environment variables are used for sensitive configuration (RPC URL, wallet keys, etc.)