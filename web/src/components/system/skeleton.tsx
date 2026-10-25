import * as React from "react";
import { cn } from "@/lib/utils";

/** One placeholder block (slow pulse; static with reduced motion). Hidden from assistive tech. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("dt-skeleton h-4", className)} {...props} />;
}

/** A few lines of placeholder text; the last line is shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  );
}

/**
 * Placeholder for a whole screen in the single column: heading, one key figure, a sentence and the action.
 * Announces `label` once through a polite status region.
 */
export function ScreenSkeleton({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-8", className)} aria-busy="true" data-skeleton="">
      <p role="status" aria-live="polite" className="sr-only">
        {label}
      </p>
      <div className="space-y-3">
        <Skeleton className="h-9 w-4/5 sm:w-3/5" />
        <Skeleton className="h-5 w-2/3 sm:w-1/2" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-11 w-56" />
        <SkeletonText lines={2} className="max-w-md" />
      </div>
      <Skeleton className="h-12 w-full rounded-control sm:w-44" />
    </div>
  );
}
