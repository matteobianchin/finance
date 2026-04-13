"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

interface Props {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function SectionToggle({ title, badge, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <ChevronDown
          size={14}
          className={clsx(
            "text-muted transition-transform duration-200 flex-shrink-0",
            open && "rotate-180"
          )}
        />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted group-hover:text-white transition-colors">
          {title}
        </span>
        {badge && (
          <span className="text-[10px] text-muted bg-border/50 border border-border px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
        <div className="flex-1 h-px bg-border/40 ml-1" />
      </button>

      {open && <div className="space-y-3">{children}</div>}
    </div>
  );
}
