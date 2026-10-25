"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Car, FileUp, Keyboard, Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { QuestionResponseBody } from "@/lib/api-types";
import type { AnalysisReadiness, LoanOffer, QuestionCandidate, SessionView } from "@/lib/contracts";
import { useApp, useMounted } from "@/lib/app-context";
import { factLabel, termValueText } from "@/lib/labels";
import { RUNNING_COSTS_TEXT } from "@/lib/insights";
import { DocumentFlow } from "@/components/document-flow";
import { OfferForm } from "@/components/offer-form";
import { QuestionCard } from "@/components/question-card";
import { ReadinessDetails } from "@/components/readiness-panel";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Container, EmptyNote, FadeIn, PrimaryAction, SecondaryLink } from "@/components/system";
import { ActionRow, RailFacts, RailProgress, RailSteps, StageLayout, type RailFact } from "@/components/shell";
import { Cheer, OptionTiles } from "@/components/visual";
import { Button } from "@/components/ui/button";
import { DataModeLine } from "@/components/intake/data-mode-line";
import { answerStatus, runningCostsUnknown } from "@/components/intake/model";
import { SavedOffer } from "@/components/offer/saved-offer";
import { keyTerms } from "@/components/offer/model";

const toError = (e: unknown) => (e instanceof ApiError ? e : new ApiError("INTERNAL", String(e), 0));

type Method = "upload" | "manual";

const METHODS = [
  {
    value: "upload" as Method,
    title: "Upload the contract",
    description: "We read the terms from the PDF and show where each one came from. You check them.",
    icon: FileUp,
  },
  {
    value: "manual" as Method,
    title: "Enter the numbers",
    description: "Type the terms from the contract or the dealer's worksheet.",
    icon: Keyboard,
  },
];

const RAIL_LABEL: Record<string, string> = {
  monthly_payment: "Monthly payment",
  apr: "APR",
  term_months: "Term",
  amount_financed: "Amount financed",
  principal: "Principal",
};

/** Loan context for the rail: the saved offer's headline terms (backend values, formatted only). */
function offerFacts(offer: LoanOffer | null): RailFact[] {
  if (!offer) return [];
  return keyTerms(offer).map((t) => ({ label: RAIL_LABEL[t.term_key] ?? t.term_key, value: termValueText(t.value ?? null, t.value_type) }));
}

export default function OfferPage() {
  const router = useRouter();
  const mounted = useMounted();
  const { hasSession, setReport } = useApp();
  const [tab, setTab] = React.useState<Method>("manual");
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
  // True right after an offer is saved on this visit: shows the small yellow "saved" moment above the terms.
  const [justSaved, setJustSaved] = React.useState(false);
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
    setJustSaved(true);
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
  const runHint = blocked
    ? "Answer the question above first."
    : !canRun
      ? "This offer can't be analysed yet. It needs an amount, a rate and a term, on a supported loan type."
      : "We'll show the loan's total cost, your month, your savings, stress tests and what-ifs.";

  return (
    <StageLayout
      stage="Your loan"
      stageNote={showForm ? "Add the offer you were given, then check it." : "Check the terms, then see what they mean for you."}
      progress={<RailProgress value={showForm ? 1 : 2} max={3} label={showForm ? "Step 2 of 3" : "Step 3 of 3"} />}
      context={<RailFacts title="Your loan" facts={offerFacts(offer)} empty="Nothing added yet." />}
      steps={
        <RailSteps
          label="Setup"
          steps={[
            { label: "Your money", href: "/intake", state: "done", icon: Wallet },
            { label: "Your loan", state: "current", icon: Car },
            { label: "Your results", state: "todo" },
          ]}
        />
      }
      mobileSummaryLabel="Your loan"
      actions={
        !showForm ? (
          <ActionRow
            back={{ href: "/intake", label: "Your money" }}
            secondary={
              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  setEditing(true);
                  setJustSaved(false);
                }}
              >
                Change the offer
              </Button>
            }
          >
            {/* While a question is open, its own Continue is the one primary action. */}
            {!blocked && (
              <PrimaryAction disabled={running || !canRun} onClick={run} aria-describedby="run-hint">
                {running ? "Calculating…" : "See my results"}
              </PrimaryAction>
            )}
          </ActionRow>
        ) : undefined
      }
    >
      <div className="space-y-10">
        <div ref={topRef} className="scroll-mt-28">
          <h1 className="text-hero font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
            {showForm ? "Add your loan offer" : "Check your loan"}
          </h1>
          <p className="mt-4 max-w-[var(--measure)] text-lede leading-relaxed text-ink-2">
            {showForm
              ? "Upload the contract and check what we read, or type the numbers yourself."
              : "These are the terms we'll use. When they look right, see what this loan means for you."}
          </p>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {status}
        </p>

        {loadError && <ErrorState error={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}

        {offer && !editing && (
          <FadeIn className="space-y-8">
            {justSaved && <Cheer>Got it. Your offer is saved.</Cheer>}
            <SavedOffer offer={offer} />

            {pending && (
              <section aria-label="Before your results" className="space-y-4 border-t border-line pt-8">
                <p className="text-[15px] font-bold text-brand-strong">Before your results, one more question</p>
                {answerError && <ErrorState error={answerError} />}
                <FadeIn key={pending.question_id}>
                  <QuestionCard question={pending} busy={answering} onAnswer={(a) => answer(pending, a)} />
                </FadeIn>
              </section>
            )}

            <div className="space-y-4">
              <p id="run-hint" className="text-[15px] text-ink-2" aria-live="polite">
                {runHint}
              </p>
              {runError && (
                <div className="space-y-2">
                  <ErrorState error={runError} title="We couldn't run the analysis" onRetry={run} />
                  {runError.code === "INSUFFICIENT_INFORMATION" && <SecondaryLink href="/intake">Go back to your finances</SecondaryLink>}
                </div>
              )}
              {showRunningCosts && !blocked && (
                <EmptyNote action={{ href: "/intake", label: "Add running costs" }}>{RUNNING_COSTS_TEXT}</EmptyNote>
              )}
            </div>
          </FadeIn>
        )}

        {showForm && (
          <div className="space-y-8">
            <OptionTiles<Method>
              name="offer-method"
              legend="How do you want to add the offer?"
              legendHidden
              options={METHODS}
              value={tab}
              onChange={setTab}
              columns={2}
              // The native radio covers its whole tile (transparent), so a click anywhere on the tile, by a person or
              // by a test driver, lands on the radio itself. Keyboard and screen reader behaviour are unchanged.
              className="[&_[data-option-tile]]:min-h-28 [&_[data-option-tile]]:p-6 [&_input]:inset-0 [&_input]:z-10 [&_input]:m-0 [&_input]:size-full [&_input]:cursor-pointer [&_input]:opacity-0 [&_input]:[clip:auto] [&_input]:[clip-path:none]"
            />
            {tab === "manual" ? (
              <FadeIn key="manual">
                <OfferForm onSaved={saved} />
              </FadeIn>
            ) : (
              <FadeIn key="upload" className="space-y-4">
                <DocumentFlow onSaved={saved} onUseManual={() => setTab("manual")} />
                <DataModeLine />
              </FadeIn>
            )}
            {editing && (
              <Button variant="ghost" size="lg" onClick={() => setEditing(false)}>
                Keep the current offer
              </Button>
            )}
          </div>
        )}

        {readiness && (
          <div className="border-t border-line pt-6">
            <ReadinessDetails readiness={readiness} showOfferLink={false} />
          </div>
        )}
      </div>
    </StageLayout>
  );
}
