"use client";

import * as React from "react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean; strokeWidth?: number }>;

/* ------------------------------------------------------------------------------------------------
 * IconBadge: a lucide icon in a tinted circle. Decorative unless `label` is given.
 * ---------------------------------------------------------------------------------------------- */
export type BadgeTone = "brand" | "savings" | "shortfall" | "caution" | "neutral" | "cta";
const BADGE: Record<BadgeTone, string> = {
  brand: "bg-brand-tint text-brand-strong",
  savings: "bg-savings-soft text-savings-ink",
  shortfall: "bg-shortfall-soft text-shortfall-ink",
  caution: "bg-caution-soft text-caution",
  neutral: "bg-canvas text-ink-2",
  cta: "bg-cta text-cta-ink",
};

export function IconBadge({
  icon: Icon,
  tone = "brand",
  size = "md",
  label,
  className,
}: {
  icon: IconType;
  tone?: BadgeTone;
  size?: "sm" | "md" | "lg";
  /** Accessible name when the icon carries meaning on its own. */
  label?: string;
  className?: string;
}) {
  const dims = size === "lg" ? "size-16 [&_svg]:size-8" : size === "sm" ? "size-9 [&_svg]:size-[18px]" : "size-12 [&_svg]:size-6";
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full", dims, BADGE[tone], className)}
    >
      <Icon aria-hidden strokeWidth={2} />
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------
 * OptionTiles: large selectable tiles with radio semantics (native radios: arrow keys move, Space selects).
 * ---------------------------------------------------------------------------------------------- */
export interface TileOption<T extends string = string> {
  value: T;
  title: React.ReactNode;
  /** One line under the title. */
  description?: React.ReactNode;
  icon?: IconType;
  disabled?: boolean;
}

export interface OptionTilesProps<T extends string = string> {
  /** Radio group name (unique per page). */
  name: string;
  /** Group label (legend). Hidden visually when legendHidden (the question heading already says it). */
  legend: React.ReactNode;
  legendHidden?: boolean;
  options: TileOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  /** Columns at >= 640 px (default: 2). */
  columns?: 1 | 2 | 3;
  /** id of an error / hint element. */
  describedBy?: string;
  className?: string;
}

export function OptionTiles<T extends string = string>({
  name,
  legend,
  legendHidden,
  options,
  value,
  onChange,
  columns = 2,
  describedBy,
  className,
}: OptionTilesProps<T>) {
  const cols = columns === 3 ? "sm:grid-cols-3" : columns === 1 ? "" : "sm:grid-cols-2";
  return (
    <fieldset aria-describedby={describedBy} className={cn("min-w-0", className)}>
      <legend className={cn("mb-3 text-[15px] font-bold text-ink", legendHidden && "sr-only")}>{legend}</legend>
      <div className={cn("grid grid-cols-1 gap-3", cols)}>
        {options.map((o) => (
          <OptionTile
            key={o.value}
            name={name}
            option={o}
            checked={value === o.value}
            onSelect={() => onChange(o.value)}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** One tile (use inside a fieldset with a legend, or use OptionTiles). */
export function OptionTile<T extends string = string>({
  name,
  option,
  checked,
  onSelect,
}: {
  name: string;
  option: TileOption<T>;
  checked: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;
  return (
    <label
      data-option-tile=""
      data-checked={checked ? "" : undefined}
      className={cn(
        "group relative flex min-h-24 cursor-pointer items-start gap-4 rounded-card border-2 bg-surface p-5 transition-[border-color,background-color,box-shadow] duration-150",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-strong",
        checked ? "border-brand bg-brand-tint" : "border-line hover:border-brand-line hover:shadow-soft",
        option.disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="radio"
        name={name}
        value={option.value}
        checked={checked}
        disabled={option.disabled}
        onChange={onSelect}
        className="peer sr-only"
      />
      {Icon && (
        <span
          aria-hidden
          className={cn(
            "inline-flex size-12 shrink-0 items-center justify-center rounded-full transition-colors duration-150 [&_svg]:size-6",
            checked ? "bg-brand text-white" : "bg-brand-tint text-brand-strong",
          )}
        >
          <Icon aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold leading-snug text-ink">{option.title}</span>
        {option.description && <span className="mt-1 block text-[15px] leading-relaxed text-ink-2">{option.description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150",
          checked ? "border-brand bg-brand" : "border-line-strong bg-surface",
        )}
      >
        {checked && <span className="size-2 rounded-full bg-white" />}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------------------------------------
 * SegmentedControl: a pill track of 2 to 5 options (native radios). Selected = blue pill + bold.
 * ---------------------------------------------------------------------------------------------- */
export interface SegmentOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: IconType;
}

export function SegmentedControl<T extends string = string>({
  name,
  legend,
  legendHidden,
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  name: string;
  legend: React.ReactNode;
  legendHidden?: boolean;
  options: SegmentOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className={cn("mb-3 text-[15px] font-bold text-ink", legendHidden && "sr-only")}>{legend}</legend>
      <div data-segmented="" className="inline-flex max-w-full flex-wrap gap-1 rounded-full bg-canvas p-1">
        {options.map((o) => {
          const checked = value === o.value;
          const Icon = o.icon;
          return (
            <label
              key={o.value}
              className={cn(
                "relative inline-flex cursor-pointer items-center gap-2 rounded-full font-semibold transition-colors duration-150",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-strong",
                size === "lg" ? "h-12 px-6 text-[17px]" : "h-10 px-4 text-[15px]",
                checked ? "bg-brand text-white shadow-soft" : "text-ink-2 hover:bg-surface hover:text-ink",
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {Icon && <Icon aria-hidden className="size-4" />}
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------------------------------------
 * BigCurrencyInput: a large "$" input that shows thousands separators as you type (string formatting only).
 * onValueChange receives the raw value without separators ("4200" or "4200.5"), ready for the existing parser.
 * ---------------------------------------------------------------------------------------------- */
export function formatCurrencyDraft(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  const intPart = (dot >= 0 ? cleaned.slice(0, dot) : cleaned).replace(/^0+(?=\d)/, "");
  const decPart = dot >= 0 ? cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2) : null;
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart === null ? grouped : `${grouped || "0"}.${decPart}`;
}

export function rawCurrencyDraft(display: string): string {
  return formatCurrencyDraft(display).replace(/,/g, "");
}

export interface BigCurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "size" | "prefix"> {
  id: string;
  /** Raw value ("4200.5"); shown with separators. */
  value: string;
  onValueChange: (raw: string) => void;
  /** Visible label. Omit only when aria-labelledby points at the question heading. */
  label?: React.ReactNode;
  /** Text after the number, e.g. "a month". */
  suffix?: React.ReactNode;
  invalid?: boolean;
  /** id(s) of hint / error elements. */
  describedBy?: string;
}

export const BigCurrencyInput = React.forwardRef<HTMLInputElement, BigCurrencyInputProps>(function BigCurrencyInput(
  { id, value, onValueChange, label, suffix, invalid, describedBy, className, ...rest },
  ref,
) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <label htmlFor={id} className="mb-2 block text-[15px] font-bold text-ink">
          {label}
        </label>
      )}
      <div
        data-big-currency=""
        className={cn(
          "flex w-full max-w-[32rem] items-center gap-2 rounded-card border-2 bg-surface px-5 transition-[border-color,box-shadow] duration-150",
          "focus-within:border-brand focus-within:shadow-[0_0_0_4px_var(--color-brand-tint)]",
          invalid ? "border-shortfall" : "border-line-strong",
        )}
      >
        <span aria-hidden className="text-[2rem] font-bold text-ink-3 sm:text-[2.5rem]">
          $
        </span>
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={formatCurrencyDraft(value)}
          onChange={(e) => onValueChange(rawCurrencyDraft(e.target.value))}
          className="figure h-20 w-full min-w-0 bg-transparent text-[2rem] font-extrabold tracking-[-0.02em] text-ink outline-none placeholder:font-semibold placeholder:text-ink-3 focus-visible:outline-none sm:h-24 sm:text-[2.75rem]"
          {...rest}
        />
        {suffix && <span className="shrink-0 whitespace-nowrap text-[15px] font-semibold text-ink-2">{suffix}</span>}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------------------------------------
 * HelpDisclosure: "Why do we ask this?" / "How we got this" (native <details>, keyboard and print safe).
 * ---------------------------------------------------------------------------------------------- */
export function HelpDisclosure({
  summary = "Why do we ask this?",
  children,
  defaultOpen,
  className,
}: {
  summary?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details data-help="" open={defaultOpen} className={cn("dt-disclosure group max-w-[var(--measure)]", className)}>
      <summary className="inline-flex min-h-10 items-center gap-2 rounded-sm text-[15px] font-semibold text-brand-strong hover:underline hover:underline-offset-4">
        {summary}
        <Info aria-hidden className="size-[1.1em]" />
        <ChevronDown aria-hidden className="dt-chevron size-4" />
      </summary>
      <div className="mt-2 border-l-2 border-brand-line pl-4 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}

/* ------------------------------------------------------------------------------------------------
 * ScenarioTiles: selectable tiles with tabs semantics (role=tablist / tab, roving tabindex, arrows, Home/End).
 * Render the panel yourself with {...scenarioPanelProps(idPrefix, value)}.
 * ---------------------------------------------------------------------------------------------- */
export interface ScenarioTileItem {
  id: string;
  title: React.ReactNode;
  /** One or two words, e.g. "Runs out" / "Holds". Pair the tone with these words. */
  outcome?: React.ReactNode;
  icon?: IconType;
  tone?: "neutral" | "shortfall" | "savings" | "caution";
}

const OUTCOME_TONE = {
  neutral: "text-ink-2",
  shortfall: "text-shortfall-ink",
  savings: "text-savings-ink",
  caution: "text-caution",
} as const;

export function scenarioTabId(idPrefix: string, id: string) {
  return `${idPrefix}-tab-${id}`;
}

export function scenarioPanelProps(idPrefix: string, value: string) {
  return {
    role: "tabpanel" as const,
    id: `${idPrefix}-panel`,
    "aria-labelledby": scenarioTabId(idPrefix, value),
    tabIndex: 0,
  };
}

export function ScenarioTiles({
  label,
  items,
  value,
  onChange,
  idPrefix = "scenario",
  className,
}: {
  /** Accessible name of the tab list, e.g. "Scenarios". */
  label: string;
  items: ScenarioTileItem[];
  value: string;
  onChange: (id: string) => void;
  idPrefix?: string;
  className?: string;
}) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = items[next].id;
    onChange(id);
    refs.current[id]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} data-scenario-tiles="" className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {items.map((it, i) => {
        const selected = it.id === value;
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            ref={(el) => {
              refs.current[it.id] = el;
            }}
            type="button"
            role="tab"
            id={scenarioTabId(idPrefix, it.id)}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(it.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "flex min-h-20 items-center gap-3 rounded-card border-2 p-4 text-left transition-[border-color,background-color] duration-150",
              selected ? "border-brand bg-brand-tint" : "border-line bg-surface hover:border-brand-line",
            )}
          >
            {Icon && (
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5",
                  selected ? "bg-brand text-white" : "bg-canvas text-ink-2",
                )}
              >
                <Icon aria-hidden />
              </span>
            )}
            <span className="min-w-0">
              <span className={cn("block text-[15px] leading-snug", selected ? "font-bold text-ink" : "font-semibold text-ink")}>{it.title}</span>
              {it.outcome && (
                <span className={cn("mt-0.5 block text-sm font-bold", OUTCOME_TONE[it.tone ?? "neutral"])}>{it.outcome}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
