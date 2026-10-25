"use client";

import * as React from "react";
import { CheckCircle2, CircleMinus, FileUp, Loader2, XCircle, AlertTriangle } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";

const MAX_BYTES = 10 * 1024 * 1024;

type Action = { action: "confirm" | "correct" | "reject"; value?: string; display?: string };

function CheckIcon({ v }: { v: string }) {
  if (v === "pass") return <CheckCircle2 aria-hidden className="size-4 text-accent" />;
  if (v === "warn") return <AlertTriangle aria-hidden className="size-4 text-info" />;
  if (v === "fail") return <XCircle aria-hidden className="size-4 text-deficit" />;
  return <CircleMinus aria-hidden className="size-4 text-ink-subtle" />;
}

const CHECK_WORD: Record<string, string> = { pass: "passed", warn: "warning", fail: "failed" };

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
}: {
  t: VerifiedFinancialTerm;
  action: Action | undefined;
  onAction: (a: Action | undefined) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [raw, setRaw] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const checks = Object.entries(t.checks).filter(([, v]) => v !== "not_applicable");
  const id = `verify-${t.term_key}`;
  const label = TERM_LABELS[t.term_key] ?? t.term_key;

  return (
    <li className={cn("space-y-3 py-4", t.status === "conflicting" && "rounded-md bg-deficit-soft/40 px-3")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">{label}</p>
          <p className="figure text-lg font-semibold text-ink">
            {action?.action === "correct" ? action.display : action?.action === "reject" ? "Rejected" : termValueText(t.value ?? null, t.value_type)}
          </p>
        </div>
        <Chip spec={termChip(t)} kind={t.source_kind} />
      </div>

      {t.evidence?.quote && (
        <blockquote className="border-l-2 border-accent-line pl-3 text-xs text-ink-muted">
          “{t.evidence.quote}”{t.evidence.page ? ` — page ${t.evidence.page}` : ""}
        </blockquote>
      )}

      {checks.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          {checks.map(([k, v]) => (
            <li key={k} className="flex items-center gap-1">
              <CheckIcon v={v} />
              <span>
                {CHECK_LABELS[k] ?? k}: <span className="font-medium">{CHECK_WORD[v] ?? v}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {t.alternatives_found.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-deficit">Two readings disagree — choose the one on your document</legend>
          {t.alternatives_found.map((c, i) => (
            <label key={`${c.source}-${i}`} className="flex items-start gap-2 rounded-md border border-line bg-surface p-2 text-sm">
              <input
                type="radio"
                name={`${id}-alt`}
                className="mt-1 size-4 accent-[var(--color-accent)]"
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

      {editing ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
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
            <Input id={`${id}-fix`} value={raw} onChange={(e) => setRaw(e.target.value)} inputMode="decimal" className="sm:w-48" />
            <FieldError>{err}</FieldError>
          </div>
          <Button type="submit" size="sm">
            Use this value
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Actions for ${label}`}>
          <Button
            size="sm"
            variant={action?.action === "confirm" ? "primary" : "secondary"}
            aria-pressed={action?.action === "confirm"}
            disabled={t.status === "conflicting" && action?.action !== "correct"}
            onClick={() => onAction(action?.action === "confirm" ? undefined : { action: "confirm" })}
          >
            Confirm
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
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
          {action && (
            <span className="self-center text-xs text-ink-muted">
              {action.action === "confirm" ? "You confirmed this value" : action.action === "correct" ? "You corrected this value" : "Will be left out"}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

/** Upload → extraction status → verification table → saved LoanOffer. */
export function DocumentFlow({
  onSaved,
  onUseManual,
}: {
  onSaved: (offer: LoanOffer) => void;
  onUseManual: () => void;
}) {
  const [doc, setDoc] = React.useState<DocumentStatus | null>(null);
  const [draft, setDraft] = React.useState<LoanOffer | null>(null);
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
      offer_choice: choice ?? draft.offer_choice ?? null,
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

  const terms = draft ? Object.values(draft.terms) : [];
  const conflicts = terms.filter((t) => t.status === "conflicting" && actions[t.term_key]?.action !== "correct");
  const unreviewed = terms.filter((t) => !actions[t.term_key]);

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
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center",
            drag ? "border-accent bg-accent-soft" : "border-line-strong bg-surface",
          )}
        >
          {busy ? <Loader2 aria-hidden className="size-6 animate-spin text-accent" /> : <FileUp aria-hidden className="size-6 text-ink-subtle" />}
          <p className="text-sm font-medium text-ink">{busy ? "Reading the document…" : "Drag a loan contract PDF here"}</p>
          <p className="text-xs text-ink-muted">PDF up to 10 MB and 30 pages. In demo mode, use the bundled synthetic samples.</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            id="doc-upload"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
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
        <div role="alert" className="rounded-lg border border-deficit-line bg-deficit-soft p-4 text-sm">
          <p className="font-semibold text-deficit">
            {doc.status === "unsupported" ? "This document or loan type isn't supported" : "We couldn't read this document"}
          </p>
          {doc.message && <p className="mt-1 text-ink">{doc.message}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={onUseManual}>
              Type the terms instead
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDoc(null)}>
              Try another file
            </Button>
          </div>
        </div>
      )}

      {doc && doc.status === "needs_choice" && (
        <fieldset className="space-y-3 rounded-lg border border-line bg-surface p-5">
          <legend className="px-1 text-base font-semibold text-ink">This document has {doc.offers_found} offers. Which one are you considering?</legend>
          {doc.offer_labels.map((l, i) => (
            <label key={l} className="flex items-center gap-3 rounded-md border border-line-strong px-4 py-3 text-sm">
              <input
                type="radio"
                name="offer-choice"
                checked={choice === i}
                onChange={() => setChoice(i)}
                className="size-4 accent-[var(--color-accent)]"
              />
              {l}
            </label>
          ))}
          <Button disabled={busy || choice === null} onClick={chooseOffer}>
            Use this offer
          </Button>
        </fieldset>
      )}

      {doc && draft && doc.status !== "needs_choice" && (
        <section aria-labelledby="verify-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="verify-heading" className="text-lg font-semibold text-ink">
                Check what we read
              </h2>
              <p className="text-sm text-ink-muted">
                {doc.filename}
                {doc.is_fixture ? " · bundled synthetic sample" : ""} · compare each value with your document.
              </p>
            </div>
            <Button variant="link" onClick={onUseManual}>
              Type the terms instead
            </Button>
          </div>
          <OfferAlerts offer={draft} />
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface px-4">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="secondary"
              onClick={() =>
                setActions((s) => {
                  const n = { ...s };
                  terms.forEach((t) => {
                    if (!n[t.term_key] && t.status !== "conflicting") n[t.term_key] = { action: "confirm" };
                  });
                  return n;
                })
              }
            >
              Confirm all remaining
            </Button>
            <Button disabled={busy || conflicts.length > 0} onClick={save}>
              {busy ? "Saving…" : "Save checked offer"}
            </Button>
            <p className="text-xs text-ink-muted" aria-live="polite">
              {conflicts.length > 0
                ? `Choose a value for ${conflicts.length} disagreeing term${conflicts.length > 1 ? "s" : ""} first.`
                : unreviewed.length > 0
                  ? `${unreviewed.length} value${unreviewed.length > 1 ? "s" : ""} not reviewed yet.`
                  : "All values reviewed."}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
