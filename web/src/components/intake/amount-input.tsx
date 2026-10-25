"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A large, comfortable amount field. Unlike the foundation's BigCurrencyInput it keeps exactly what the person
 * typed (so "-5" or "abc" reach validation and get a message under the field instead of being silently
 * rewritten). On blur, a valid amount is tidied with thousands separators (string formatting only).
 */
export const AmountInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size" | "prefix"> & {
    id: string;
    value: string;
    onValueChange: (text: string) => void;
    /** Show a "$" before the number (default true). */
    currency?: boolean;
    /** Text after the number, e.g. "a month". */
    suffix?: React.ReactNode;
    invalid?: boolean;
    /** Compact width for counts. */
    narrow?: boolean;
  }
>(function AmountInput({ id, value, onValueChange, currency = true, suffix, invalid, narrow, className, onBlur, ...rest }, ref) {
  return (
    <div
      data-amount-input=""
      className={cn(
        "flex w-full items-center gap-2 rounded-card border-2 bg-surface px-5 transition-[border-color,box-shadow] duration-150",
        "focus-within:border-brand focus-within:shadow-[0_0_0_4px_var(--color-brand-tint)]",
        narrow ? "max-w-[14rem]" : "max-w-[30rem]",
        invalid ? "border-shortfall" : "border-line-strong",
        className,
      )}
    >
      {currency && (
        <span aria-hidden className="text-[2rem] font-bold text-ink-3 sm:text-[2.5rem]">
          $
        </span>
      )}
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={(e) => {
          // Tidy a valid amount ("4200.5" -> "4,200.5"); anything else stays as typed for the validator.
          if (currency && /^\$?\s*\d[\d,]*(\.\d{0,2})?$/.test(value.trim())) {
            const t = value.trim().replace(/^\$\s*/, "").replace(/,/g, "");
            const [i, d] = t.split(".");
            const grouped = i.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            onValueChange(d === undefined ? grouped : `${grouped}.${d}`);
          }
          onBlur?.(e);
        }}
        className="figure h-20 w-full min-w-0 bg-transparent text-[2rem] font-extrabold tracking-[-0.02em] text-ink placeholder:font-semibold placeholder:text-ink-3 sm:h-24 sm:text-[2.75rem]"
        // The field's frame shows focus (blue border + ring via focus-within); the global outline would double it.
        style={{ outline: "none" }}
        {...rest}
      />
      {suffix && <span className="shrink-0 whitespace-nowrap text-[15px] font-semibold text-ink-2">{suffix}</span>}
    </div>
  );
});
