"use client";

/**
 * Charts. Every chart answers the question in its heading, plots backend values only (parsed to
 * numbers solely for positioning) and ships a table/list alternative so identity is never colour-alone.
 * Palette: focus = accent teal, context = slate (with dash / shape as secondary encoding).
 */
import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  ReferenceLine,
  Legend,
} from "recharts";
import type { Alternative, ScenarioResult } from "@/lib/contracts";
import { displayNumber, formatMoney, formatMoneyTick } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACCENT = "#0f766e";
const CONTEXT = "#64748b";
const GRID = "#e2e8f0";
const AXIS = "#64748b";

/* ------------------------------------------------------------------ */
/* Stacked breakdown bar: "Where does the total paid through the deal go?" */
/* ------------------------------------------------------------------ */
const BREAKDOWN_ORDER: { key: string; label: string; color: string }[] = [
  { key: "cash_price", label: "Cash price", color: "#334155" },
  { key: "taxes_title_fees", label: "Taxes, title & fees", color: "#64748b" },
  { key: "add_ons", label: "Add-ons", color: "#94a3b8" },
  { key: "prior_loan_balance_rolled_in", label: "Rolled-in old loan balance", color: "#cbd5e1" },
  { key: "finance_charge", label: "Finance charge (cost of borrowing)", color: ACCENT },
];

