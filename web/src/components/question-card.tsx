"use client";

import * as React from "react";
import { Activity, Ban, Check, Equal, HandCoins, Info, PiggyBank, Waves, X } from "lucide-react";
import type { QuestionResponseBody } from "@/lib/api-types";
import type { QuestionCandidate } from "@/lib/contracts";
import { metricName, plain } from "@/lib/copy";
import { formatMoney, normalizeCurrencyInput } from "@/lib/format";
import { choiceLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { ActionRow } from "@/components/shell";
import { PrimaryAction } from "@/components/system";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { HelpDisclosure, IconBadge, OptionTiles, type TileOption } from "@/components/visual";
import { AmountInput } from "@/components/intake/amount-input";
import { StagePane } from "@/components/intake/stage-pane";
import { QuestionArt, artIcon } from "@/components/intake/question-art";
import { questionHeadline, questionWording } from "@/components/intake/wording";

type Answer = Omit<QuestionResponseBody, "question_id" | "fact_key">;

/** Icon for a choice, from its words (the values themselves are submitted unchanged). */
function choiceIcon(label: string) {
  const t = label.toLowerCase();
  if (t === "yes") return Check;
  if (t === "no") return X;
  if (/no down payment/.test(t)) return Ban;
  if (/savings/.test(t)) return PiggyBank;
  if (/somewhere|other/.test(t)) return HandCoins;
  if (/same/.test(t)) return Equal;
  if (/a lot/.test(t)) return Activity;
  if (/varies|vary/.test(t)) return Waves;
  return undefined;
}

/** One short line under a choice, where it helps (down payment sources only). */
function choiceDescription(label: string): string | undefined {
  const t = label.toLowerCase();
  if (/no down payment/.test(t)) return "You pay nothing upfront";
  if (/savings/.test(t)) return "Money you have now, in checking or savings";
  if (/somewhere|other/.test(t)) return "A gift, a sale or another account";
  return undefined;
}

function WhyWeAsk({ question }: { question: QuestionCandidate }) {
  const effect = question.refinement_effect;
  return (
    <HelpDisclosure summary="Why do we ask this?">
      <p>{plain(question.why_we_ask)}</p>
      {effect && (
        <p className="mt-1.5 text-sm text-ink-2">
          It could change {metricName(effect.metric).toLowerCase()} by up to {formatMoney(effect.max_abs_change)} (
          {plain(effect.basis)}).
        </p>
      )}
    </HelpDisclosure>
  );
}

/** Acknowledgement (rule_id set, e.g. H01 / H02): a calm confirm step, not a data question. */
function AcknowledgeCard({
  question,
  busy,
  onAnswer,
  variant,
  headingLevel,
  lead,
  continueAs,
}: {
  question: QuestionCandidate;
  busy: boolean;
  onAnswer: (a: Answer) => void;
  variant: "inline" | "stage";
  headingLevel: "h1" | "h2";
  lead?: React.ReactNode;
  continueAs: "primary" | "secondary";
}) {
  const Heading = headingLevel;
  const headingId = `q-${question.question_id}`;
  const onConfirm = () => onAnswer({ raw_answer: "acknowledged", typed_value: true });
  const confirm =
    continueAs === "secondary" && variant === "inline" ? (
      <Button variant="primary" size="lg" disabled={busy} onClick={onConfirm} className="w-full sm:w-auto">
        I understand, continue
      </Button>
    ) : (
      <PrimaryAction disabled={busy} onClick={onConfirm} arrow={false}>
        I understand, continue
      </PrimaryAction>
    );
  const review = question.allow_skip ? (
    <button
      type="button"
      disabled={busy}
      onClick={() => onAnswer({ skipped: true })}
      className="inline-flex h-11 items-center rounded-full px-3 text-[15px] font-semibold text-ink-2 transition-colors duration-150 hover:bg-canvas hover:text-ink disabled:opacity-50"
    >
      Review my answers first
    </button>
  ) : null;
  const body = (
    <div className="space-y-5" data-question-kind="acknowledge">
      <p className="flex items-center gap-3 text-[15px] font-semibold text-caution">
        <IconBadge icon={Info} tone="caution" size="sm" />
        Please check this
      </p>
      <Heading
        id={headingId}
        className={
          variant === "stage"
            ? "max-w-[40rem] text-pretty text-[length:var(--text-title)] font-extrabold leading-[1.2] tracking-[-0.015em] text-ink"
            : "text-pretty text-xl font-bold leading-snug tracking-tight text-ink sm:text-[1.375rem]"
        }
      >
        {plain(question.text)}
      </Heading>
      <p className="max-w-[var(--measure)] text-[17px] leading-relaxed text-ink-2">{plain(question.why_we_ask)}</p>
    </div>
  );
  if (variant === "stage") {
    return (
      <div className="flex flex-1 flex-col" data-question-kind="acknowledge" data-fact-key={question.fact_key}>
        <StagePane lead={lead} aside={<QuestionArt kind="other" acknowledge className="hidden xl:flex" />} actions={<ActionRow secondary={review}>{confirm}</ActionRow>}>
          {body}
        </StagePane>
      </div>
    );
  }
  return (
    <div className="space-y-6 rounded-card bg-caution-soft/60 p-5 sm:p-6" data-fact-key={question.fact_key}>
      {body}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {confirm}
        {review}
      </div>
    </div>
  );
}

/**
 * One adaptive question: a large question, one comfortable input, one line of guidance, "Why do we ask this?"
 * behind a disclosure, the yellow Continue and quiet Skip / I'd rather not say. Input is normalised to the string
 * the API expects ("$4,200" -> "4200.00"); nothing is computed.
 *
 * variant "inline" (default): a self-contained block (used inside other screens, e.g. the loan offer).
 * variant "stage": fills a StageLayout workspace; Continue sits in the docked ActionRow (bottom right).
 */
export function QuestionCard({
  question,
  busy,
  onAnswer,
  onCancel,
  variant = "inline",
  headingLevel,
  lead,
  continueAs = "primary",
}: {
  question: QuestionCandidate;
  busy: boolean;
  onAnswer: (a: Answer) => void;
  onCancel?: () => void;
  variant?: "inline" | "stage";
  /** Defaults to h1 in the stage variant and h2 inline. */
  headingLevel?: "h1" | "h2";
  /** Stage variant: content above the question (saved note, errors). */
  lead?: React.ReactNode;
  /**
   * Inline variant: "secondary" renders Continue as a blue button instead of the yellow pill, for screens that
   * already have their own primary action (one yellow pill per screen). Default "primary".
   */
  continueAs?: "primary" | "secondary";
}) {
  const [text, setText] = React.useState("");
  const [text2, setText2] = React.useState("");
  const [choice, setChoice] = React.useState("");
  const [multi, setMulti] = React.useState<string[]>([]);
  const [estimate, setEstimate] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const level = headingLevel ?? (variant === "stage" ? "h1" : "h2");
  const Heading = level;
  const headingId = `q-${question.question_id}`;
  const inputId = `in-${question.question_id}`;
  const errId = `${inputId}-err`;
  const hintId = `${inputId}-hint`;
  const wording = questionWording(question.fact_key);

  if (question.rule_id)
    return (
      <AcknowledgeCard
        question={question}
        busy={busy}
        onAnswer={onAnswer}
        variant={variant}
        headingLevel={level}
        lead={lead}
        continueAs={continueAs}
      />
    );

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
      return onAnswer({ raw_answer: `${text} to ${text2}`, typed_value: { low: lo, high: hi }, marked_estimate: estimate });
    }
    // free_text
    const t = text.trim();
    if (!t) return setError("Type an answer, or skip this question.");
    return onAnswer({ raw_answer: t.slice(0, 1000), typed_value: null, marked_estimate: estimate });
  }

  const options: TileOption[] =
    question.kind === "yes_no"
      ? [
          { value: "true", title: "Yes", icon: Check },
          { value: "false", title: "No", icon: X },
        ]
      : (question.choices ?? []).map((c) => ({
          value: c,
          title: choiceLabel(c),
          icon: choiceIcon(choiceLabel(c)),
          description: question.fact_key === "loan.down_payment_source" ? choiceDescription(choiceLabel(c)) : undefined,
        }));

  const headline = questionHeadline(question.fact_key, question.kind, question.text, plain);
  const labelled = question.kind === "currency" || question.kind === "number" || question.kind === "free_text";
  const describedBy = [wording?.guidance ? hintId : null, error ? errId : null].filter(Boolean).join(" ") || undefined;
  const stage = variant === "stage";
  const Icon = artIcon(wording?.art ?? "other");

  const optional = question.priority_class !== "blocking";
  const eyebrow = (
    <p className="flex items-center gap-3 text-[15px] font-semibold text-brand-strong">
      <IconBadge icon={Icon} tone={optional ? "neutral" : "brand"} size="sm" />
      {optional ? "Optional. It makes a figure more precise." : "Needed for your results"}
    </p>
  );

  const heading = (
    <Heading
      id={headingId}
      className={
        stage
          ? "max-w-[40rem] text-pretty text-[length:var(--text-display)] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink"
          : "text-pretty text-[1.5rem] font-bold leading-[1.25] tracking-[-0.02em] text-ink sm:text-[1.75rem]"
      }
    >
      {labelled ? <label htmlFor={inputId}>{headline}</label> : headline}
    </Heading>
  );

  const quiet = (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[15px]">
      {question.allow_skip && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer({ skipped: true })}
          className="inline-flex h-11 items-center rounded-full px-3 font-semibold text-ink-2 transition-colors duration-150 hover:bg-canvas hover:text-ink disabled:opacity-50"
        >
          Skip for now
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => onAnswer({ declined: true })}
        className="inline-flex h-11 items-center rounded-full px-3 font-semibold text-ink-2 transition-colors duration-150 hover:bg-canvas hover:text-ink disabled:opacity-50"
      >
        I&apos;d rather not say
      </button>
      {onCancel && !stage && (
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center rounded-full px-3 font-semibold text-ink-2 transition-colors duration-150 hover:bg-canvas hover:text-ink"
        >
          Close
        </button>
      )}
    </div>
  );

  const input = (
    <div className="space-y-3">
      {question.kind === "currency" && (
        // No "0" placeholder: beside the "$" it read like an entered zero. An empty field reads as empty.
        <AmountInput
          id={inputId}
          value={text}
          onValueChange={setText}
          suffix={wording?.suffix}
          invalid={!!error}
          aria-describedby={describedBy}
          autoFocus
        />
      )}
      {question.kind === "number" && (
        <AmountInput
          id={inputId}
          value={text}
          onValueChange={setText}
          currency={false}
          narrow
          invalid={!!error}
          aria-describedby={describedBy}
          autoFocus
        />
      )}
      {question.kind === "free_text" && (
        <textarea
          id={inputId}
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          className="min-h-32 w-full max-w-[40rem] rounded-card border-2 border-line-strong bg-surface p-4 text-[17px] text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-strong"
        />
      )}
      {question.kind === "currency_pair" && (
        <div className="grid max-w-[44rem] gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor={`${inputId}-lo`} className="block text-[15px] font-bold text-ink">
              Typical month
            </label>
            <AmountInput id={`${inputId}-lo`} value={text} onValueChange={setText} invalid={!!error} aria-describedby={describedBy} />
          </div>
          <div className="space-y-2">
            <label htmlFor={`${inputId}-hi`} className="block text-[15px] font-bold text-ink">
              Slow month
            </label>
            <AmountInput id={`${inputId}-hi`} value={text2} onValueChange={setText2} invalid={!!error} aria-describedby={describedBy} />
          </div>
        </div>
      )}
      {(question.kind === "choice" || question.kind === "yes_no") && (
        <OptionTiles
          name={inputId}
          legend={headline}
          legendHidden
          options={options}
          value={choice}
          onChange={(v) => {
            setChoice(v);
            setError(null);
          }}
          columns={options.length === 2 ? 2 : 1}
          describedBy={describedBy}
          className="max-w-[40rem]"
        />
      )}
      {question.kind === "multi_choice" && (
        <fieldset className="grid max-w-[40rem] gap-3" aria-describedby={describedBy}>
          <legend className="sr-only">{headline}</legend>
          {options.map((o) => {
            const checked = multi.includes(o.value);
            return (
              <label
                key={o.value}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-card border-2 px-5 py-3 text-[17px] font-semibold text-ink transition-colors duration-150",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-strong",
                  checked ? "border-brand bg-brand-tint" : "border-line bg-surface hover:border-brand-line",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setMulti((m) => (e.target.checked ? [...m, o.value] : m.filter((x) => x !== o.value)))}
                  className="size-5 accent-[var(--color-brand)]"
                />
                {o.title}
              </label>
            );
          })}
        </fieldset>
      )}
      <FieldError id={errId}>{error}</FieldError>
    </div>
  );

  const estimateBox = question.allow_estimate ? (
    <div className="flex items-center gap-3">
      <Checkbox id={`${inputId}-est`} checked={estimate} onCheckedChange={(v) => setEstimate(v === true)} />
      <label htmlFor={`${inputId}-est`} className="text-[15px] text-ink-2">
        It&apos;s an estimate
      </label>
    </div>
  ) : null;

  const guidance = wording?.guidance ? (
    <p id={hintId} className="max-w-[var(--measure)] text-[17px] leading-relaxed text-ink-2">
      {wording.guidance}
    </p>
  ) : null;

  const continueButton =
    continueAs === "secondary" && !stage ? (
      <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full sm:w-auto">
        {busy ? "Saving" : "Continue"}
      </Button>
    ) : (
      <PrimaryAction type="submit" disabled={busy} arrow={stage}>
        {busy ? "Saving" : "Continue"}
      </PrimaryAction>
    );

  if (stage) {
    return (
      <form onSubmit={submit} className="flex flex-1 flex-col" noValidate data-question-kind={question.kind} data-fact-key={question.fact_key}>
        <StagePane
          lead={lead}
          aside={<QuestionArt kind={wording?.art ?? "other"} className="hidden xl:flex" />}
          actions={<ActionRow back={onCancel ? { onClick: onCancel, label: "Back" } : undefined}>{continueButton}</ActionRow>}
        >
          <div className="space-y-4">
            {eyebrow}
            {heading}
            {guidance}
          </div>
          {input}
          <div className="space-y-3">
            {estimateBox}
            {quiet}
          </div>
          <WhyWeAsk question={question} />
        </StagePane>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate data-question-kind={question.kind} data-fact-key={question.fact_key}>
      <div className="space-y-3">
        {eyebrow}
        {heading}
        {guidance}
      </div>
      {input}
      {estimateBox}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
        {continueButton}
        {quiet}
      </div>
      <WhyWeAsk question={question} />
    </form>
  );
}
