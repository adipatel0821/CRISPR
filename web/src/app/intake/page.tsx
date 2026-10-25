"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { FactInputBody, QuestionResponseBody } from "@/lib/api-types";
import type { NextQuestionResponse, QuestionCandidate, SessionView } from "@/lib/contracts";
import { useApp, useMounted } from "@/lib/app-context";
import { factLabel } from "@/lib/labels";
import { FactsList } from "@/components/facts-list";
import { QuestionCard } from "@/components/question-card";
import { ReadinessPanel } from "@/components/readiness-panel";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Loaded {
  nq: NextQuestionResponse;
  session: SessionView;
}

export default function IntakePage() {
  const mounted = useMounted();
  const { hasSession } = useApp();
  const [data, setData] = React.useState<Loaded | null>(null);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [refinement, setRefinement] = React.useState<QuestionCandidate | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!hasSession) return;
    let cancelled = false;
    Promise.all([api.nextQuestion(), api.getSession()])
      .then(([nq, session]) => {
        if (!cancelled) {
          setData({ nq, session });
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e : new ApiError("INTERNAL", String(e), 0));
      });
    return () => {
      cancelled = true;
    };
  }, [hasSession, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  async function answer(q: QuestionCandidate, a: Omit<QuestionResponseBody, "question_id" | "fact_key">) {
    setBusy(true);
    setError(null);
    try {
      await api.postAnswer({ question_id: q.question_id, fact_key: q.fact_key, ...a });
      setStatus(
        a.skipped
          ? `Skipped: ${factLabel(q.fact_key)}.`
          : a.declined
            ? `Noted that you'd rather not share ${factLabel(q.fact_key).toLowerCase()}.`
            : `Saved: ${factLabel(q.fact_key)}.`,
      );
      setRefinement(null);
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("INTERNAL", String(e), 0));
    } finally {
      setBusy(false);
    }
  }

  async function editFact(input: FactInputBody) {
    setBusy(true);
    setError(null);
    try {
      await api.postFacts({ facts: [input] });
      setStatus(`Updated: ${factLabel(input.key)}.`);
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("INTERNAL", String(e), 0));
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return <PageSkeleton label="Loading your questions" />;
  if (!hasSession) {
    return (
      <EmptyState title="Start a session first" action={{ href: "/", label: "Go to the start" }}>
        Your answers are stored in a session. Start one on the welcome page — it takes a second.
      </EmptyState>
    );
  }
  if (!data) {
    return error ? <ErrorState error={error} onRetry={reload} /> : <PageSkeleton label="Loading your questions" />;
  }

  const { nq, session } = data;
  const question = refinement ?? nq.question;
  const hasOffer = session.offers.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Your finances</h1>
          <p className="text-sm text-ink-muted">One question at a time. Skip, estimate, or decline anything.</p>
        </div>
        <Button asChild variant={nq.question === null ? "primary" : "secondary"}>
          <Link href="/offer">
            {hasOffer ? "Review the loan offer" : "Continue to the loan offer"} <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          {error && <ErrorState error={error} onRetry={reload} />}

          {question ? (
            <QuestionCard
              key={question.question_id}
              question={question}
              busy={busy}
              onAnswer={(a) => answer(question, a)}
              onCancel={refinement ? () => setRefinement(null) : undefined}
            />
          ) : (
            <Card>
              <CardContent className="space-y-3 p-5 sm:p-6">
                <p className="flex items-center gap-2 text-lg font-semibold text-ink">
                  <CheckCircle2 aria-hidden className="size-5 text-accent" /> That&apos;s everything we need from you
                </p>
                <p className="text-sm text-ink-muted">
                  {hasOffer
                    ? "Your loan offer is in. Head to the offer step to run the analysis."
                    : "Next, add the loan offer you're considering."}
                </p>
                <Button asChild>
                  <Link href="/offer">
                    {hasOffer ? "Go to the offer" : "Add the loan offer"} <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {nq.question === null && !refinement && nq.refinements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Optional: sharpen your results</CardTitle>
                <p className="text-sm text-ink-muted">These never block your results. Each one makes a figure more precise.</p>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-line">
                  {nq.refinements.map((r) => (
                    <li key={r.question_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{r.text}</p>
                        <p className="text-xs text-ink-muted">{r.why_we_ask}</p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => setRefinement(r)}>
                        Answer
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Your answers</CardTitle>
            </CardHeader>
            <CardContent>
              <FactsList facts={session.profile.facts} busy={busy} onEdit={editFact} />
            </CardContent>
          </Card>
        </div>

        <ReadinessPanel readiness={nq.readiness} />
      </div>
    </div>
  );
}
