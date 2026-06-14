import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Failsafe · Tokyo 2042 Archive Terminal",
  description:
    "Replay canonical financial events from Tokyo 2042. Driven by Fabrknt's real L1 engines.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={mono.className}>
      <body className="scanline antialiased">{children}</body>
    </html>
  );
}
