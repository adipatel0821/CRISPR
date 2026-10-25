import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-sm font-medium leading-5 whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "bg-canvas text-ink-muted",
        accent: "bg-accent-soft text-accent-strong",
        info: "bg-info-soft text-info",
        deficit: "bg-deficit-soft text-deficit",
        outline: "border border-line-strong bg-surface text-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
