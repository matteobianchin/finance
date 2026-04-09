"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, TrendingUp, Globe, Briefcase, LayoutDashboard } from "lucide-react";
import { clsx } from "clsx";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/equity/AAPL", label: "Azioni", icon: TrendingUp },
  { href: "/crypto", label: "Crypto", icon: BarChart2 },
  { href: "/macro", label: "Macro", icon: Globe },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-card border-r border-border flex flex-col p-4 gap-1">
      <div className="text-white font-bold text-lg mb-6 px-2">
        📈 OpenBB
      </div>
      {NAV.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname.startsWith(href.split("/")[1] ? `/${href.split("/")[1]}` : href);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              isActive
                ? "bg-accent/20 text-accent font-medium"
                : "text-muted hover:text-white hover:bg-white/5"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
