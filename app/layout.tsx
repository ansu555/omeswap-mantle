import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Omega",
  description: "The next-generation decentralized exchange on 0G",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
