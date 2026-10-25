import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card surface. `tone` is optional (existing call sites get "default"):
 *  - "default": white with a hairline border (cards on the white page)
 *  - "muted":   soft-gray fill, no border (calm grouped content)
 *  - "plain":   no fill, no border (spacing only)
 */
export function Card({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: "default" | "muted" | "plain" }) {
  return (
    <div
      className={cn(
        "print-card rounded-card",
        tone === "default" && "border border-line bg-surface",
        tone === "muted" && "bg-canvas",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3 sm:p-6 sm:pb-3", className)} {...props} />;
}

export function CardTitle({
  className,
  as: Tag = "h2",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h1" | "h2" | "h3" }) {
  return <Tag className={cn("text-[15px] font-semibold tracking-tight text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-relaxed text-ink-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />;
}
