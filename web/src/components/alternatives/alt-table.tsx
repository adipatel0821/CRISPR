"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Alternative } from "@/lib/contracts";
import { displayNumber, formatMoney, formatRatioPercent, formatSignedMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { assumptionBadges } from "./alt-view";

type SortKey = "label" | "monthly_payment" | "finance_charge" | "monthly_left_after" | "savings_after_purchase" | "break_even_m3";

const COLUMNS: { key: SortKey; label: string; fmt?: (s: string | null | undefined) => string; delta?: boolean }[] = [
  { key: "label", label: "Option" },
  { key: "monthly_payment", label: "Monthly payment", fmt: formatMoney, delta: true },
  { key: "finance_charge", label: "Finance charge", fmt: formatMoney, delta: true },
  { key: "monthly_left_after", label: "Left each month", fmt: formatMoney, delta: true },
  { key: "savings_after_purchase", label: "Savings after purchase", fmt: formatMoney, delta: true },
  { key: "break_even_m3", label: "Income drop absorbed (3 mo)", fmt: (s) => formatRatioPercent(s, 0) },
];

/** Sortable comparison of every alternative. Sorting compares backend strings only (no arithmetic). */
export function AltTable({ alts, pareto }: { alts: Alternative[]; pareto: string[] }) {
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "finance_charge", dir: "asc" });

  const sorted = [...alts].sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    const mul = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "label") return a.label.localeCompare(b.label) * mul;
    const x = displayNumber(a.metrics[sort.key] ?? null);
    const y = displayNumber(b.metrics[sort.key] ?? null);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * mul;
  });

  function toggle(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[46rem] text-sm print:min-w-0 print:text-[9pt]">
        <caption className="sr-only">Every alternative compared with your offer. Use the column buttons to sort.</caption>
        <thead>
          <tr className="border-b border-line text-left">
            {COLUMNS.map((c) => {
              const active = sort.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn("py-2.5 pr-3 align-bottom text-[13px] font-medium text-ink-subtle", c.key !== "label" && "text-right")}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md text-left transition-colors duration-150 hover:text-ink",
                      active && "text-ink",
                      c.key !== "label" && "flex-row-reverse text-right",
                    )}
                  >
                    {c.label}
                    {active ? (
                      sort.dir === "asc" ? (
                        <ArrowUp aria-hidden className="size-3.5 shrink-0 print:hidden" />
                      ) : (
                        <ArrowDown aria-hidden className="size-3.5 shrink-0 print:hidden" />
                      )
                    ) : (
                      <ArrowUpDown aria-hidden className="size-3.5 shrink-0 opacity-40 print:hidden" />
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => {
            const notes = assumptionBadges(a);
            return (
              <tr key={a.alt_id} className={cn("border-b border-line align-top last:border-0", a.is_base && "bg-canvas")}>
                <th scope="row" className="py-3 pl-2 pr-3 text-left font-normal print:w-[34%] print:py-1.5 print:pl-0">
                  <span className={cn("font-medium", a.feasible ? "text-ink" : "text-ink-subtle")}>{a.label}</span>
                  {(a.is_base || !a.feasible) && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {a.is_base && <Badge tone="accent">Your offer</Badge>}
                      {!a.feasible && <Badge tone="neutral">Not possible with your savings</Badge>}
                    </span>
                  )}
                  {a.feasible && (notes.length > 0 || (!a.is_base && pareto.includes(a.alt_id))) && (
                    <span className="mt-0.5 block max-w-[16rem] text-xs leading-relaxed text-ink-subtle">
                      {[!a.is_base && pareto.includes(a.alt_id) ? "Trade-off set" : null, ...notes].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {!a.feasible && a.infeasible_reasons.length > 0 && (
                    <span className="mt-1.5 block max-w-xs text-xs leading-relaxed text-ink-muted">{a.infeasible_reasons.join(" ")}</span>
                  )}
                </th>
                {COLUMNS.slice(1).map((c) => {
                  const v = a.metrics[c.key] ?? null;
                  const d = a.deltas_vs_base[c.key];
                  return (
                    <td key={c.key} className={cn("figure py-3 pr-3 text-right", a.feasible ? "text-ink" : "text-ink-subtle")}>
                      {a.feasible ? (c.fmt ? c.fmt(v) : v) : "n/a"}
                      {a.feasible && !a.is_base && c.delta && d !== undefined && d !== null && d !== "0.00" && (
                        <span className="block whitespace-nowrap text-xs text-ink-subtle">{formatSignedMoney(d)}<span className="print:hidden"> vs offer</span></span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
