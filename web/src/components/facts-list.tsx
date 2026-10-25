"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import type { FactInputBody } from "@/lib/api-types";
import type { FinancialFact } from "@/lib/contracts";
import { formatMoney, normalizeCurrencyInput, NOT_KNOWN } from "@/lib/format";
import { factLabel, factValueText } from "@/lib/labels";
import { factStatusChip } from "@/lib/provenance";
import { Chip } from "@/components/provenance-chip";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Checkbox, Switch } from "@/components/ui/misc";
import { ActionRow } from "@/components/shell";
import { PrimaryAction } from "@/components/system";
import { IconBadge, OptionTiles } from "@/components/visual";
import { AmountInput } from "@/components/intake/amount-input";
import { QuestionArt } from "@/components/intake/question-art";
import { StagePane } from "@/components/intake/stage-pane";
import { EDIT_CHOICES, questionWording } from "@/components/intake/wording";

function isCurrencyFact(f: FinancialFact) {
  return f.value_type === "currency" || /(_monthly|\.total|\.liquid|monthly_payment|balance)$/.test(f.key);
}

function EditRow({
  fact,
  busy,
  onSave,
  onCancel,
}: {
  fact: FinancialFact;
  busy: boolean;
  onSave: (input: FactInputBody) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(fact.value ?? "");
  const [estimate, setEstimate] = React.useState(fact.status === "estimated");
  const [error, setError] = React.useState<string | null>(null);
  const id = `edit-${fact.key}`;

  function save(e: React.FormEvent) {
    e.preventDefault();
    let v: string | null = value.trim();
    if (isCurrencyFact(fact)) {
      v = normalizeCurrencyInput(value);
      if (v === null) return setError("Enter an amount like 4,200 or 4200.50.");
    } else if (!v) {
      return setError("Enter a value.");
    }
    onSave({ key: fact.key, value: v, status: estimate ? "estimated" : "provided", original_representation: value });
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-control bg-canvas p-4" noValidate>
      <Label htmlFor={id}>{factLabel(fact.key)}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode={isCurrencyFact(fact) ? "decimal" : undefined}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        autoFocus
      />
      <FieldError id={`${id}-err`}>{error}</FieldError>
      <div className="flex items-center gap-2.5">
        <Switch id={`${id}-est`} checked={estimate} onCheckedChange={setEstimate} />
        <Label htmlFor={`${id}-est`} className="font-normal text-ink-muted">
          It&apos;s an estimate
        </Label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-ink-subtle">Saving replaces your earlier answer; the old one is kept in the history.</p>
    </form>
  );
}

/** Answered facts with status chips (You told us / Estimate / Not shared) and an edit action. */
export function FactsList({
  facts,
  busy,
  onEdit,
}: {
  facts: Record<string, FinancialFact>;
  busy: boolean;
  onEdit: (input: FactInputBody) => Promise<void>;
}) {
  const [editing, setEditing] = React.useState<string | null>(null);
  const list = Object.values(facts).filter((f) => f.status !== "superseded");
  if (list.length === 0) {
    return <p className="py-2 text-sm text-ink-muted">Your answers will appear here as you go.</p>;
  }
  return (
    <ul className="divide-y divide-line" aria-label="Your answers">
      {list.map((f) => (
        <li key={f.key} className="py-3 first:pt-1 last:pb-1">
          {editing === f.key ? (
            <EditRow
              fact={f}
              busy={busy}
              onCancel={() => setEditing(null)}
              onSave={async (input) => {
                await onEdit(input);
                setEditing(null);
              }}
            />
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] text-ink-muted">{factLabel(f.key)}</p>
                <p className="figure text-[15px] font-medium text-ink">
                  {f.status === "declined" ? "Not shared" : factValueText(f.value, f.value_type, f.key)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Chip spec={factStatusChip(f.status)} />
                <Button variant="ghost" size="icon" aria-label={`Edit ${factLabel(f.key)}`} onClick={() => setEditing(f.key)}>
                  <Pencil aria-hidden />
                </Button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------------------------------
 * EditAnswerPane: edit one earlier answer in the workspace (opened from the rail's Edit links). Saving posts the
 * same POST /facts supersede body as before; the old answer stays in the history.
 * ---------------------------------------------------------------------------------------------- */
export function EditAnswerPane({
  fact,
  busy,
  onSave,
  onCancel,
  lead,
}: {
  fact: FinancialFact;
  busy: boolean;
  onSave: (input: FactInputBody) => void;
  onCancel: () => void;
  lead?: React.ReactNode;
}) {
  const choices =
    EDIT_CHOICES[fact.key] ??
    (fact.value_type === "boolean"
      ? [
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]
      : null);
  const currency = !choices && isCurrencyFact(fact);
  const shown = currency ? formatMoney(fact.value).replace(/^\$/, "") : (fact.value ?? "");
  const initial = fact.status === "declined" || fact.value === null || shown === NOT_KNOWN ? "" : shown;
  const [value, setValue] = React.useState(initial);
  const [estimate, setEstimate] = React.useState(fact.status === "estimated");
  const [error, setError] = React.useState<string | null>(null);
  const id = `edit-${fact.key}`;
  const errId = `${id}-err`;
  const wording = questionWording(fact.key);
  const headline = wording?.headline ?? factLabel(fact.key);
  const now = fact.status === "declined" ? "Not shared" : factValueText(fact.value, fact.value_type, fact.key);
  /** A skipped question has no fact yet: the same form adds it (same POST /facts body). */
  const adding = fact.status === "missing";

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let v: string | null = value.trim();
    if (currency) {
      v = normalizeCurrencyInput(value);
      if (v === null) return setError("Enter an amount like 4,200 or 4200.50.");
    } else if (!v) {
      return setError(choices ? "Choose one option." : "Enter a value.");
    }
    onSave({ key: fact.key, value: v, status: estimate ? "estimated" : "provided", original_representation: value });
  }

  return (
    <form onSubmit={save} className="flex flex-1 flex-col" noValidate data-edit-answer={fact.key}>
      <StagePane
        lead={lead}
        aside={<QuestionArt kind={wording?.art ?? "other"} className="hidden xl:flex" />}
        actions={
          <ActionRow back={{ onClick: onCancel, label: "Cancel" }}>
            <PrimaryAction type="submit" disabled={busy} arrow={false}>
              {busy ? "Saving" : "Save answer"}
            </PrimaryAction>
          </ActionRow>
        }
      >
        <div className="space-y-4">
          <p className="flex items-center gap-3 text-[15px] font-semibold text-brand-strong">
            <IconBadge icon={Pencil} tone="brand" size="sm" />
            {adding ? "Add your answer" : "Change your answer"}
          </p>
          <h1 className="max-w-[40rem] text-pretty text-[length:var(--text-display)] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink">
            {choices ? headline : <label htmlFor={id}>{headline}</label>}
          </h1>
          {adding ? (
            wording?.guidance && <p className="max-w-[var(--measure)] text-[17px] leading-relaxed text-ink-2">{wording.guidance}</p>
          ) : (
            <p className="text-[17px] text-ink-2">
              Your answer now: <span className="tabular font-bold text-ink">{now}</span>
            </p>
          )}
        </div>
        <div className="space-y-3">
          {choices ? (
            <OptionTiles
              name={id}
              legend={headline}
              legendHidden
              options={choices.map((c) => ({ value: c.value, title: c.label }))}
              value={value}
              onChange={(v) => setValue(v)}
              columns={choices.length === 2 ? 2 : 1}
              describedBy={error ? errId : undefined}
              className="max-w-[40rem]"
            />
          ) : (
            <AmountInput
              id={id}
              value={value}
              onValueChange={setValue}
              currency={currency}
              narrow={!currency}
              suffix={wording?.suffix}
              invalid={!!error}
              aria-describedby={error ? errId : undefined}
              autoFocus
            />
          )}
          <FieldError id={errId}>{error}</FieldError>
        </div>
        {currency && (
          <div className="flex items-center gap-3">
            <Checkbox id={`${id}-est`} checked={estimate} onCheckedChange={(v) => setEstimate(v === true)} />
            <label htmlFor={`${id}-est`} className="text-[15px] text-ink-2">
              It&apos;s an estimate
            </label>
          </div>
        )}
        {!adding && <p className="text-[15px] text-ink-2">Saving replaces your earlier answer. The old one stays in the history.</p>}
      </StagePane>
    </form>
  );
}
