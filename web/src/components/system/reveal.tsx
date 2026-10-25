"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RevealProps {
  /** The summary text, e.g. "See financial breakdown", "Why do we ask this?". Phrasing content only. */
  summary: React.ReactNode;
  /** Collapsed content. It stays in the DOM while closed (native <details>). */
  children: React.ReactNode;
  /** Quiet trailing text on the summary row, e.g. "4 items". */
  meta?: React.ReactNode;
  /** "sm" (default): 15 px quiet text row. "md": 16 px row with a hairline above, for section-level reveals. */
  size?: "sm" | "md";
  /** Uncontrolled initial state. */
  defaultOpen?: boolean;
  /** Controlled state (pair with onOpenChange). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Print the content even when closed (CSS + beforeprint), restored after printing. */
  printOpen?: boolean;
  /** Native exclusive group: Reveals sharing a name close each other (details[name]). */
  name?: string;
  id?: string;
  className?: string;
  /** Extra classes for the content wrapper. */
  contentClassName?: string;
}

/**
 * Small, keyboard-accessible disclosure built on native <details>/<summary>: Enter and Space toggle, the
 * expanded state is exposed to assistive tech, find-in-page opens it, and collapsed content stays in the
 * DOM. Opens with a 180 ms fade where supported; prefers-reduced-motion turns it off (globals.css).
 */
export function Reveal({
  summary,
  children,
  meta,
  size = "sm",
  defaultOpen,
  open,
  onOpenChange,
  printOpen = false,
  name,
  id,
  className,
  contentClassName,
}: RevealProps) {
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

  const md = size === "md";
  return (
    <details
      ref={ref}
      id={id}
      name={name}
      data-reveal=""
      data-print-open={printOpen ? "" : undefined}
      className={cn("dt-reveal group/reveal", md && "border-t border-line", className)}
      {...(controlled ? { open } : defaultOpen ? { open: true } : {})}
      onToggle={(e) => onOpenChange?.(e.currentTarget.open)}
    >
      <summary
        className={cn(
          "flex w-full items-center gap-2 rounded-sm transition-colors duration-150",
          md ? "min-h-14 py-3 text-base font-medium text-ink hover:text-ink-muted" : "min-h-9 py-1.5 text-[15px] text-ink-muted hover:text-ink",
        )}
      >
        <span className="min-w-0">{summary}</span>
        {meta && <span className="shrink-0 text-sm text-ink-subtle">{meta}</span>}
        <ChevronDown aria-hidden className={cn("dt-chevron size-4 shrink-0 text-ink-subtle", md && "ml-auto")} />
      </summary>
      <div className={cn("pb-3 pt-1 text-[15px] leading-relaxed text-ink-muted", md && "pb-6", contentClassName)}>{children}</div>
    </details>
  );
}
