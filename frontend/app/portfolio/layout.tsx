import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio | OpenBB",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