export function BreakdownBar({ breakdown, total }: { breakdown: Record<string, string>; total: string | null }) {
  const totalN = displayNumber(total);
  const parts = BREAKDOWN_ORDER.map((p) => ({ ...p, value: breakdown[p.key] ?? null, n: displayNumber(breakdown[p.key]) }));
  const visible = parts.filter((p) => p.n !== null && p.n > 0);
  const sum = visible.reduce((a, p) => a + (p.n ?? 0), 0);
  const scale = totalN && totalN > 0 ? totalN : sum;
  return (
    <figure className="space-y-3">
      <div className="flex h-5 w-full overflow-hidden rounded-[4px] bg-canvas" role="img" aria-label="Breakdown of the total paid through the deal; values listed below">
        {visible.map((p, i) => (
          <div
            key={p.key}
            title={`${p.label}: ${formatMoney(p.value)}`}
            style={{ width: `${((p.n ?? 0) / scale) * 100}%`, background: p.color }}
            className={cn("h-full", i > 0 && "border-l-2 border-surface")}
          />
        ))}
      </div>
      <figcaption>
        <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-3 border-b border-line py-1">
              <span className="flex items-center gap-2 text-ink-muted">
                <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
                {p.label}
              </span>
              <span className="figure font-medium text-ink">{p.value === null ? "Not known" : formatMoney(p.value)}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Savings paths: "How would your savings move over 12 months?"        */
/* ------------------------------------------------------------------ */
interface PathPoint {
  month: number;
  without: number | null;
  with: number | null;
  withGap: number | null;
  withoutGap: number | null;
}

function TooltipBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-md">{children}</div>;
}

export function SavingsPathChart({ without, withOffer }: { without?: ScenarioResult; withOffer?: ScenarioResult }) {
  const months = (withOffer ?? without)?.monthly_paths.map((m) => m.month) ?? [];
  const data: PathPoint[] = months.map((month) => {
    const w = withOffer?.monthly_paths.find((m) => m.month === month);
    const wo = without?.monthly_paths.find((m) => m.month === month);
    return {
      month,
      with: displayNumber(w?.savings_balance),
      without: displayNumber(wo?.savings_balance),
      withGap: displayNumber(w?.unfunded_gap),
      withoutGap: displayNumber(wo?.unfunded_gap),
    };
  });
  const raw = (s: ScenarioResult | undefined, month: number) => s?.monthly_paths.find((m) => m.month === month);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 12 }} tickFormatter={(m) => `M${m}`} />
          <YAxis
            width={64}
            tickLine={false}
            axisLine={false}
            tick={{ fill: AXIS, fontSize: 12 }}
            tickFormatter={(v: number) => formatMoneyTick(v)}
            domain={[0, "auto"]}
          />
          <ReferenceLine y={0} stroke={AXIS} />
          <Tooltip
            cursor={{ stroke: AXIS, strokeDasharray: "2 2" }}
            content={({ active, label }) => {
              if (!active || label === undefined) return null;
              const m = Number(label);
              const w = raw(withOffer, m);
              const wo = raw(without, m);
              return (
                <TooltipBox>
                  <p className="mb-1 font-semibold text-ink">Month {m}</p>
                  {wo && (
                    <p className="tabular text-ink-muted">
                      Without the loan: {formatMoney(wo.savings_balance)}
                      {wo.unfunded_gap !== "0.00" ? ` · gap ${formatMoney(wo.unfunded_gap)}` : ""}
                    </p>
                  )}
                  {w && (
                    <p className="tabular text-ink">
                      With the loan: {formatMoney(w.savings_balance)}
                      {w.unfunded_gap !== "0.00" ? ` · gap ${formatMoney(w.unfunded_gap)}` : ""}
                    </p>
                  )}
                </TooltipBox>
              );
            }}
          />
          <Legend verticalAlign="top" align="left" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12, color: AXIS }} />
          {without && (
            <Line
              name="Without the loan"
              type="linear"
              dataKey="without"
              stroke={CONTEXT}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          )}
          {withOffer && (
            <Line
              name="With the loan"
              type="linear"
              dataKey="with"
              stroke={ACCENT}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Accessible month-by-month table for a scenario pair (savings + unfunded gap, shown separately). */
export function PathTable({ without, withOffer, caption }: { without?: ScenarioResult; withOffer?: ScenarioResult; caption: string }) {
  const rows = (withOffer ?? without)?.monthly_paths ?? [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-ink-muted">
            <th scope="col" className="py-1.5 pr-2 font-medium">Month</th>
            <th scope="col" className="py-1.5 pr-2 text-right font-medium">Savings without loan</th>
            <th scope="col" className="py-1.5 pr-2 text-right font-medium">Gap without loan</th>
            <th scope="col" className="py-1.5 pr-2 text-right font-medium">Savings with loan</th>
            <th scope="col" className="py-1.5 text-right font-medium">Gap with loan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const wo = without?.monthly_paths.find((m) => m.month === r.month);
            const w = withOffer?.monthly_paths.find((m) => m.month === r.month);
            return (
              <tr key={r.month} className="border-b border-line/60">
                <th scope="row" className="py-1 pr-2 text-left font-normal text-ink-muted">{r.month}</th>
                <td className="py-1 pr-2 text-right">{formatMoney(wo?.savings_balance)}</td>
                <td className="py-1 pr-2 text-right">{formatMoney(wo?.unfunded_gap)}</td>
                <td className="py-1 pr-2 text-right">{formatMoney(w?.savings_balance)}</td>
                <td className={cn("py-1 text-right", w && w.unfunded_gap !== "0.00" && "font-semibold text-deficit")}>
                  {formatMoney(w?.unfunded_gap)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Alternatives scatter: "What do you trade between total borrowing    */
/* cost and money left each month?"                                    */
/* ------------------------------------------------------------------ */
interface AltPoint {
  x: number;
  y: number;
  alt: Alternative;
}

export function AlternativesScatter({ alternatives, pareto }: { alternatives: Alternative[]; pareto: string[] }) {
  const pts: AltPoint[] = alternatives
    .filter((a) => a.feasible)
    .map((a) => ({ x: displayNumber(a.metrics.finance_charge), y: displayNumber(a.metrics.monthly_left_after), alt: a }))
    .filter((p): p is AltPoint => p.x !== null && p.y !== null);
  const base = pts.filter((p) => p.alt.is_base);
  const front = pts.filter((p) => !p.alt.is_base && pareto.includes(p.alt.alt_id));
  const rest = pts.filter((p) => !p.alt.is_base && !pareto.includes(p.alt.alt_id));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number"
            dataKey="x"
            name="Finance charge"
            tickLine={false}
            tick={{ fill: AXIS, fontSize: 12 }}
            tickFormatter={(v: number) => formatMoneyTick(v)}
            domain={["auto", "auto"]}
            label={{ value: "Finance charge (lower costs less) →", position: "insideBottom", offset: -16, fill: AXIS, fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Monthly left after"
            width={64}
            tickLine={false}
            tick={{ fill: AXIS, fontSize: 12 }}
            tickFormatter={(v: number) => formatMoneyTick(v)}
            domain={["auto", "auto"]}
          />
          <ZAxis range={[90, 90]} />
          <Tooltip
            cursor={{ strokeDasharray: "2 2" }}
            content={({ active, payload }) => {
              const p = active && payload && payload[0] ? (payload[0].payload as AltPoint) : null;
              if (!p) return null;
              return (
                <TooltipBox>
                  <p className="mb-1 font-semibold text-ink">{p.alt.label}</p>
                  <p className="tabular text-ink-muted">Finance charge: {formatMoney(p.alt.metrics.finance_charge)}</p>
                  <p className="tabular text-ink-muted">Left each month: {formatMoney(p.alt.metrics.monthly_left_after)}</p>
                  <p className="tabular text-ink-muted">Savings after purchase: {formatMoney(p.alt.metrics.savings_after_purchase)}</p>
                  {p.alt.assumption_flags.includes("same_rate_assumed") && <p className="mt-1 text-info">Same rate assumed</p>}
                </TooltipBox>
              );
            }}
          />
          <Legend verticalAlign="top" align="left" height={28} wrapperStyle={{ fontSize: 12, color: AXIS }} />
          {rest.length > 0 && (
            <Scatter name="Other alternatives" data={rest} fill="#ffffff" stroke={CONTEXT} strokeWidth={2} shape="circle" isAnimationActive={false} />
          )}
          {front.length > 0 && (
            <Scatter name="Trade-off set (no option beats it on every measure)" data={front} fill={ACCENT} fillOpacity={0.35} stroke={ACCENT} strokeWidth={2} shape="circle" isAnimationActive={false} />
          )}
          {base.length > 0 && (
            <Scatter name="Your offer" data={base} fill={ACCENT} stroke="#ffffff" strokeWidth={2} shape="diamond" isAnimationActive={false} />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
