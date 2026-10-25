"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectableRow {
  /** Stable id (e.g. the scenario_id). */
  id: string;
  /** Row title, e.g. "Unexpected expense". */
  title: React.ReactNode;
  /** Optional quiet one-line summary under the title (shown while collapsed too). */
  summary?: React.ReactNode;
  /** Optional quiet text on the right of the row (e.g. "Savings last"). */
  meta?: React.ReactNode;
  /** Content shown when this row is the selected one. */
  content: React.ReactNode;
}

export interface SelectableRowsProps {
  rows: SelectableRow[];
  /** Accessible name of the list, e.g. "Other scenarios". */
  label: string;
  /** Controlled selection (row id or null). */
  value?: string | null;
  /** Uncontrolled initial selection. */
  defaultValue?: string | null;
  onValueChange?: (id: string | null) => void;
  /** Clicking the selected row again collapses it (default true). */
  collapsible?: boolean;
  /** Keep collapsed rows' content in the DOM (hidden attribute). Default true; set false for heavy charts. */
  mountAll?: boolean;
  /** Wrap each row button in a heading of this level (accordion pattern). Default 3; null for none. */
  headingLevel?: 2 | 3 | 4 | null;
  className?: string;
}

/**
 * Compact selectable rows: selecting a row makes it the single expanded one (disclosure buttons with
 * aria-expanded + aria-controls). Up / Down / Home / End move between rows. A row's content fades in.
 */
export function SelectableRows({
  rows,
  label,
  value,
  defaultValue = null,
  onValueChange,
  collapsible = true,
  mountAll = true,
  headingLevel = 3,
  className,
}: SelectableRowsProps) {
  const [inner, setInner] = React.useState<string | null>(defaultValue);
  const selected = value !== undefined ? value : inner;
  const baseId = React.useId();
  const buttons = React.useRef<(HTMLButtonElement | null)[]>([]);

  function select(id: string) {
    const next = selected === id ? (collapsible ? null : id) : id;
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = rows.length - 1;
    const to = e.key === "ArrowDown" ? (i === last ? 0 : i + 1) : e.key === "ArrowUp" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (to === null) return;
    e.preventDefault();
    buttons.current[to]?.focus();
  }

  const H = headingLevel ? (`h${headingLevel}` as "h2" | "h3" | "h4") : null;

  return (
    <ul aria-label={label} className={cn("divide-y divide-line border-y border-line", className)}>
      {rows.map((r, i) => {
        const open = selected === r.id;
        const btnId = `${baseId}-row-${i}`;
        const panelId = `${baseId}-panel-${i}`;
        const button = (
          <button
            ref={(el) => {
              buttons.current[i] = el;
            }}
            id={btnId}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => select(r.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="flex w-full items-center gap-3 rounded-sm py-4 text-left transition-colors duration-150 hover:text-ink"
          >
            <span className="min-w-0 flex-1">
              <span className={cn("block text-base text-ink", open && "font-medium")}>{r.title}</span>
              {r.summary && <span className="mt-0.5 block text-sm text-ink-subtle">{r.summary}</span>}
            </span>
            {r.meta && <span className="shrink-0 text-sm text-ink-muted">{r.meta}</span>}
            <ChevronDown
              aria-hidden
              className={cn("size-4 shrink-0 text-ink-subtle transition-transform duration-150", open && "rotate-180")}
            />
          </button>
        );
        return (
          <li key={r.id} data-row-id={r.id} data-selected={open ? "" : undefined}>
            {H ? <H className="text-base font-normal">{button}</H> : button}
            {(open || mountAll) && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={btnId}
                hidden={!open}
                className={cn("pb-6", open && "dt-panel-in")}
              >
                {r.content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
