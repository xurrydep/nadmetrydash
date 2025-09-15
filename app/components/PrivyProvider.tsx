"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // During build time or when no app ID is provided, render children without Privy
  if (!privyAppId) {
    console.warn('NEXT_PUBLIC_PRIVY_APP_ID is not set. Privy authentication will not be available.');
    return <>{children}</>;
  }

  // Log the app ID for debugging (remove in production)
  console.log('Privy App ID:', privyAppId);
  console.log('Privy App ID length:', privyAppId.length);

  // Check if the app ID has the correct format (should start with "cm" and be of reasonable length)
  if (!privyAppId.startsWith('cm') || privyAppId.length < 10) {
    console.error('Invalid Privy App ID format. It should start with "cm" and be longer. Current value:', privyAppId);
    console.warn('Privy authentication will not be available due to invalid app ID.');
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethodsAndOrder: {
          // Don't forget to enable Monad Games ID support in:
          // Global Wallet > Integrations > Monad Games ID (click on the slide to enable)
          primary: ["privy:cmd8euall0037le0my79qpz42"], // This is the Cross App ID, DO NOT CHANGE THIS
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}