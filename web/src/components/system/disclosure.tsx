"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DisclosureProps {
  /** The always-visible summary row ("Why we ask", "Sources", "Monthly table" …). Phrasing content only. */
  summary: React.ReactNode;
  /** Optional quiet text at the right of the summary row (e.g. "3 sources"). */
  meta?: React.ReactNode;
  children: React.ReactNode;
  /** Uncontrolled initial state. */
  defaultOpen?: boolean;
  /** Controlled state (pair with onOpenChange). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * "inline": a quiet text row (default), for "Why we ask", "Sources", "How this was calculated".
   * "card":   soft rounded block, for larger sections such as "Assumptions" or "Monthly table".
   */
  variant?: "inline" | "card";
  /** Open the disclosure while printing (restored afterwards). */
  printOpen?: boolean;
  id?: string;
  className?: string;
  /** Extra classes for the content wrapper. */
  contentClassName?: string;
}

/**
 * Keyboard-accessible disclosure built on native <details>/<summary> (Enter/Space toggle, expanded state is
 * exposed to assistive tech, find-in-page opens it). Height/opacity animate where the browser supports
 * ::details-content; prefers-reduced-motion disables the transition (globals.css).
 */
export function Disclosure({
  summary,
  meta,
  children,
  defaultOpen,
  open,
  onOpenChange,
  variant = "inline",
  printOpen = false,
  id,
  className,
  contentClassName,
}: DisclosureProps) {
  const ref = React.useRef<HTMLDetailsElement>(null);
  const controlled = open !== undefined;

  React.useEffect(() => {
    if (!printOpen) return;
    const el = ref.current;
    if (!el) return;
    let wasOpen = el.open;
    const before = () => {
      wasOpen = el.open;
      el.open = true;
    };
    const after = () => {
      el.open = wasOpen;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [printOpen]);

  const card = variant === "card";
  return (
    <details
      ref={ref}
      id={id}
      className={cn("dt-disclosure group/disclosure", card && "rounded-card bg-canvas", className)}
      data-print-open={printOpen ? "" : undefined}
      {...(controlled ? { open } : defaultOpen ? { open: true } : {})}
      onToggle={(e) => onOpenChange?.(e.currentTarget.open)}
    >
      <summary
        className={cn(
          "flex items-center gap-2 rounded-control text-[15px] font-medium text-ink-muted transition-colors duration-150 hover:text-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          card ? "min-h-12 px-4 py-3 text-ink sm:px-5" : "min-h-9 py-1.5",
        )}
      >
        <span className="min-w-0 flex-1">{summary}</span>
        {meta && <span className="shrink-0 text-sm font-normal text-ink-subtle">{meta}</span>}
        <ChevronDown aria-hidden className="dt-chevron size-4 shrink-0 text-ink-subtle" />
      </summary>
      <div className={cn("text-[15px] leading-relaxed text-ink-muted", card ? "px-4 pb-4 sm:px-5 sm:pb-5" : "pb-2 pt-1", contentClassName)}>
        {children}
      </div>
    </details>
  );
}
