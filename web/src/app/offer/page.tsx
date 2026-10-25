"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { QuestionResponseBody } from "@/lib/api-types";
import type { AnalysisReadiness, LoanOffer, QuestionCandidate, SessionView } from "@/lib/contracts";
import { useApp, useMounted } from "@/lib/app-context";
import { factLabel } from "@/lib/labels";
import { RUNNING_COSTS_TEXT } from "@/lib/insights";
import { DocumentFlow } from "@/components/document-flow";
import { OfferForm } from "@/components/offer-form";
import { QuestionCard } from "@/components/question-card";
import { ReadinessDetails } from "@/components/readiness-panel";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Container, EmptyNote, FadeIn, PageIntro, PrimaryAction, SecondaryLink } from "@/components/system";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { DataModeLine } from "@/components/intake/data-mode-line";
import { answerStatus, runningCostsUnknown } from "@/components/intake/model";
import { SavedOffer } from "@/components/offer/saved-offer";

const toError = (e: unknown) => (e instanceof ApiError ? e : new ApiError("INTERNAL", String(e), 0));

export default function OfferPage() {
  const router = useRouter();
  const mounted = useMounted();
  const { hasSession, setReport } = useApp();
  const [tab, setTab] = React.useState("manual");
  const [offer, setOffer] = React.useState<LoanOffer | null>(null);
  const [session, setSession] = React.useState<SessionView | null>(null);
  const [readiness, setReadiness] = React.useState<AnalysisReadiness[] | null>(null);
  const [pending, setPending] = React.useState<QuestionCandidate | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<ApiError | null>(null);
  const [runError, setRunError] = React.useState<ApiError | null>(null);
  const [answerError, setAnswerError] = React.useState<ApiError | null>(null);
  const [running, setRunning] = React.useState(false);
  const [answering, setAnswering] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [reloadKey, setReloadKey] = React.useState(0);
  const topRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!hasSession) return;
    let cancelled = false;
    Promise.all([api.getSession(), api.readiness(), api.nextQuestion()])
      .then(([s, r, nq]) => {
        if (cancelled) return;
        const existing = s.offers[s.offers.length - 1] ?? null;
        setOffer((o) => o ?? existing);
        setSession(s);
        setReadiness(r);
        // A question still open once the offer is in (e.g. where the down payment comes from).
        setPending(s.offers.length > 0 ? nq.question : null);
        setLoadError(null);
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(toError(e));
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasSession, reloadKey]);

  function saved(o: LoanOffer) {
    setOffer(o);
    setEditing(false);
    setRunError(null);
    setStatus(`Saved: ${o.label}.`);
    setReloadKey((k) => k + 1);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  async function answer(q: QuestionCandidate, a: Omit<QuestionResponseBody, "question_id" | "fact_key">) {
    setAnswering(true);
    setAnswerError(null);
    try {
      await api.postAnswer({ question_id: q.question_id, fact_key: q.fact_key, ...a });
      setStatus(answerStatus(factLabel(q.fact_key), a.skipped ? "skipped" : a.declined ? "declined" : "saved"));
      setReloadKey((k) => k + 1);
    } catch (e) {
      setAnswerError(toError(e));
    } finally {
      setAnswering(false);
    }
  }

  async function run() {
    if (!offer) return;
    setRunning(true);
    setRunError(null);
    try {
      const report = await api.runAnalysis({ offer_id: offer.offer_id });
      setReport(report);
      router.push("/dashboard");
    } catch (e) {
      const err = toError(e);
      setRunError(err);
      const d = err.details as { readiness?: AnalysisReadiness[] } | null;
      if (d && Array.isArray(d.readiness)) setReadiness(d.readiness);
      setRunning(false);
    }
  }

  if (!mounted) return <PageSkeleton label="Loading the offer step" />;
  if (!hasSession) {
    return (
      <Container width="reading">
        <EmptyState title="Start a session first" action={{ href: "/", label: "Go to the start" }}>
          Your loan offer is stored in a session together with your answers.
        </EmptyState>
      </Container>
    );
  }
  if (!loaded) {
    return (
      <Container width="reading">
        <PageSkeleton label="Loading the offer step" />
      </Container>
    );
  }

  const showForm = !offer || editing;
  const canRun = !!offer && offer.ready_for_calculation && offer.unsupported_features.length === 0;
  const blocked = !!pending;
  const showRunningCosts = !!session && runningCostsUnknown(session.profile.facts);

  return (
    <Container width="reading" className="max-w-[42.5rem] space-y-8">
      <div ref={topRef} className="scroll-mt-28">
      <PageIntro
        title={showForm ? "Add your loan offer" : "Your loan offer"}
        lede={
          showForm
            ? "Type the terms from the contract, or upload it and check each value we read."
            : "Check the terms below. When they look right, see what this loan means for you."
        }
      />
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {loadError && <ErrorState error={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}

      {offer && !editing && (
        <FadeIn className="space-y-8">
          <SavedOffer offer={offer} />

          {pending && (
            <section aria-label="One more question" className="space-y-4 border-t border-line pt-8">
              <p className="text-[13px] font-medium text-accent-strong">One more question before your results</p>
              {answerError && <ErrorState error={answerError} />}
              <FadeIn key={pending.question_id}>
                <QuestionCard question={pending} busy={answering} onAnswer={(a) => answer(pending, a)} />
              </FadeIn>
            </section>
          )}

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <PrimaryAction
                disabled={running || !canRun || blocked}
                onClick={run}
                aria-describedby="run-hint"
              >
                {running ? "Calculating…" : "See my results"}
              </PrimaryAction>
              <Button variant="ghost" size="lg" onClick={() => setEditing(true)}>
                Change the offer
              </Button>
            </div>
            <p id="run-hint" className="text-[13px] text-ink-subtle" aria-live="polite">
              {blocked
                ? "Answer the question above first."
                : !canRun
                  ? "This offer can't be analysed yet — it needs an amount, a rate and a term, on a supported loan type."
                  : "We'll show the loan's total cost, your month, your savings, stress tests and what-ifs."}
            </p>
            {runError && (
              <div className="space-y-2">
                <ErrorState error={runError} title="We couldn't run the analysis" onRetry={run} />
                {runError.code === "INSUFFICIENT_INFORMATION" && (
                  <SecondaryLink href="/intake">Go back to your finances</SecondaryLink>
                )}
              </div>
            )}
            {showRunningCosts && !blocked && (
              <EmptyNote action={{ href: "/intake", label: "Add running costs" }}>{RUNNING_COSTS_TEXT}</EmptyNote>
            )}
          </div>
        </FadeIn>
      )}

      {showForm && (
        <Tabs value={tab} onValueChange={setTab} className="space-y-7">
          <TabsList aria-label="How to add the offer">
            <TabsTrigger value="manual">Enter terms</TabsTrigger>
            <TabsTrigger value="upload">Upload contract</TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className="animate-fade-in motion-reduce:animate-none">
            <OfferForm onSaved={saved} />
          </TabsContent>
          <TabsContent value="upload" className="animate-fade-in space-y-4 motion-reduce:animate-none">
            <DocumentFlow onSaved={saved} onUseManual={() => setTab("manual")} />
            <DataModeLine />
          </TabsContent>
          {editing && (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Keep the current offer
            </Button>
          )}
        </Tabs>
      )}

      {readiness && (
        <div className="border-t border-line pt-6">
          <ReadinessDetails readiness={readiness} showOfferLink={false} />
        </div>
      )}
    </Container>
  );
}
