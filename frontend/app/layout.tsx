import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenBB Dashboard",
  description: "Personal financial dashboard powered by OpenBB Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
