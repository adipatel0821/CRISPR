"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import type { FactInputBody } from "@/lib/api-types";
import type { FinancialFact } from "@/lib/contracts";
import { normalizeCurrencyInput } from "@/lib/format";
import { factLabel, factValueText } from "@/lib/labels";
import { factStatusChip } from "@/lib/provenance";
import { Chip } from "@/components/provenance-chip";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";

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
                  {f.status === "declined" ? "—" : factValueText(f.value, f.value_type, f.key)}
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
