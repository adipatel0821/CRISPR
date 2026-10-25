"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { FactInputBody, QuestionResponseBody } from "@/lib/api-types";
import type { NextQuestionResponse, QuestionCandidate, SessionView } from "@/lib/contracts";
import { useApp, useMounted } from "@/lib/app-context";
import { factLabel } from "@/lib/labels";
import { FactsList } from "@/components/facts-list";
import { QuestionCard } from "@/components/question-card";
import { ReadinessDetails } from "@/components/readiness-panel";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Container, Disclosure, FadeIn, PrimaryAction, SecondaryLink } from "@/components/system";
import { IntakeDone, IntakeProgressLine, SavedNote } from "@/components/intake/intake-parts";
import { activeFacts, answerStatus, intakeProgress, splitRefinements } from "@/components/intake/model";

interface Loaded {
  nq: NextQuestionResponse;
  session: SessionView;
}

const toError = (e: unknown) => (e instanceof ApiError ? e : new ApiError("INTERNAL", String(e), 0));

export default function IntakePage() {
  const router = useRouter();
  const mounted = useMounted();
  const { hasSession, setReport } = useApp();
  const [data, setData] = React.useState<Loaded | null>(null);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [refinement, setRefinement] = React.useState<QuestionCandidate | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [runError, setRunError] = React.useState<ApiError | null>(null);
  const questionRef = React.useRef<HTMLDivElement>(null);

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
      reload();
    } catch (e) {
      setError(toError(e));
    } finally {
      setBusy(false);
    }
  }

  function openRefinement(r: QuestionCandidate) {
    setRefinement(r);
    requestAnimationFrame(() => questionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  if (!mounted) return <PageSkeleton label="Loading your questions" />;
  if (!hasSession) {
    return (
      <Container width="reading">
        <EmptyState title="Start a session first" action={{ href: "/", label: "Go to the start" }}>
          Your answers are stored in a session. Start one on the welcome page — it takes a second.
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
  const progress = intakeProgress(session.profile.facts, nq.readiness);
  const answers = activeFacts(session.profile.facts);
  const { runningCosts, rest } = splitRefinements(nq.refinements, session.profile.facts);

  async function run() {
    if (!offer) return;
    setRunning(true);
    setRunError(null);
    try {
      const report = await api.runAnalysis({ offer_id: offer.offer_id });
      setReport(report);
      router.push("/dashboard");
    } catch (e) {
      setRunError(toError(e));
      setRunning(false);
    }
  }

  const primary = offerReady ? (
    <PrimaryAction onClick={run} disabled={running}>
      {running ? "Calculating…" : "See my results"}
    </PrimaryAction>
  ) : (
    <PrimaryAction href="/offer">{offer ? "Review the loan offer" : "Continue to the loan offer"}</PrimaryAction>
  );

  return (
    <Container width="reading" className="max-w-[42.5rem] space-y-10">
      <div className="space-y-3">
        <h1 className="text-[13px] font-medium text-ink-subtle">Your finances</h1>
        <IntakeProgressLine progress={progress} />
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div ref={questionRef} className="scroll-mt-28 space-y-4">
        <SavedNote text={status} />
        {error && <ErrorState error={error} onRetry={reload} />}
        {question ? (
          <FadeIn key={question.question_id}>
            <QuestionCard
              question={question}
              busy={busy}
              onAnswer={(a) => answer(question, a)}
              onCancel={refinement ? () => setRefinement(null) : undefined}
            />
          </FadeIn>
        ) : (
          <FadeIn>
            <IntakeDone
              hasOffer={!!offer}
              primary={primary}
              runningCosts={runningCosts}
              refinements={rest}
              onRefine={openRefinement}
            />
            {runError && (
              <div className="mt-4 space-y-2">
                <ErrorState error={runError} title="We couldn't run the analysis" onRetry={run} />
                <SecondaryLink href="/offer">Go to the loan offer</SecondaryLink>
              </div>
            )}
          </FadeIn>
        )}
      </div>

      <div className="space-y-3 border-t border-line pt-8">
        <Disclosure variant="card" summary={`Your answers (${answers.length})`} meta="Edit anytime">
          <FactsList facts={session.profile.facts} busy={busy} onEdit={editFact} />
        </Disclosure>
        <ReadinessDetails readiness={nq.readiness} />
        {question && !refinement && (
          <p className="px-1 pt-2 text-[13px] text-ink-subtle">
            Already have the loan offer?{" "}
            <SecondaryLink href="/offer" className="text-[13px]">
              Add it now
            </SecondaryLink>
          </p>
        )}
      </div>
    </Container>
  );
}
