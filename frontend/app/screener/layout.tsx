import type { Metadata } from "next";
export const metadata: Metadata = { title: "Screener | OpenBB" };
export default function ScreenerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
