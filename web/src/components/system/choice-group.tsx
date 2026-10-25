"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ChoiceOption {
  /** Value sent to the API (e.g. the enum value). */
  value: string;
  /** Short human label. */
  label: React.ReactNode;
  /** Optional quiet second line. */
  hint?: React.ReactNode;
  disabled?: boolean;
}

export interface ChoiceGroupProps {
  /** Radio group name (unique on the page). */
  name: string;
  /** Group label. Rendered as the fieldset legend (visually hidden when legendHidden). */
  legend: React.ReactNode;
  /** Hide the legend visually when the h1 already asks the question (it stays for screen readers). */
  legendHidden?: boolean;
  options: ChoiceOption[];
  /** Selected value, or null for none. */
  value: string | null;
  onChange: (value: string) => void;
  required?: boolean;
  /** Marks the group invalid (pair with describedBy pointing at the error). */
  invalid?: boolean;
  /** id(s) of hint / error text. */
  describedBy?: string;
  /** Focus the selected option (or the first) on mount. */
  autoFocus?: boolean;
  /** Enter on an option submits the enclosing form (default true). */
  submitOnEnter?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Multiple choice as clear full-width buttons with real radio semantics (native inputs, so arrow keys move
 * between options and the group is announced as a radio group). Enter submits the enclosing form.
 * The selected option shows a filled dot, a stronger border and bolder text: colour is never the only signal.
 */
export function ChoiceGroup({
  name,
  legend,
  legendHidden = false,
  options,
  value,
  onChange,
  required,
  invalid,
  describedBy,
  autoFocus,
  submitOnEnter = true,
  disabled,
  className,
}: ChoiceGroupProps) {
  const firstRef = React.useRef<HTMLInputElement>(null);
  const checkedRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!autoFocus) return;
    (checkedRef.current ?? firstRef.current)?.focus();
    // focus once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!submitOnEnter || e.key !== "Enter") return;
    const form = e.currentTarget.form;
    if (!form) return;
    e.preventDefault();
    // select the focused option first so Enter means "this one"
    if (!e.currentTarget.checked) onChange(e.currentTarget.value);
    // let React commit the selection before submitting
    window.setTimeout(() => form.requestSubmit(), 0);
  }

  return (
    <fieldset
      className={cn("min-w-0", className)}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      disabled={disabled}
    >
      <legend className={cn(legendHidden ? "sr-only" : "mb-3 text-[15px] font-medium text-ink")}>{legend}</legend>
      <div className="flex flex-col gap-2">
        {options.map((o, i) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              data-choice={o.value}
              data-checked={checked ? "" : undefined}
              className={cn(
                "group/choice relative flex min-h-13 cursor-pointer items-center gap-3 rounded-control border bg-surface px-4 py-3 transition-colors duration-150",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                checked ? "border-accent bg-accent-soft" : "border-line-strong hover:border-field-line hover:bg-canvas",
                invalid && !checked && "border-deficit-line",
                o.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                ref={checked ? checkedRef : i === 0 ? firstRef : undefined}
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                disabled={o.disabled}
                required={required}
                onChange={() => onChange(o.value)}
                onKeyDown={onKeyDown}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                  checked ? "border-accent" : "border-field-line",
                )}
              >
                <span className={cn("size-2.5 rounded-full bg-accent transition-opacity duration-150", checked ? "opacity-100" : "opacity-0")} />
              </span>
              <span className="min-w-0">
                <span className={cn("block text-base text-ink", checked && "font-medium")}>{o.label}</span>
                {o.hint && <span className="mt-0.5 block text-sm text-ink-subtle">{o.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
