"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, Globe, Briefcase, LayoutDashboard, Search, FlaskConical, Filter, Calendar } from "lucide-react";
import { clsx } from "clsx";
import { useState, useRef, useCallback } from "react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/screener", label: "Screener", icon: Filter },
  { href: "/analisi", label: "Analisi", icon: FlaskConical },
  { href: "/crypto", label: "Crypto", icon: BarChart2 },
  { href: "/macro", label: "Macro", icon: Globe },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/earnings", label: "Earnings", icon: Calendar },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const focusSearch = useCallback(() => searchRef.current?.focus(), []);
  useKeyboardShortcut("/", focusSearch);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const ticker = search.trim().toUpperCase();
    if (ticker) {
      setSearch("");
      router.push(`/equity/${ticker}`);
    }
  }

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

      <div className="mt-auto pt-4 border-t border-border">
        <form onSubmit={handleSearch} className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca ticker… (/)"
            className="w-full bg-surface border border-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder:text-muted outline-none focus:border-accent"
          />
        </form>
      </div>
    </aside>
  );
}
