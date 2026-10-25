import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "tabular h-10 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
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
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-subtle">
        $
      </span>
      <Input inputMode="decimal" autoComplete="off" className={cn("pl-7", className)} {...props} />
    </div>
  );
}

/** Percentage input with a visible "%" suffix. */
export function PercentInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Input inputMode="decimal" autoComplete="off" className={cn("pr-8", className)} {...props} />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-subtle">
        %
      </span>
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-ink", className)} {...props} />;
}

export function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-ink-subtle", className)} {...props} />;
}

export function FieldError({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  if (!children) return null;
  return (
    <p role="alert" className={cn("text-xs font-medium text-deficit", className)} {...props}>
      {children}
    </p>
  );
}
