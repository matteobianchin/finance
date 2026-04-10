import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analisi | OpenBB" };

export default function AnalisiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
