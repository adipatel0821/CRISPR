"use client";

import { ErrorState } from "@/components/states";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="This page hit an error"
      error={{
        message: error.message || "An unexpected error occurred.",
        recovery: "Try again. If it keeps happening, start over from the welcome page.",
        requestId: error.digest ?? null,
      }}
      onRetry={reset}
    />
  );
}
