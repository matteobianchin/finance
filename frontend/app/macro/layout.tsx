import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Macro | OpenBB",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
