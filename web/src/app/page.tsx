"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Car, ChartColumn, Clock3, Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { store } from "@/lib/session-store";
import { ErrorState } from "@/components/states";
import { FadeIn, PrimaryAction, TrustStrip } from "@/components/system";
import { Checkbox } from "@/components/ui/misc";
import { Mark, WelcomeTwin } from "@/components/visual";
import { DataModeLine } from "@/components/intake/data-mode-line";

const STEPS = [
  { icon: Wallet, title: "Your money", text: "Take-home pay, essentials, savings" },
  { icon: Car, title: "Your loan", text: "Upload the contract or type the terms" },
  { icon: ChartColumn, title: "Your results", text: "Cost, monthly room, savings, what ifs" },
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
    <div data-welcome="" className="flex flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14 lg:px-[var(--workspace-pad)] lg:py-16">
      <div className="grid flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        <div className="min-w-0 max-w-[40rem] space-y-8">
          <FadeIn className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-4 py-1.5 text-[15px] font-bold text-brand-strong">
              <Car aria-hidden className="size-4" />
              Car loan decision check
            </p>
            <h1 className="text-balance text-hero font-extrabold text-ink">
              See what a car loan does to <Mark>your month</Mark>.
            </h1>
            <p className="max-w-[34rem] text-pretty text-lede text-ink-2">
              Add your monthly numbers and the loan offer. You get the full cost, what you keep each month and what is
              left in savings, with the source of every figure.
            </p>
          </FadeIn>

          <FadeIn step={1} className="space-y-5">
            <div className="flex items-start gap-3">
              <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-1" />
              <label htmlFor="consent" className="text-[15px] leading-relaxed text-ink">
                I understand this is a calculation tool, not financial advice, and I agree to my answers being stored
                for this session.
              </label>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <PrimaryAction disabled={!consent || busy} onClick={start} aria-describedby="start-hint">
                {busy ? "Starting" : "Start"}
              </PrimaryAction>
              <p
                id="start-hint"
                className="flex items-center justify-center gap-2 text-[15px] text-ink-2 sm:justify-start"
                aria-live="polite"
              >
                <Clock3 aria-hidden className="size-4 shrink-0" />
                {consent ? "Takes about 3 minutes." : "Tick the box above to start."}
              </p>
            </div>
            {hasSession && (
              <p className="text-[15px] text-ink-2">
                You have a session in progress.{" "}
                <button type="button" className="dt-link font-semibold" onClick={() => router.push("/intake")}>
                  Continue where you left off
                </button>
                . Starting again creates a new session.
              </p>
            )}
            {error && <ErrorState error={error} onRetry={start} />}
          </FadeIn>

          <FadeIn step={2} className="space-y-5">
            <TrustStrip />
            <DataModeLine />
          </FadeIn>
        </div>

        <FadeIn step={1} className="relative mx-auto w-full max-w-[22rem] sm:max-w-[30rem] lg:max-w-[44rem]">
          <WelcomeTwin />
        </FadeIn>
      </div>

      <FadeIn step={3} as="section" aria-label="The three steps" className="mt-12 border-t border-line pt-8 lg:mt-14">
        <ol className="grid gap-5 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-4">
              <span className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand-strong">
                <s.icon aria-hidden className="size-6" />
                <span className="tabular absolute -right-1 -top-1 inline-flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {i + 1}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-bold text-ink">{s.title}</span>
                <span className="block text-[15px] text-ink-2">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </FadeIn>
    </div>
  );
}
