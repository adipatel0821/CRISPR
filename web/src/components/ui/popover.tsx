"use client";

import * as React from "react";
import { Popover as P } from "radix-ui";
import { cn } from "@/lib/utils";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "z-50 w-[min(22rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-4 text-sm leading-relaxed text-ink shadow-soft",
          "origin-[var(--radix-popover-content-transform-origin)] data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      />
    </P.Portal>
  );
}
