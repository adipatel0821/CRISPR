"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileSearch, ListChecks, Scale } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { store } from "@/lib/session-store";
import { DataModeBanner } from "@/components/banners";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/misc";

const STEPS = [
  {
    icon: ListChecks,
    title: "Tell us about your month",
    body: "Take-home pay, essential bills, debts and savings — one question at a time. Skip or estimate anything.",
  },
  {
    icon: FileSearch,
    title: "Add the loan offer",
    body: "Type the terms from the contract, or upload a sample contract and check each value we read.",
  },
  {
    icon: Scale,
    title: "See the real cost and the trade-offs",
    body: "The total cost, what's left each month, your savings after the down payment, stress tests and what-ifs.",
  },
];

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
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        <div className="space-y-5">
          <p className="text-sm font-medium text-accent">Car loan decision check</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            Understand a car loan&apos;s real cost — and what it does to your month and your savings.
          </h1>
          <p className="max-w-xl text-base text-ink-muted">
            DecisionTwin turns your household numbers and a loan offer into the figures that matter: the total you&apos;d
            pay, what&apos;s left each month, how long your savings would last, and how other terms compare. Every number
            shows where it came from.
          </p>
          <ul className="flex flex-wrap gap-2 text-xs text-ink-muted">
            <li className="rounded-full border border-line bg-surface px-3 py-1">Deterministic arithmetic, no guesses</li>
            <li className="rounded-full border border-line bg-surface px-3 py-1">Every figure traceable to a source</li>
            <li className="rounded-full border border-line bg-surface px-3 py-1">Not advice, not a credit score</li>
          </ul>
        </div>

        <Card>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-ink">Before you start</h2>
            <DataModeBanner />
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>• Your answers are kept only for this browser session. You can delete them at any time.</li>
              <li>• Numbers you type are labelled “You told us”. Nothing you enter is described as verified.</li>
              <li>• Stress tests are illustrative scenarios, not forecasts.</li>
            </ul>
            <div className="flex items-start gap-3">
              <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
              <label htmlFor="consent" className="text-sm text-ink">
                I understand this is a calculation tool, not financial advice, and I agree to my answers being stored for
                this session.
              </label>
            </div>
            <Button size="lg" className="w-full" disabled={!consent || busy} onClick={start} aria-describedby="start-hint">
              {busy ? "Starting…" : "Start"} <ArrowRight aria-hidden />
            </Button>
            <p id="start-hint" className="text-xs text-ink-subtle" aria-live="polite">
              {consent ? "Takes about 3 minutes." : "Tick the box above to start."}
            </p>
            {hasSession && (
              <p className="text-xs text-ink-muted">
                You have a session in progress.{" "}
                <button className="font-medium text-accent underline-offset-4 hover:underline" onClick={() => router.push("/intake")}>
                  Continue where you left off
                </button>
                . Starting again creates a new session.
              </p>
            )}
            {error && <ErrorState error={error} onRetry={start} />}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="how" className="space-y-4">
        <h2 id="how" className="text-lg font-semibold text-ink">
          How it works
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full">
                <CardContent className="space-y-2 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-md bg-accent-soft text-accent">
                      <s.icon aria-hidden className="size-4" />
                    </span>
                    <span className="text-xs font-medium text-ink-subtle">Step {i + 1}</span>
                  </div>
                  <h3 className="font-semibold text-ink">{s.title}</h3>
                  <p className="text-sm text-ink-muted">{s.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
