"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { store } from "@/lib/session-store";
import { ErrorState } from "@/components/states";
import { Container, FadeIn, PrimaryAction } from "@/components/system";
import { Checkbox } from "@/components/ui/misc";
import { DataModeLine } from "@/components/intake/data-mode-line";

const STEPS = ["Tell us about your month", "Add the loan offer", "See the real cost and trade-offs"];

export default function WelcomePage() {
  const router = useRouter();
  const { refreshSession, setReport, hasSession } = useApp();
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);

  async function start() {
    if (!consent) return;
    setBusy(true);
    setError(null);
    try {
      await api.createSession({});
      store.setConsent(true);
      setReport(null);
      refreshSession();
      router.push("/intake");
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("INTERNAL", String(e), 0));
      setBusy(false);
    }
  }

  return (
    <Container width="reading" className="max-w-[40rem] pt-4 sm:pt-12">
      <FadeIn className="space-y-6">
        <p className="text-[13px] font-medium text-accent-strong">Car loan decision check</p>
        <h1 className="text-balance text-[2rem] font-semibold leading-[1.12] tracking-[-0.025em] text-ink sm:text-[2.75rem]">
          See what a car loan really costs — and what it does to your month.
        </h1>
        <p className="max-w-[34rem] text-pretty text-lede text-ink-muted">
          Answer a few questions, add the offer, and get the total cost, what&apos;s left each month and your savings
          after the down payment. Every number shows where it came from.
        </p>
      </FadeIn>

      <FadeIn step={1} as="section" aria-label="How it works" className="mt-8">
        <ol className="flex flex-col gap-2.5 sm:flex-row sm:gap-6">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2.5 text-sm text-ink-muted">
              <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-medium text-ink">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </FadeIn>

      <FadeIn step={2} className="mt-10 space-y-5 rounded-card border border-line bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex items-start gap-3">
          <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
          <label htmlFor="consent" className="text-sm leading-relaxed text-ink">
            I understand this is a calculation tool, not financial advice, and I agree to my answers being stored for
            this session.
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <PrimaryAction disabled={!consent || busy} onClick={start} aria-describedby="start-hint">
            {busy ? "Starting…" : "Start"}
          </PrimaryAction>
          <p id="start-hint" className="text-center text-[13px] text-ink-subtle sm:text-left" aria-live="polite">
            {consent ? "Takes about 3 minutes." : "Tick the box above to start."}
          </p>
        </div>
        {hasSession && (
          <p className="text-[13px] text-ink-muted">
            You have a session in progress.{" "}
            <button
              className="rounded-sm font-medium text-accent-strong underline-offset-4 hover:underline"
              onClick={() => router.push("/intake")}
            >
              Continue where you left off
            </button>
            . Starting again creates a new session.
          </p>
        )}
        {error && <ErrorState error={error} onRetry={start} />}
      </FadeIn>

      <FadeIn step={3} className="mt-5">
        <DataModeLine />
      </FadeIn>
    </Container>
  );
}
