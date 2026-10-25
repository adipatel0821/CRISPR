"use client";

import * as React from "react";
import { Info, ShieldAlert } from "lucide-react";
import type { QuestionResponseBody } from "@/lib/api-types";
import type { QuestionCandidate } from "@/lib/contracts";
import { normalizeCurrencyInput } from "@/lib/format";
import { choiceLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CurrencyInput, FieldError, Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";

type Answer = Omit<QuestionResponseBody, "question_id" | "fact_key">;

function RadioCards({
  name,
  options,
  value,
  onChange,
  labelledBy,
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  labelledBy: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              checked ? "border-accent bg-accent-soft text-ink" : "border-line-strong bg-surface hover:bg-canvas",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              onChange={() => onChange(o.value)}
              className="size-4 accent-[var(--color-accent)]"
            />
            <span>{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * One adaptive question with a typed widget per kind. Input is normalised to the string the API
 * expects (e.g. "$4,200" -> "4200.00"); nothing is computed.
 */
export function QuestionCard({
  question,
  busy,
  onAnswer,
  onCancel,
}: {
  question: QuestionCandidate;
  busy: boolean;
  onAnswer: (a: Answer) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = React.useState("");
  const [text2, setText2] = React.useState("");
  const [choice, setChoice] = React.useState("");
  const [multi, setMulti] = React.useState<string[]>([]);
  const [estimate, setEstimate] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const headingId = `q-${question.question_id}`;
  const inputId = `in-${question.question_id}`;

  // Acknowledgement / clarification (rule_id set): a confirm card, not a data question.
  if (question.rule_id) {
    return (
      <Card className="border-info-line">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-info" />
            <div className="space-y-1">
              <h2 id={headingId} className="text-lg font-semibold text-ink">
                {question.text}
              </h2>
              <p className="text-sm text-ink-muted">{question.why_we_ask}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => onAnswer({ raw_answer: "acknowledged", typed_value: true })}>
              I understand, continue
            </Button>
            {question.allow_skip && (
              <Button variant="ghost" disabled={busy} onClick={() => onAnswer({ skipped: true })}>
                Review my answers first
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const k = question.kind;
    if (k === "currency") {
      const v = normalizeCurrencyInput(text);
      if (v === null) return setError("Enter an amount like 4,200 or 4200.50.");
      return onAnswer({ raw_answer: text, typed_value: v, marked_estimate: estimate });
    }
    if (k === "number") {
      const t = text.trim().replace(/,/g, "");
      if (!/^\d+(\.\d+)?$/.test(t)) return setError("Enter a number, for example 0 or 2.");
      return onAnswer({ raw_answer: text, typed_value: t, marked_estimate: estimate });
    }
    if (k === "choice" || k === "yes_no") {
      if (!choice) return setError("Choose one option.");
      return onAnswer({ raw_answer: choice, typed_value: choice, marked_estimate: estimate });
    }
    if (k === "multi_choice") {
      if (multi.length === 0) return setError("Choose at least one option.");
      return onAnswer({ raw_answer: multi.join(", "), typed_value: multi, marked_estimate: estimate });
    }
    if (k === "currency_pair") {
      const lo = normalizeCurrencyInput(text);
      const hi = normalizeCurrencyInput(text2);
      if (lo === null || hi === null) return setError("Enter both amounts.");
      return onAnswer({ raw_answer: `${text} – ${text2}`, typed_value: { low: lo, high: hi }, marked_estimate: estimate });
    }
    // free_text
    const t = text.trim();
    if (!t) return setError("Type an answer, or skip this question.");
    return onAnswer({ raw_answer: t.slice(0, 1000), typed_value: null, marked_estimate: estimate });
  }

  const options =
    question.kind === "yes_no"
      ? [
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]
      : (question.choices ?? []).map((c) => ({ value: c, label: choiceLabel(c) }));

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
              {question.priority_class === "blocking" ? "Needed for your results" : "Optional — improves accuracy"}
            </p>
            <h2 id={headingId} className="text-xl font-semibold leading-snug tracking-tight text-ink">
              {question.kind === "currency" || question.kind === "number" || question.kind === "free_text" ? (
                <label htmlFor={inputId}>{question.text}</label>
              ) : (
                question.text
              )}
            </h2>
            <p className="flex items-start gap-1.5 text-sm text-ink-muted">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{question.why_we_ask}</span>
            </p>
            {question.refinement_effect && (
              <p className="text-xs text-ink-subtle">
                Could change {question.refinement_effect.metric.replace(/_/g, " ")} by up to $
                {question.refinement_effect.max_abs_change} ({question.refinement_effect.basis}).
              </p>
            )}
          </div>

          <div className="space-y-2">
            {question.kind === "currency" && (
              <CurrencyInput
                id={inputId}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="0.00"
                aria-invalid={!!error}
                aria-describedby={error ? `${inputId}-err` : undefined}
                autoFocus
              />
            )}
            {question.kind === "number" && (
              <Input
                id={inputId}
                inputMode="decimal"
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? `${inputId}-err` : undefined}
                className="max-w-40"
                autoFocus
              />
            )}
            {question.kind === "free_text" && (
              <textarea
                id={inputId}
                value={text}
                maxLength={1000}
                onChange={(e) => setText(e.target.value)}
                className="min-h-24 w-full rounded-md border border-line-strong bg-surface p-3 text-sm"
              />
            )}
            {question.kind === "currency_pair" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`${inputId}-lo`}>Low</Label>
                  <CurrencyInput id={`${inputId}-lo`} value={text} onChange={(e) => setText(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${inputId}-hi`}>High</Label>
                  <CurrencyInput id={`${inputId}-hi`} value={text2} onChange={(e) => setText2(e.target.value)} />
                </div>
              </div>
            )}
            {(question.kind === "choice" || question.kind === "yes_no") && (
              <RadioCards name={inputId} options={options} value={choice} onChange={setChoice} labelledBy={headingId} />
            )}
            {question.kind === "multi_choice" && (
              <fieldset className="grid gap-2 sm:grid-cols-2" aria-labelledby={headingId}>
                {options.map((o) => (
                  <label key={o.value} className="flex items-center gap-3 rounded-lg border border-line-strong px-4 py-3 text-sm">
                    <input
                      type="checkbox"
                      checked={multi.includes(o.value)}
                      onChange={(e) =>
                        setMulti((m) => (e.target.checked ? [...m, o.value] : m.filter((x) => x !== o.value)))
                      }
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    {o.label}
                  </label>
                ))}
              </fieldset>
            )}
            <FieldError id={`${inputId}-err`}>{error}</FieldError>
          </div>

          {question.allow_estimate && (
            <div className="flex items-center gap-3">
              <Switch id={`${inputId}-est`} checked={estimate} onCheckedChange={setEstimate} />
              <Label htmlFor={`${inputId}-est`} className="font-normal text-ink-muted">
                It&apos;s an estimate
              </Label>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Continue"}
            </Button>
            {question.allow_skip && (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => onAnswer({ skipped: true })}>
                Skip for now
              </Button>
            )}
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onAnswer({ declined: true })}>
              I&apos;d rather not say
            </Button>
            {onCancel && (
              <Button type="button" variant="link" className="sm:ml-auto" onClick={onCancel}>
                Close
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
