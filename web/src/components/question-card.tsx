"use client";

import * as React from "react";
import { Check, Info } from "lucide-react";
import type { QuestionResponseBody } from "@/lib/api-types";
import type { QuestionCandidate } from "@/lib/contracts";
import { formatMoney, normalizeCurrencyInput } from "@/lib/format";
import { choiceLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Disclosure, PrimaryAction } from "@/components/system";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";

type Answer = Omit<QuestionResponseBody, "question_id" | "fact_key">;

/** Large conversational currency field with a visible "$" prefix. */
function BigCurrencyInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-ink-subtle">
        $
      </span>
      <Input
        inputMode="decimal"
        autoComplete="off"
        className={cn("h-14 rounded-card pl-9 text-lg sm:text-lg", className)}
        {...props}
      />
    </div>
  );
}

function OptionList({
  name,
  options,
  value,
  onChange,
  labelledBy,
  describedBy,
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  labelledBy: string;
  describedBy?: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy} className="grid gap-2">
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <label
            key={o.value}
            className={cn(
              "flex min-h-13 cursor-pointer items-center gap-3 rounded-card border px-4 py-3 text-[15px] transition-colors duration-150",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              checked ? "border-ink bg-surface text-ink" : "border-line-strong bg-surface text-ink hover:bg-canvas",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              onChange={() => onChange(o.value)}
              className="size-4 accent-[var(--color-ink)]"
            />
            <span className="flex-1">{o.label}</span>
            {checked && <Check aria-hidden className="size-4 text-ink" />}
          </label>
        );
      })}
    </div>
  );
}

function WhyWeAsk({ question }: { question: QuestionCandidate }) {
  return (
    <Disclosure summary="Why we ask">
      <p>{question.why_we_ask}</p>
      {question.refinement_effect && (
        <p className="mt-1.5 text-xs text-ink-subtle">
          Could change {question.refinement_effect.metric.replace(/_/g, " ")} by up to{" "}
          {formatMoney(question.refinement_effect.max_abs_change)} ({question.refinement_effect.basis}).
        </p>
      )}
    </Disclosure>
  );
}

/** Acknowledgement / clarification (rule_id set, e.g. H01/H02): a gentle confirm card, not a data question. */
function AcknowledgeCard({
  question,
  busy,
  onAnswer,
}: {
  question: QuestionCandidate;
  busy: boolean;
  onAnswer: (a: Answer) => void;
}) {
  const headingId = `q-${question.question_id}`;
  return (
    <div className="space-y-6" data-question-kind="acknowledge">
      <div className="rounded-card bg-info-soft p-5 sm:p-6">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-info">
          <Info aria-hidden className="size-4" /> Please check this
        </p>
        <h2 id={headingId} className="text-pretty text-xl font-semibold leading-snug tracking-tight text-ink sm:text-[1.375rem]">
          {question.text}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{question.why_we_ask}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <PrimaryAction disabled={busy} onClick={() => onAnswer({ raw_answer: "acknowledged", typed_value: true })} arrow={false}>
          I understand, continue
        </PrimaryAction>
        {question.allow_skip && (
          <Button variant="ghost" disabled={busy} onClick={() => onAnswer({ skipped: true })}>
            Review my answers first
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * One adaptive question, ChatGPT-style: large question, one input, "Continue", quiet secondary actions and
 * "Why we ask" behind a disclosure. Input is normalised to the string the API expects ("$4,200" → "4200.00");
 * nothing is computed.
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
  const errId = `${inputId}-err`;

  if (question.rule_id) return <AcknowledgeCard question={question} busy={busy} onAnswer={onAnswer} />;

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

  const labelled = question.kind === "currency" || question.kind === "number" || question.kind === "free_text";
  const invalidProps = { "aria-invalid": !!error, "aria-describedby": error ? errId : undefined };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate data-question-kind={question.kind}>
      <div className="space-y-2.5">
        <p className="text-[13px] font-medium text-ink-subtle">
          {question.priority_class === "blocking" ? "Needed for your results" : "Optional — makes a figure more precise"}
        </p>
        <h2 id={headingId} className="text-pretty text-[1.5rem] font-semibold leading-[1.25] tracking-[-0.02em] text-ink sm:text-[1.75rem]">
          {labelled ? <label htmlFor={inputId}>{question.text}</label> : question.text}
        </h2>
      </div>

      <div className="space-y-3">
        {question.kind === "currency" && (
          <BigCurrencyInput
            id={inputId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="0"
            {...invalidProps}
            autoFocus
          />
        )}
        {question.kind === "number" && (
          <Input
            id={inputId}
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="0"
            {...invalidProps}
            className="h-14 max-w-48 rounded-card text-lg sm:text-lg"
            autoFocus
          />
        )}
        {question.kind === "free_text" && (
          <textarea
            id={inputId}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            {...invalidProps}
            className="min-h-28 w-full rounded-card border border-line-strong bg-surface p-4 text-[15px] text-ink focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          />
        )}
        {question.kind === "currency_pair" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${inputId}-lo`}>Low</Label>
              <BigCurrencyInput id={`${inputId}-lo`} value={text} onChange={(e) => setText(e.target.value)} {...invalidProps} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${inputId}-hi`}>High</Label>
              <BigCurrencyInput id={`${inputId}-hi`} value={text2} onChange={(e) => setText2(e.target.value)} {...invalidProps} />
            </div>
          </div>
        )}
        {(question.kind === "choice" || question.kind === "yes_no") && (
          <OptionList
            name={inputId}
            options={options}
            value={choice}
            onChange={setChoice}
            labelledBy={headingId}
            describedBy={error ? errId : undefined}
          />
        )}
        {question.kind === "multi_choice" && (
          <fieldset className="grid gap-2" aria-labelledby={headingId} aria-describedby={error ? errId : undefined}>
            {options.map((o) => (
              <label
                key={o.value}
                className="flex min-h-13 cursor-pointer items-center gap-3 rounded-card border border-line-strong px-4 py-3 text-[15px] hover:bg-canvas has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
              >
                <input
                  type="checkbox"
                  checked={multi.includes(o.value)}
                  onChange={(e) => setMulti((m) => (e.target.checked ? [...m, o.value] : m.filter((x) => x !== o.value)))}
                  className="size-4 accent-[var(--color-ink)]"
                />
                {o.label}
              </label>
            ))}
          </fieldset>
        )}
        <FieldError id={errId}>{error}</FieldError>

        {question.allow_estimate && (
          <div className="flex items-center gap-2.5 pt-1">
            <Switch id={`${inputId}-est`} checked={estimate} onCheckedChange={setEstimate} />
            <Label htmlFor={`${inputId}-est`} className="font-normal text-ink-muted">
              It&apos;s an estimate
            </Label>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
        <PrimaryAction type="submit" disabled={busy} arrow={false} size="lg">
          {busy ? "Saving…" : "Continue"}
        </PrimaryAction>
        <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-start">
          {question.allow_skip && (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onAnswer({ skipped: true })}>
              Skip for now
            </Button>
          )}
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onAnswer({ declined: true })}>
            I&apos;d rather not say
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Close
            </Button>
          )}
        </div>
      </div>

      <WhyWeAsk question={question} />
    </form>
  );
}
