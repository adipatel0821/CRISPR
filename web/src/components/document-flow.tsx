"use client";

import * as React from "react";
import { AlertTriangle, Check, CheckCircle2, CircleMinus, FileText, FileUp, Loader2, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { VerifyRequestBody } from "@/lib/api-types";
import type { DocumentStatus, LoanOffer, VerifiedFinancialTerm } from "@/lib/contracts";
import { normalizeCurrencyInput, normalizeIntegerInput, percentToFraction } from "@/lib/format";
import { CHECK_LABELS, TERM_LABELS, termValueText } from "@/lib/labels";
import { termChip } from "@/lib/provenance";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/provenance-chip";
import { OfferAlerts } from "@/components/offer-summary";
import { ErrorState } from "@/components/states";
import { Disclosure, FadeIn, PrimaryAction } from "@/components/system";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { confirmRemaining, reviewState, reviewStatusText, type ReviewAction } from "@/components/offer/model";

const MAX_BYTES = 10 * 1024 * 1024;

type Action = ReviewAction;

function CheckIcon({ v, className = "size-4" }: { v: string; className?: string }) {
  if (v === "pass") return <CheckCircle2 aria-hidden className={cn(className, "text-accent")} />;
  if (v === "warn") return <AlertTriangle aria-hidden className={cn(className, "text-info")} />;
  if (v === "fail") return <XCircle aria-hidden className={cn(className, "text-deficit")} />;
  return <CircleMinus aria-hidden className={cn(className, "text-ink-subtle")} />;
}

const CHECK_WORD: Record<string, string> = { pass: "passed", warn: "warning", fail: "failed" };

/** Worst automatic check result for a term: fail > warn > pass (selection only). */
function checkSummary(checks: [string, string][]): { v: string; text: string } | null {
  if (checks.length === 0) return null;
  const fails = checks.filter(([, v]) => v === "fail").length;
  const warns = checks.filter(([, v]) => v === "warn").length;
  if (fails) return { v: "fail", text: fails === 1 ? "1 check failed" : `${fails} checks failed` };
  if (warns) return { v: "warn", text: warns === 1 ? "1 check to look at" : `${warns} checks to look at` };
  if (checks.every(([, v]) => v === "pass")) return { v: "pass", text: "Checks passed" };
  return null;
}

function normaliseCorrection(t: VerifiedFinancialTerm, raw: string): string | null {
  if (t.value_type === "rate") return percentToFraction(raw);
  if (t.value_type === "integer") return normalizeIntegerInput(raw);
  if (t.value_type === "boolean") return raw === "true" || raw === "false" ? raw : null;
  return normalizeCurrencyInput(raw);
}

function TermRow({
  t,
  action,
  onAction,
  readOnly = false,
}: {
  t: VerifiedFinancialTerm;
  action: Action | undefined;
  onAction: (a: Action | undefined) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [raw, setRaw] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const checks = Object.entries(t.checks).filter(([, v]) => v !== "not_applicable") as [string, string][];
  const summary = checkSummary(checks);
  const id = `verify-${t.term_key}`;
  const label = TERM_LABELS[t.term_key] ?? t.term_key;
  const conflict = t.status === "conflicting";
  const hasEvidence = !!t.evidence?.quote || checks.length > 0;

  return (
    <li
      className={cn(
        "space-y-3 px-4 py-4 transition-colors duration-200 sm:px-5",
        conflict && action?.action !== "correct" && "bg-deficit-soft/50",
        action?.action === "confirm" && "bg-accent-soft/40",
      )}
      data-term={t.term_key}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] text-ink-muted">{label}</p>
          <p className="figure flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
            {action?.action === "correct"
              ? action.display
              : action?.action === "reject"
                ? "Left out"
                : termValueText(t.value ?? null, t.value_type)}
            {action?.action === "confirm" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-strong">
                <Check aria-hidden className="size-3.5" /> You confirmed
              </span>
            )}
            {action?.action === "correct" && <span className="text-xs font-medium text-ink-muted">You corrected</span>}
          </p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-subtle">
            <Chip spec={termChip(t)} kind={t.source_kind} />
            {summary && (
              <span className="inline-flex items-center gap-1">
                <CheckIcon v={summary.v} className="size-3.5" />
                {summary.text}
              </span>
            )}
          </div>
        </div>

        {!readOnly && !editing && (
          <div className="flex shrink-0 flex-wrap gap-1.5" role="group" aria-label={`Actions for ${label}`}>
            <Button
              size="sm"
              variant={action?.action === "confirm" ? "primary" : "secondary"}
              aria-pressed={action?.action === "confirm"}
              disabled={conflict && action?.action !== "correct"}
              onClick={() => onAction(action?.action === "confirm" ? undefined : { action: "confirm" })}
            >
              <Check aria-hidden /> Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Correct
            </Button>
            <Button
              size="sm"
              variant={action?.action === "reject" ? "danger" : "ghost"}
              aria-pressed={action?.action === "reject"}
              onClick={() => onAction(action?.action === "reject" ? undefined : { action: "reject" })}
            >
              Reject
            </Button>
          </div>
        )}
      </div>

      {!readOnly && t.alternatives_found.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-deficit">Two readings disagree — choose the one on your document</legend>
          {t.alternatives_found.map((c, i) => (
            <label
              key={`${c.source}-${i}`}
              className="flex cursor-pointer items-start gap-2 rounded-control border border-line bg-surface p-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
            >
              <input
                type="radio"
                name={`${id}-alt`}
                className="mt-1 size-4 accent-[var(--color-ink)]"
                checked={action?.action === "correct" && action.value === c.value}
                onChange={() => onAction({ action: "correct", value: c.value, display: termValueText(c.value, t.value_type) })}
              />
              <span>
                <span className="figure font-medium">{termValueText(c.value, t.value_type)}</span>{" "}
                <span className="text-xs text-ink-muted">
                  ({c.source === "independent_reader" ? "second reader" : c.source === "llm" ? "AI reading" : c.source}
                  {c.page ? `, page ${c.page}` : ""})
                </span>
                {c.quote && <span className="block text-xs text-ink-subtle">“{c.quote}”</span>}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {!readOnly && editing && (
        <form
          className="flex flex-col gap-2 rounded-control bg-canvas p-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const v = normaliseCorrection(t, raw);
            if (v === null) return setErr("That value doesn't look right for this field.");
            onAction({ action: "correct", value: v, display: termValueText(v, t.value_type) });
            setEditing(false);
            setErr(null);
          }}
        >
          <div className="space-y-1">
            <Label htmlFor={`${id}-fix`}>
              Correct value{t.value_type === "rate" ? " (%)" : t.value_type === "integer" ? " (months)" : ""}
            </Label>
            <Input
              id={`${id}-fix`}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              inputMode="decimal"
              className="sm:w-48"
              aria-invalid={!!err}
              aria-describedby={err ? `${id}-fix-err` : undefined}
              autoFocus
            />
            <FieldError id={`${id}-fix-err`}>{err}</FieldError>
          </div>
          <Button type="submit" size="sm">
            Use this value
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      )}

      {hasEvidence && (
        <Disclosure summary="Show evidence" meta={t.evidence?.page ? `page ${t.evidence.page}` : undefined} className="-my-1">
          <div className="space-y-3">
            {t.evidence?.quote && (
              <blockquote className="border-l-2 border-accent-line pl-3 text-xs text-ink-muted">
                “{t.evidence.quote}”{t.evidence.page ? ` — page ${t.evidence.page}` : ""}
              </blockquote>
            )}
            {checks.length > 0 && (
              <ul className="space-y-1 text-xs text-ink-muted">
                {checks.map(([k, v]) => (
                  <li key={k} className="flex items-center gap-1.5">
                    <CheckIcon v={v} className="size-3.5" />
                    <span>
                      {CHECK_LABELS[k] ?? k}: <span className="font-medium">{CHECK_WORD[v] ?? v}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Disclosure>
      )}
    </li>
  );
}

function FileLine({ doc }: { doc: DocumentStatus }) {
  return (
    <p className="flex min-w-0 items-center gap-2 text-[13px] text-ink-muted">
      <FileText aria-hidden className="size-4 shrink-0 text-ink-subtle" />
      <span className="truncate">
        {doc.filename}
        {doc.is_fixture ? " · bundled synthetic sample" : ""}
      </span>
    </p>
  );
}

/** Upload → extraction status → verification list → saved LoanOffer. */
export function DocumentFlow({
  onSaved,
  onUseManual,
}: {
  onSaved: (offer: LoanOffer) => void;
  onUseManual: () => void;
}) {
  const [doc, setDoc] = React.useState<DocumentStatus | null>(null);
  const [draft, setDraft] = React.useState<LoanOffer | null>(null);
  // 1-based offer number, as the API expects (VerifyRequest.offer_choice is 1..document_offers_count)
  const [choice, setChoice] = React.useState<number | null>(null);
  const [actions, setActions] = React.useState<Record<string, Action>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [drag, setDrag] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const toError = (e: unknown) => (e instanceof ApiError ? e : new ApiError("INTERNAL", String(e), 0));

  async function poll(d: DocumentStatus): Promise<DocumentStatus> {
    let cur = d;
    for (let i = 0; i < 20 && cur.status === "processing"; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      cur = await api.getDocument(cur.doc_id);
    }
    return cur;
  }

  async function upload(file: File) {
    setError(null);
    if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError(new ApiError("VALIDATION_ERROR", "Please upload a PDF.", 400));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(new ApiError("VALIDATION_ERROR", "That file is larger than 10 MB.", 400));
      return;
    }
    setBusy(true);
    setStatus(`Reading ${file.name}…`);
    try {
      const d = await poll(await api.uploadDocument(file));
      setDoc(d);
      setDraft(d.draft_offer);
      setChoice(null);
      setActions({});
      setStatus(d.message ?? `Document status: ${d.status}.`);
    } catch (e) {
      setError(toError(e));
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function chooseOffer() {
    if (!doc || choice === null) return;
    setBusy(true);
    setError(null);
    try {
      const offer = await api.verifyDocument(doc.doc_id, { offer_choice: choice, actions: [] });
      setDraft(offer);
      setDoc({ ...doc, status: "extracted" });
    } catch (e) {
      setError(toError(e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!doc || !draft) return;
    const body: VerifyRequestBody = {
      offer_choice: draft.offer_choice ?? choice ?? null,
      actions: Object.entries(actions).map(([term_key, a]) => ({
        term_key,
        action: a.action,
        value: a.action === "correct" ? (a.value ?? null) : null,
      })),
    };
    setBusy(true);
    setError(null);
    try {
      const offer = await api.verifyDocument(doc.doc_id, body);
      onSaved(offer);
    } catch (e) {
      setError(toError(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDoc(null);
    setDraft(null);
    setStatus("");
    setActions({});
  }

  const terms = draft ? Object.values(draft.terms) : [];
  const review = reviewState(terms, actions);

  return (
    <div className="space-y-6">
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {!doc && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed px-6 py-14 text-center transition-colors duration-200",
            drag ? "border-accent bg-accent-soft" : "border-line-strong bg-canvas",
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-surface shadow-soft">
            {busy ? (
              <Loader2 aria-hidden className="size-5 animate-spin text-accent motion-reduce:animate-none" />
            ) : (
              <FileUp aria-hidden className="size-5 text-ink-muted" />
            )}
          </span>
          <div className="space-y-1">
            <p className="text-[15px] font-medium text-ink">{busy ? "Reading the document…" : "Drop your loan contract here"}</p>
            <p className="text-[13px] text-ink-muted">PDF up to 10 MB and 30 pages. In demo mode, use the bundled synthetic samples.</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            id="doc-upload"
            aria-label="Upload a loan contract PDF"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()} className="mt-1">
            Choose a file
          </Button>
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <ErrorState error={error} />
          <Button variant="link" onClick={onUseManual}>
            Type the terms instead
          </Button>
        </div>
      )}

      {doc && (doc.status === "failed" || doc.status === "unsupported") && (
        <div role="alert" className="rounded-card bg-deficit-soft p-5 text-sm leading-relaxed">
          <p className="font-semibold text-deficit">
            {doc.status === "unsupported" ? "This document or loan type isn't supported" : "We couldn't read this document"}
          </p>
          {doc.message && <p className="mt-1 text-ink">{doc.message}</p>}
          <p className="mt-1 text-ink-muted">You can still type the terms of a fixed-rate offer yourself.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={onUseManual}>
              Type the terms instead
            </Button>
            <Button size="sm" variant="secondary" onClick={reset}>
              Try another file
            </Button>
          </div>
        </div>
      )}

      {doc && doc.status === "needs_choice" && (
        <FadeIn>
          <fieldset className="space-y-3">
            <legend className="mb-1 text-lg font-semibold tracking-tight text-ink">
              This document has {doc.offers_found} offers. Which one are you considering?
            </legend>
            <FileLine doc={doc} />
            <div className="grid gap-2 pt-1">
              {doc.offer_labels.map((l, i) => (
                <label
                  key={l}
                  className={cn(
                    "flex min-h-13 cursor-pointer items-center gap-3 rounded-card border px-4 py-3 text-[15px] transition-colors duration-150",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                    choice === i + 1 ? "border-ink bg-surface" : "border-line-strong bg-surface hover:bg-canvas",
                  )}
                >
                  <input
                    type="radio"
                    name="offer-choice"
                    checked={choice === i + 1}
                    onChange={() => setChoice(i + 1)}
                    className="size-4 accent-[var(--color-ink)]"
                  />
                  {l}
                </label>
              ))}
            </div>
            <div className="pt-2">
              <PrimaryAction disabled={busy || choice === null} onClick={chooseOffer} size="md">
                Use this offer
              </PrimaryAction>
            </div>
          </fieldset>
        </FadeIn>
      )}

      {doc && draft && doc.status === "unsupported" && terms.length > 0 && (
        <section aria-labelledby="reference-heading" className="space-y-3">
          <h2 id="reference-heading" className="text-base font-semibold text-ink">
            Terms we read — for reference only
          </h2>
          <p className="text-sm text-ink-muted">
            {doc.filename}
            {doc.is_fixture ? " · bundled synthetic sample" : ""} · these values are not used for any calculation.
          </p>
          <Disclosure summary={`Show the ${terms.length} terms we read`}>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
              {terms.map((t) => (
                <TermRow key={t.term_key} t={t} action={undefined} onAction={() => {}} readOnly />
              ))}
            </ul>
          </Disclosure>
        </section>
      )}

      {doc && draft && doc.status !== "needs_choice" && doc.status !== "unsupported" && doc.status !== "failed" && (
        <FadeIn as="section" aria-labelledby="verify-heading" className="space-y-5">
          <div className="space-y-1.5">
            <h2 id="verify-heading" className="text-lg font-semibold tracking-tight text-ink">
              Check what we read
            </h2>
            <p className="text-sm text-ink-muted">Compare each value with your document, then confirm or correct it.</p>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1">
              <FileLine doc={doc} />
              <span className="tabular text-[13px] text-ink-subtle">
                {review.reviewed} of {review.total} checked
              </span>
            </div>
          </div>
          <OfferAlerts offer={draft} />
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {terms.map((t) => (
              <TermRow
                key={t.term_key}
                t={t}
                action={actions[t.term_key]}
                onAction={(a) =>
                  setActions((s) => {
                    const n = { ...s };
                    if (a) n[t.term_key] = a;
                    else delete n[t.term_key];
                    return n;
                  })
                }
              />
            ))}
          </ul>
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {review.unreviewed.length > 0 && (
                <Button variant="secondary" size="lg" onClick={() => setActions((s) => confirmRemaining(terms, s))}>
                  <Check aria-hidden /> Confirm all remaining
                </Button>
              )}
              <PrimaryAction
                disabled={busy || review.conflicts.length > 0}
                onClick={save}
                arrow={false}
                aria-describedby="review-status"
              >
                {busy ? "Saving…" : "Save checked offer"}
              </PrimaryAction>
            </div>
            <p id="review-status" className="text-[13px] text-ink-muted" aria-live="polite">
              {reviewStatusText(review)}
            </p>
            <p className="text-[13px] text-ink-subtle">
              Something look off?{" "}
              <Button variant="link" className="text-[13px]" onClick={onUseManual}>
                Type the terms instead
              </Button>
            </p>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
