"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Car, ChartColumn, Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { FactInputBody, QuestionResponseBody } from "@/lib/api-types";
import type { FinancialFact, NextQuestionResponse, QuestionCandidate, SessionView } from "@/lib/contracts";
import { useApp, useMounted } from "@/lib/app-context";
import { factLabel, factValueText } from "@/lib/labels";
import { EditAnswerPane } from "@/components/facts-list";
import { QuestionCard } from "@/components/question-card";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { RailFacts, RailProgress, RailSteps, StageLayout, type RailFact, type RailStep } from "@/components/shell";
import { Container, FadeIn, PrimaryAction, SecondaryLink } from "@/components/system";
import { IntakeDone, SavedNote } from "@/components/intake/intake-parts";
import { activeFacts, answerStatus, splitRefinements } from "@/components/intake/model";
import { missingFactKeys, railCount, railCountLabel } from "@/components/intake/progress";
import { STAGE_PANE_WORKSPACE } from "@/components/intake/stage-pane";
import { shortFactLabel, valueTypeFor } from "@/components/intake/wording";
import { ReadinessDetails, readinessSummary } from "@/components/readiness-panel";

interface Loaded {
  nq: NextQuestionResponse;
  session: SessionView;
}

const toError = (e: unknown) => (e instanceof ApiError ? e : new ApiError("INTERNAL", String(e), 0));

/** One answer as a rail row: short label, the value the person gave (formatted), an Edit button. */
function railFact(f: FinancialFact, onEdit: (key: string) => void): RailFact {
  const value =
    f.status === "declined" ? (
      <span className="font-medium text-ink-2">Not shared</span>
    ) : (
      <>
        {factValueText(f.value, f.value_type, f.key)}
        {f.status === "estimated" && <span className="ml-1.5 rounded-full bg-caution-soft px-2 py-0.5 text-xs font-bold text-caution">Estimate</span>}
      </>
    );
  return { label: shortFactLabel(f.key, factLabel(f.key)), value, edit: { onClick: () => onEdit(f.key) } };
}

