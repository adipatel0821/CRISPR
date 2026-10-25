"use client";

import Link from "next/link";
import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import type { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";

export function ErrorState({
  error,
  onRetry,
  title = "Something didn't work",
}: {
  error: { message: string; recovery?: string; code?: string; requestId?: string | null } | ApiError;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div role="alert" className="rounded-lg border border-deficit-line bg-deficit-soft p-5 text-sm">
      <p className="flex items-center gap-2 font-semibold text-deficit">
        <AlertTriangle aria-hidden className="size-4" />
        {title}
      </p>
      <p className="mt-1 text-ink">{error.message}</p>
      {error.recovery && <p className="mt-1 text-ink-muted">{error.recovery}</p>}
      {error.requestId && <p className="mt-1 text-xs text-ink-subtle">Reference: {error.requestId}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          <RotateCw aria-hidden /> Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center">
      <Inbox aria-hidden className="mx-auto size-6 text-ink-subtle" />
      <h2 className="mt-3 text-base font-semibold text-ink">{title}</h2>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{children}</div>}
      {action && (
        <Button asChild className="mt-4">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}

export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-4" aria-busy="true">
      <p role="status" aria-live="polite" className="sr-only">
        {label}…
      </p>
      <Skeleton className="h-8 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
