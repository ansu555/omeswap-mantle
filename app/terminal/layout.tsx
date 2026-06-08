import type { Metadata } from "next";

import { WalletProvider } from "@/components/providers/wallet-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

import "./terminal.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trading Terminal · Omega",
  description:
    "Trade coins and perps with onchain market data, liquidity depth, and agentic execution context.",
};

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <WalletProvider>
        <div className="terminal-page">{children}</div>
      </WalletProvider>
    </ThemeProvider>
  );
}
