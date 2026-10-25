import * as React from "react";
import { cn } from "@/lib/utils";

/** Text input: 16 px text (no zoom on iOS), visible 3:1 boundary, 8 px radius. */
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "tabular h-12 w-full min-w-0 rounded-control border border-field-line bg-surface px-3.5 text-base text-ink placeholder:text-ink-subtle transition-[border-color] duration-150 ease-out",
        "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
        "aria-[invalid=true]:border-deficit aria-[invalid=true]:bg-deficit-soft disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

/** Currency input with a visible "$" prefix and a decimal keypad on mobile. */
export function CurrencyInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-base text-ink-subtle">
        $
      </span>
      <Input inputMode="decimal" autoComplete="off" className={cn("pl-8", className)} {...props} />
    </div>
  );
}

/** Percentage input with a visible "%" suffix. */
export function PercentInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Input inputMode="decimal" autoComplete="off" className={cn("pr-9", className)} {...props} />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-base text-ink-subtle">
        %
      </span>
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[15px] font-medium text-ink", className)} {...props} />;
}

export function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-relaxed text-ink-subtle", className)} {...props} />;
}

/** Validation message shown right under its input. */
export function FieldError({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  if (!children) return null;
  return (
    <p role="alert" className={cn("text-sm font-medium text-deficit", className)} {...props}>
      {children}
    </p>
  );
}
