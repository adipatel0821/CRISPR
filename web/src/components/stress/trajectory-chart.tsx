"use client";

/**
 * One savings trajectory chart for a stress scenario: savings with the loan (blue, solid) and without it
 * (slate, dashed) on one scale that starts at $0. Any shortfall beyond savings (the backend's unfunded_gap)
 * is drawn below the $0 line as hatched bars on the SAME scale, so the size of the hole is honest.
 * Backend strings are parsed only to position marks; tooltips and the table show the backend values.
 */
import * as React from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ScenarioResult } from "@/lib/contracts";
import { displayNumber, formatMoney, formatMoneyTick } from "@/lib/format";

const BRAND = "#2A64E3";
const SLATE = "#7C8BA1";
const SHORT = "#D9483B";
const GRID = "#E4E8EF";
const AXIS = "#667085";
const ZERO = "#4B5568";

interface Point {
  month: number;
  with: number | null;
  without: number | null;
  /** Drawn below zero: the unfunded gap's size, plotted downward (position only). */
  gapWithDraw: number | null;
  gapWithoutDraw: number | null;
}

function down(n: number | null): number | null {
  return n === null || n === 0 ? null : -Math.abs(n);
}

/** Round axis ticks that include zero (chart scaling only; no figure is derived from this). */
function niceTicks(values: number[]): number[] {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const raw = span / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const ticks: number[] = [];
  for (let t = Math.floor(lo / step) * step; t <= Math.ceil(hi / step) * step + step / 2; t += step) ticks.push(Math.round(t));
  return ticks;
}

function tick(v: number): string {
  // Typographic minus for negative ticks, like the figures elsewhere.
  return v < 0 ? `−${formatMoneyTick(Math.abs(v))}` : formatMoneyTick(v);
}

export function hasGap(run: ScenarioResult | undefined): boolean {
  return !!run?.monthly_paths?.some((m) => (displayNumber(m.unfunded_gap) ?? 0) > 0);
}

export function TrajectoryChart({ without, withOffer, title }: { without?: ScenarioResult; withOffer?: ScenarioResult; title: string }) {
  const base = withOffer ?? without;
  const months = base?.monthly_paths.map((m) => m.month) ?? [];
  const find = (s: ScenarioResult | undefined, month: number) => s?.monthly_paths.find((m) => m.month === month);
  const data: Point[] = months.map((month) => {
    const w = find(withOffer, month);
    const wo = find(without, month);
    return {
      month,
      with: displayNumber(w?.savings_balance),
      without: displayNumber(wo?.savings_balance),
      gapWithDraw: down(displayNumber(w?.unfunded_gap)),
      gapWithoutDraw: down(displayNumber(wo?.unfunded_gap)),
    };
  });
  const gapWith = hasGap(withOffer);
  const gapWithout = hasGap(without);
  const ticks = niceTicks(
    data.flatMap((d) => [d.with, d.without, d.gapWithDraw, d.gapWithoutDraw]).filter((v): v is number => v !== null),
  );

  return (
    <figure data-trajectory-chart="" className="min-w-0">
      <figcaption className="text-[15px] font-bold text-ink">{title}</figcaption>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2" aria-label="Chart key">
        {withOffer && (
          <li className="flex items-center gap-2">
            <span aria-hidden className="h-[3px] w-6 rounded-full" style={{ background: BRAND }} />
            Savings with the loan
          </li>
        )}
        {without && (
          <li className="flex items-center gap-2">
            <span aria-hidden className="h-0 w-6 border-t-2 border-dashed" style={{ borderColor: SLATE }} />
            Savings without the loan
          </li>
        )}
        {(gapWith || gapWithout) && (
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-3.5 rounded-[3px]"
              style={{ background: `repeating-linear-gradient(135deg, ${SHORT} 0 3px, #F6C9C4 3px 6px)` }}
            />
            Shortfall beyond savings, below $0
          </li>
        )}
      </ul>
      <div className="mt-3 h-64 w-full sm:h-72 xl:h-80" role="img" aria-label={`${title}. The month by month table below lists every value.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }} barCategoryGap="22%">
            <defs>
              <pattern id="dt-gap-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="#F6C9C4" />
                <rect width="3" height="6" fill={SHORT} />
              </pattern>
              <pattern id="dt-gap-hatch-slate" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="#E4E8EF" />
                <rect width="3" height="6" fill={SLATE} />
              </pattern>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: AXIS, fontSize: 13 }}
              tickFormatter={(m) => `M${m}`}
              interval="preserveStartEnd"
            />
            <YAxis
              width={70}
              tickLine={false}
              axisLine={false}
              tick={{ fill: AXIS, fontSize: 13 }}
              tickFormatter={tick}
              ticks={ticks}
              domain={[ticks[0], ticks[ticks.length - 1]]}
            />
            <ReferenceLine y={0} stroke={ZERO} strokeWidth={1.5} />
            <Tooltip
              cursor={{ stroke: AXIS, strokeDasharray: "3 3" }}
              content={({ active, label }) => {
                if (!active || label === undefined) return null;
                const m = Number(label);
                const w = find(withOffer, m);
                const wo = find(without, m);
                return (
                  <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-surface">
                    <p className="mb-1 font-bold text-ink">Month {m}</p>
                    {w && (
                      <p className="tabular text-ink">
                        With the loan: {formatMoney(w.savings_balance)}
                        {(displayNumber(w.unfunded_gap) ?? 0) > 0 ? `, shortfall ${formatMoney(w.unfunded_gap)}` : ""}
                      </p>
                    )}
                    {wo && (
                      <p className="tabular text-ink-2">
                        Without the loan: {formatMoney(wo.savings_balance)}
                        {(displayNumber(wo.unfunded_gap) ?? 0) > 0 ? `, shortfall ${formatMoney(wo.unfunded_gap)}` : ""}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            {gapWithout && <Bar dataKey="gapWithoutDraw" name="Shortfall without the loan" fill="url(#dt-gap-hatch-slate)" isAnimationActive={false} />}
            {gapWith && <Bar dataKey="gapWithDraw" name="Shortfall with the loan" fill="url(#dt-gap-hatch)" isAnimationActive={false} />}
            {without && (
              <Line
                name="Savings without the loan"
                type="linear"
                dataKey="without"
                stroke={SLATE}
                strokeWidth={2.5}
                strokeDasharray="6 5"
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            )}
            {withOffer && (
              <Line
                name="Savings with the loan"
                type="linear"
                dataKey="with"
                stroke={BRAND}
                strokeWidth={3.5}
                dot={{ r: 3, fill: BRAND, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
