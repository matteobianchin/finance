import type { Metadata } from "next";
export const metadata: Metadata = { title: "Earnings | OpenBB" };
export default function EarningsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
