"use client";

import { AlertCircle } from "lucide-react";
import type { ApiError } from "@/lib/api";
import { plain } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { PrimaryAction } from "@/components/system/primitives";
import { ScreenSkeleton } from "@/components/system/skeleton";

/**
 * Something failed: what happened, what to do, and a retry when one helps. Backend messages pass through the
 * display normaliser. The reference id helps support and stays quiet.
 */
export function ErrorState({
  error,
  onRetry,
  title = "That didn't work",
}: {
  error: { message: string; recovery?: string; code?: string; requestId?: string | null } | ApiError;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div role="alert" className="rounded-card bg-deficit-soft px-5 py-4 text-[15px] leading-relaxed">
      <p className="flex items-center gap-2 font-medium text-deficit">
        <AlertCircle aria-hidden className="size-4 shrink-0" />
        {title}
      </p>
      <p className="mt-1 text-ink">{plain(error.message)}</p>
      {error.recovery && <p className="mt-0.5 text-ink-muted">{plain(error.recovery)}</p>}
      {error.requestId && <p className="mt-1 text-sm text-ink-subtle">Reference {error.requestId}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Nothing to show yet: a plain heading, one sentence and the one way forward (the state's primary action).
 */
export function EmptyState({
  title,
  children,
  action,
  headingLevel: H = "h1",
}: {
  title: string;
  children?: React.ReactNode;
  action?: { href: string; label: string };
  /** "h1" (default) when the empty state is the whole screen; "h2" inside a screen that has its own h1. */
  headingLevel?: "h1" | "h2";
}) {
  return (
    <div className="flex flex-col items-start gap-5 py-6" data-empty-state="">
      <div className="space-y-1.5">
        <H
          className={
            H === "h1"
              ? "text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-title"
              : "text-xl font-semibold tracking-[-0.015em] text-ink"
          }
        >
          {title}
        </H>
        {children && <div className="max-w-md text-pretty text-base leading-relaxed text-ink-muted">{children}</div>}
      </div>
      {action && <PrimaryAction href={action.href}>{action.label}</PrimaryAction>}
    </div>
  );
}

/** Loading a screen: the shape of a screen (heading, figure, action), announced once. */
export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return <ScreenSkeleton label={label} />;
}
