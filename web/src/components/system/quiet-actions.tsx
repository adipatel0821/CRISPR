"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** One small secondary action in a QuietActions row. Give exactly one of onClick, href or reveal. */
export interface QuietAction {
  /** Visible text, e.g. "Why do we ask this?", "Skip", "I'd rather not say". */
  label: string;
  /** Plain button action. */
  onClick?: () => void;
  /** Link action (Next <Link>). */
  href?: string;
  /**
   * Disclosure action: the label becomes a toggle button (aria-expanded) and this content shows in a panel
   * BELOW the row. The panel stays in the DOM while closed (hidden attribute).
   */
  reveal?: React.ReactNode;
  /** Open the reveal panel initially. */
  defaultOpen?: boolean;
  disabled?: boolean;
  /** Accessible name when the visible label needs more context. */
  "aria-label"?: string;
  /** Stable id (also used to derive the panel id). */
  id?: string;
}

export interface QuietActionsProps {
  actions: (QuietAction | null | false | undefined)[];
  /** Accessible name for the group (optional). */
  "aria-label"?: string;
  /** Alignment of the row (default "start"; "center" under a centred primary action). */
  align?: "start" | "center";
  className?: string;
}

const ITEM =
  "inline-flex min-h-8 items-center rounded-sm text-sm text-ink-muted underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline disabled:pointer-events-none disabled:opacity-50";

/**
 * A single row of small secondary actions under the primary action, separated by middle dots:
 * "Why do we ask this? · Skip". Reveal items open a panel below the row (one at a time).
 */
export function QuietActions({ actions, align = "start", className, ...rest }: QuietActionsProps) {
  const items = actions.filter((a): a is QuietAction => !!a);
  const baseId = React.useId();
  const [openIdx, setOpenIdx] = React.useState<number | null>(() => {
    const i = items.findIndex((a) => a.reveal && a.defaultOpen);
    return i >= 0 ? i : null;
  });
  if (items.length === 0) return null;
  const panelId = (i: number) => `${items[i].id ?? baseId}-panel-${i}`;

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="group"
        aria-label={rest["aria-label"]}
        className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", align === "center" && "justify-center")}
      >
        {items.map((a, i) => {
          const sep = i > 0 ? (
            <span aria-hidden className="select-none text-ink-subtle">
              ·
            </span>
          ) : null;
          let control: React.ReactNode;
          if (a.reveal !== undefined) {
            const open = openIdx === i;
            control = (
              <button
                type="button"
                id={a.id}
                className={cn(ITEM, open && "text-ink")}
                aria-expanded={open}
                aria-controls={panelId(i)}
                aria-label={a["aria-label"]}
                disabled={a.disabled}
                onClick={() => setOpenIdx(open ? null : i)}
              >
                {a.label}
              </button>
            );
          } else if (a.href && !a.disabled) {
            control = (
              <Link href={a.href} id={a.id} className={ITEM} aria-label={a["aria-label"]}>
                {a.label}
              </Link>
            );
          } else {
            control = (
              <button type="button" id={a.id} className={ITEM} aria-label={a["aria-label"]} disabled={a.disabled} onClick={a.onClick}>
                {a.label}
              </button>
            );
          }
          return (
            <React.Fragment key={`${a.label}-${i}`}>
              {sep}
              {control}
            </React.Fragment>
          );
        })}
      </div>
      {items.map((a, i) =>
        a.reveal !== undefined ? (
          <div
            key={`panel-${i}`}
            id={panelId(i)}
            role="region"
            aria-label={a.label}
            hidden={openIdx !== i}
            className={cn("text-[15px] leading-relaxed text-ink-muted", openIdx === i && "dt-panel-in", align === "center" && "text-center")}
          >
            {a.reveal}
          </div>
        ) : null,
      )}
    </div>
  );
}
