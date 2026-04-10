import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { WatchlistProvider } from "@/components/providers/WatchlistProvider";

export const metadata: Metadata = {
  title: "OpenBB Dashboard",
  description: "Dashboard finanziaria personale",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="flex min-h-screen bg-surface text-gray-100">
        <WatchlistProvider>
          <Sidebar />
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </WatchlistProvider>
      </body>
    </html>
  );
}
