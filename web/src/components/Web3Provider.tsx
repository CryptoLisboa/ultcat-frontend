"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { cronos } from "@reown/appkit/networks";
import { type ReactNode, useState } from "react";
import { WagmiProvider, type Config } from "wagmi";
import { projectId, wagmiAdapter } from "../config/wagmi";
import { TOKEN_LOGO_ABSOLUTE_URL } from "../lib/constants";

const metadata = {
  name: "Ultra Cat",
  description: "Swap CRO ↔ ULTCAT on Cronos",
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : "https://ultcat.local",
  icons: [TOKEN_LOGO_ABSOLUTE_URL],
};

if (projectId && wagmiAdapter) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [cronos],
    defaultNetwork: cronos,
    projectId,
    metadata,
    features: {
      analytics: false,
      email: false,
      socials: false,
      swaps: false,
      onramp: false,
    },
  });
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  if (!projectId || !wagmiAdapter) {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