export default function IntakePage() {
  const router = useRouter();
  const mounted = useMounted();
  const { hasSession, setReport, report } = useApp();
  const [data, setData] = React.useState<Loaded | null>(null);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [refinement, setRefinement] = React.useState<QuestionCandidate | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [runError, setRunError] = React.useState<ApiError | null>(null);

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
        if (!cancelled) setError(toError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [hasSession, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  const shownId = editing ?? refinement?.question_id ?? data?.nq.question?.question_id ?? "done";

  // A new step starts at the top of the page (small screens scroll; the docked action row stays put).
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.scrollY > 0) window.scrollTo({ top: 0 });
  }, [shownId]);

  async function answer(q: QuestionCandidate, a: Omit<QuestionResponseBody, "question_id" | "fact_key">) {
    setBusy(true);
    setError(null);
    try {
      await api.postAnswer({ question_id: q.question_id, fact_key: q.fact_key, ...a });
      setStatus(answerStatus(factLabel(q.fact_key), a.skipped ? "skipped" : a.declined ? "declined" : "saved"));
      setRefinement(null);
      reload();
    } catch (e) {
      setError(toError(e));
    } finally {
      setBusy(false);
    }
  }

  async function editFact(input: FactInputBody) {
    setBusy(true);
    setError(null);
    try {
      await api.postFacts({ facts: [input] });
      setStatus(answerStatus(factLabel(input.key), "updated"));
      setEditing(null);
      reload();
    } catch (e) {
      setError(toError(e));
    } finally {
      setBusy(false);
    }
  }

  function openRefinement(r: QuestionCandidate) {
    setEditing(null);
    setRefinement(r);
  }

  function openEdit(key: string) {
    setRefinement(null);
    setEditing(key);
  }

  if (!mounted) return <PageSkeleton label="Loading your questions" />;
  if (!hasSession) {
    return (
      <Container width="reading">
        <EmptyState title="Start a session first" action={{ href: "/", label: "Go to the start" }}>
          Your answers are stored in a session. Start one on the welcome page. It takes a second.
        </EmptyState>
      </Container>
    );
  }
  if (!data) {
    return (
      <Container width="reading">
        {error ? <ErrorState error={error} onRetry={reload} /> : <PageSkeleton label="Loading your questions" />}
      </Container>
    );
  }

  const { nq, session } = data;
  const question = refinement ?? nq.question;
  const offer = session.offers[session.offers.length - 1] ?? null;
  const offerReady = !!offer && offer.ready_for_calculation && offer.unsupported_features.length === 0;
  const answers = activeFacts(session.profile.facts);
  const count = railCount(session.profile.facts, nq.readiness);
  const countLabel = railCountLabel(count);
  const { runningCosts, rest } = splitRefinements(nq.refinements, session.profile.facts);
  // With no blocking question left, answers still missing were skipped: list them so they can be added.
  const skippedKeys = question ? [] : missingFactKeys(session.profile.facts, nq.readiness);
  const skipped = skippedKeys.map((k) => ({ key: k, label: shortFactLabel(k, factLabel(k)) }));
  const editFactObj = editing
    ? (answers.find((f) => f.key === editing) ??
      (skippedKeys.includes(editing)
        ? ({ key: editing, value: null, value_type: valueTypeFor(editing), status: "missing" } as unknown as FinancialFact)
        : null))
    : null;

  async function run() {
    if (!offer) return;
    setRunning(true);
    setRunError(null);
    try {
      const rep = await api.runAnalysis({ offer_id: offer.offer_id });
      setReport(rep);
      router.push("/dashboard");
    } catch (e) {
      setRunError(toError(e));
      setRunning(false);
    }
  }

  const primary = offerReady ? (
    <PrimaryAction onClick={run} disabled={running}>
      {running ? "Calculating" : "See my results"}
    </PrimaryAction>
  ) : (
    <PrimaryAction href="/offer">{offer ? "Review the loan offer" : "Continue to the loan offer"}</PrimaryAction>
  );

  const steps: RailStep[] = [
    { label: "Your money", state: "current", icon: Wallet },
    { label: "Your loan", href: "/offer", state: offer ? "done" : "todo", icon: Car, detail: offer ? "Offer added" : "Add it any time" },
    {
      label: "Results",
      href: report ? "/dashboard" : undefined,
      state: report ? "done" : "todo",
      icon: ChartColumn,
      detail: nq.readiness.length ? readinessSummary(nq.readiness) : undefined,
    },
  ];
  const railRows: RailFact[] = [
    ...answers.map((f) => railFact(f, openEdit)),
    ...skipped.map((s) => ({
      label: s.label,
      value: <span className="font-medium text-ink-2">Skipped</span>,
      edit: { onClick: () => openEdit(s.key) },
    })),
  ];

  const lead = (
    <>
      <SavedNote text={status} />
      {error && (
        <div className="mb-6">
          <ErrorState error={error} onRetry={reload} />
        </div>
      )}
    </>
  );

  return (
    <StageLayout
      stage="Your money"
      stageNote="Your answers stay here. Change any of them whenever you like."
      progress={
        count.answered + count.remaining > 0 ? (
          <RailProgress value={count.answered} max={count.answered + count.remaining} label={countLabel} />
        ) : undefined
      }
      context={
        <RailFacts
          title="Your answers"
          facts={railRows}
          empty="Your answers will show up here as you go."
        />
      }
      steps={<RailSteps steps={steps} label="Your progress" />}
      mobileSummaryLabel={answers.length ? `Your answers (${answers.length})` : "Your answers"}
      workspaceClassName={STAGE_PANE_WORKSPACE}
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      {editFactObj ? (
        <FadeIn key={`edit-${editFactObj.key}`} className="flex flex-1 flex-col">
          <EditAnswerPane fact={editFactObj} busy={busy} onSave={editFact} onCancel={() => setEditing(null)} lead={lead} />
        </FadeIn>
      ) : question ? (
        <FadeIn key={question.question_id} className="flex flex-1 flex-col">
          <QuestionCard
            variant="stage"
            question={question}
            busy={busy}
            onAnswer={(a) => answer(question, a)}
            onCancel={refinement ? () => setRefinement(null) : undefined}
            lead={lead}
          />
        </FadeIn>
      ) : (
        <FadeIn key="done" className="flex flex-1 flex-col">
          <IntakeDone
            hasOffer={!!offer}
            primary={primary}
            runningCosts={runningCosts}
            refinements={rest}
            onRefine={openRefinement}
            skipped={skipped}
            onAdd={openEdit}
            readiness={<ReadinessDetails readiness={nq.readiness} showOfferLink={!offer} />}
            lead={lead}
            after={
              runError && (
                <div className="space-y-2">
                  <ErrorState error={runError} title="We couldn't run the analysis" onRetry={run} />
                  <SecondaryLink href="/offer">Go to the loan offer</SecondaryLink>
                </div>
              )
            }
          />
        </FadeIn>
      )}
    </StageLayout>
  );
}
