import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Bright yellow moments (owner request 2026-10-25 11:20 ET: playfulness and trust). Yellow is a FILL only: text on
 * it is black (#111111 on #FFD43B, 13.3:1) and yellow is never used for text on white (1.5:1). Each piece also says
 * what it means in words, so colour never carries meaning alone.
 */

/**
 * Mark: a yellow highlighter stroke behind a few words (the key phrase of a headline). The words stay ink, so the
 * accessible name and the contrast are unchanged. The stroke draws in once; with reduced motion it is simply there.
 */
export function Mark({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span data-mark="" className={cn("dt-mark", className)}>
      {children}
    </span>
  );
}

const CHECK_SIZE = {
  sm: "size-5 [&_svg]:size-3",
  md: "size-6 [&_svg]:size-3.5",
  lg: "size-10 [&_svg]:size-5",
} as const;

/**
 * SunCheck: a black check in a yellow circle, for things that are done (completed steps, saved answers). Decorative:
 * the text next to it says "done" or "saved". `pop` adds a short, calm scale in (none with reduced motion).
 */
export function SunCheck({ size = "md", pop = false, className }: { size?: keyof typeof CHECK_SIZE; pop?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      data-sun-check=""
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-sun text-sun-ink",
        CHECK_SIZE[size],
        pop && "dt-pop",
        className,
      )}
    >
      <Check strokeWidth={3} />
    </span>
  );
}

/**
 * Cheer: the small celebration when a step is finished (the intake is complete, an offer is saved). A yellow check
 * badge and one friendly line. No confetti, no long animation.
 */
export function Cheer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p data-cheer="" className={cn("flex items-center gap-3 text-[16px] font-semibold text-ink", className)}>
      <SunCheck size="lg" pop />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
