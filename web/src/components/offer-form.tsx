"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { ItemizationItemBody } from "@/lib/api-types";
import type { LoanOffer } from "@/lib/contracts";
import { normalizeCurrencyInput, normalizeIntegerInput, percentToFraction } from "@/lib/format";
import { ErrorState } from "@/components/states";
import { Disclosure, PrimaryAction } from "@/components/system";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/misc";
import { CurrencyInput, FieldError, FieldHint, Input, Label, PercentInput } from "@/components/ui/input";
import { DETAIL_TERM_KEYS, ESSENTIAL_TERM_KEYS } from "@/components/offer/model";

type Kind = "currency" | "percent" | "integer";
interface FieldDef {
  key: string;
  label: string;
  kind: Kind;
  hint?: string;
}

const FIELDS: Record<string, FieldDef> = {
  cash_price: { key: "cash_price", label: "Cash price of the car", kind: "currency", hint: "Before taxes, fees and your down payment." },
  cash_down: { key: "cash_down", label: "Cash down payment", kind: "currency" },
  apr: { key: "apr", label: "APR", kind: "percent", hint: "Annual percentage rate, e.g. 5.796" },
  term_months: { key: "term_months", label: "Term (months)", kind: "integer", hint: "Number of monthly payments, 6–96" },
  monthly_payment: { key: "monthly_payment", label: "Monthly payment on the contract", kind: "currency", hint: "We check it against the other terms." },
  principal: { key: "principal", label: "Principal (amount of the note)", kind: "currency", hint: "Or fill in the amount financed." },
  amount_financed: { key: "amount_financed", label: "Amount financed", kind: "currency", hint: "From the federal disclosure box." },
  prepaid_finance_charges: { key: "prepaid_finance_charges", label: "Prepaid finance charges", kind: "currency", hint: "Loan fees paid up front, if listed." },
  contract_rate: { key: "contract_rate", label: "Contract (interest) rate", kind: "percent", hint: "If different from the APR, e.g. 4.75" },
  taxes_title_fees: { key: "taxes_title_fees", label: "Taxes, title and fees", kind: "currency" },
  trade_in_value: { key: "trade_in_value", label: "Trade-in value", kind: "currency", hint: "Leave blank if there's no trade-in." },
  trade_in_payoff: { key: "trade_in_payoff", label: "Still owed on the trade-in", kind: "currency" },
};

const ESSENTIAL: FieldDef[] = ESSENTIAL_TERM_KEYS.map((k) => FIELDS[k]);
const DETAILS: FieldDef[] = DETAIL_TERM_KEYS.map((k) => FIELDS[k]);
const ALL_FIELDS: FieldDef[] = [...ESSENTIAL, ...DETAILS];
const DETAIL_KEYS = new Set<string>(DETAIL_TERM_KEYS);

interface AddOn {
  id: number;
  name: string;
  amount: string;
  optional: "yes" | "no" | "unknown";
}

function normalise(kind: Kind, raw: string): string | number | null | "invalid" {
  const t = raw.trim();
  if (!t) return null;
  if (kind === "currency") return normalizeCurrencyInput(t) ?? "invalid";
  if (kind === "percent") return percentToFraction(t) ?? "invalid";
  const n = normalizeIntegerInput(t);
  return n === null ? "invalid" : Number(n);
}

const KIND_ERROR: Record<Kind, string> = {
  currency: "Enter an amount like 22,000 or 375.14.",
  percent: "Enter a percentage like 4.75.",
  integer: "Enter a whole number of months.",
};

function Field({
  f,
  value,
  error,
  onChange,
}: {
  f: FieldDef;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  const id = `term-${f.key}`;
  const describedBy = [f.hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    "aria-invalid": !!error,
    "aria-describedby": describedBy,
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{f.label}</Label>
      {f.kind === "currency" && <CurrencyInput {...common} placeholder="0.00" />}
      {f.kind === "percent" && <PercentInput {...common} placeholder="0.00" />}
      {f.kind === "integer" && <Input {...common} inputMode="numeric" placeholder="Months" />}
      {f.hint && <FieldHint id={`${id}-hint`}>{f.hint}</FieldHint>}
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </div>
  );
}

/**
 * Manual offer entry (POST /sessions/{id}/offers): the five terms most contracts show plainly come first,
 * everything else sits behind "More details". Rates are typed as % and sent as fractions; nothing is computed.
 */
export function OfferForm({ onSaved }: { onSaved: (offer: LoanOffer) => void }) {
  const [label, setLabel] = React.useState("");
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [addOns, setAddOns] = React.useState<AddOn[]>([]);
  const [confirmed, setConfirmed] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<ApiError | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const nextId = React.useRef(1);

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  /** Open "More details" when a field inside it needs attention. */
  function revealErrors(errs: Record<string, string>) {
    if (Object.keys(errs).some((k) => DETAIL_KEYS.has(k) || k.startsWith("addon-"))) setMoreOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setServerError(null);
    const errs: Record<string, string> = {};
    const terms: Record<string, string | number | null> = {};
    for (const f of ALL_FIELDS) {
      const v = normalise(f.kind, values[f.key] ?? "");
      if (v === "invalid") errs[f.key] = KIND_ERROR[f.kind];
      else if (v !== null) terms[f.key] = v;
    }
    if (typeof terms.term_months === "number" && (terms.term_months < 6 || terms.term_months > 96)) {
      errs.term_months = "Terms between 6 and 96 months are supported.";
    }
    const itemization: ItemizationItemBody[] = [];
    addOns.forEach((a) => {
      if (!a.name.trim() && !a.amount.trim()) return;
      const amt = normalizeCurrencyInput(a.amount);
      if (amt === null) errs[`addon-${a.id}`] = KIND_ERROR.currency;
      else
        itemization.push({
          item: "add_on",
          name: a.name.trim() || "Add-on",
          amount: amt,
          optional: a.optional === "unknown" ? null : a.optional === "yes",
          financed: true,
        });
    });
    setErrors(errs);
    if (Object.keys(errs).length) {
      revealErrors(errs);
      setFormError("Some values need fixing — see the highlighted fields.");
      return;
    }
    const missing: string[] = [];
    if (terms.principal === undefined && terms.amount_financed === undefined && terms.cash_price === undefined)
      missing.push("the cash price (or the amount financed, under More details)");
    if (terms.apr === undefined && terms.contract_rate === undefined) missing.push("the APR");
    if (terms.term_months === undefined) missing.push("the term");
    if (missing.length) {
      setFormError(`To analyse the loan we need ${missing.join(", ")}.`);
      return;
    }
    if (!confirmed) {
      setFormError("Please confirm the values match your offer.");
      return;
    }
    setBusy(true);
    try {
      const offer = await api.postOffer({ label: label.trim() || "Manual offer", terms, itemization, confirmed: true });
      onSaved(offer);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err);
        const fe = err.fieldErrors();
        if (Object.keys(fe).length) {
          setErrors(fe);
          revealErrors(fe);
        }
      } else setServerError(new ApiError("INTERNAL", String(err), 0));
    } finally {
      setBusy(false);
    }
  }

  const detailCount = DETAILS.filter((f) => (values[f.key] ?? "").trim()).length + addOns.length;

  return (
    <form onSubmit={submit} noValidate className="space-y-7">
      <fieldset className="space-y-5">
        <legend className="sr-only">The main terms</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {ESSENTIAL.map((f) => (
            <Field key={f.key} f={f} value={values[f.key] ?? ""} error={errors[f.key]} onChange={(v) => set(f.key, v)} />
          ))}
        </div>
      </fieldset>

      <Disclosure
        variant="card"
        open={moreOpen}
        onOpenChange={setMoreOpen}
        summary="More details"
        meta={detailCount > 0 ? `${detailCount} added` : "Optional"}
      >
        <div className="space-y-7 pt-2">
          <p className="text-[13px] text-ink-muted">
            Copy these from the contract if you have them — they make the figures match it exactly.
          </p>
          <fieldset className="space-y-4">
            <legend className="sr-only">More loan details</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              {DETAILS.map((f) => (
                <Field key={f.key} f={f} value={values[f.key] ?? ""} error={errors[f.key]} onChange={(v) => set(f.key, v)} />
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-ink">Optional add-ons</legend>
            <p className="text-[13px] text-ink-muted">
              Service contracts, GAP, protection packages. Only mark one optional if the contract says it is.
            </p>
            {addOns.map((a) => (
              <div
                key={a.id}
                className="grid gap-3 rounded-control border border-line bg-surface p-3 sm:grid-cols-[1fr_9rem_10rem_auto] sm:items-end"
              >
                <div className="space-y-1">
                  <Label htmlFor={`addon-name-${a.id}`}>Name</Label>
                  <Input
                    id={`addon-name-${a.id}`}
                    value={a.name}
                    onChange={(e) => setAddOns((l) => l.map((x) => (x.id === a.id ? { ...x, name: e.target.value } : x)))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`addon-amt-${a.id}`}>Amount</Label>
                  <CurrencyInput
                    id={`addon-amt-${a.id}`}
                    value={a.amount}
                    aria-invalid={!!errors[`addon-${a.id}`]}
                    onChange={(e) => setAddOns((l) => l.map((x) => (x.id === a.id ? { ...x, amount: e.target.value } : x)))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`addon-opt-${a.id}`}>Optional?</Label>
                  <select
                    id={`addon-opt-${a.id}`}
                    value={a.optional}
                    onChange={(e) =>
                      setAddOns((l) => l.map((x) => (x.id === a.id ? { ...x, optional: e.target.value as AddOn["optional"] } : x)))
                    }
                    className="h-11 w-full rounded-control border border-line-strong bg-surface px-2 text-sm"
                  >
                    <option value="unknown">Not sure</option>
                    <option value="yes">Yes, it&apos;s optional</option>
                    <option value="no">No, required</option>
                  </select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${a.name || "add-on"}`}
                  onClick={() => setAddOns((l) => l.filter((x) => x.id !== a.id))}
                >
                  <Trash2 aria-hidden />
                </Button>
                <FieldError className="sm:col-span-4">{errors[`addon-${a.id}`]}</FieldError>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAddOns((l) => [...l, { id: nextId.current++, name: "", amount: "", optional: "unknown" }])}
            >
              <Plus aria-hidden /> Add an add-on
            </Button>
          </fieldset>

          <div className="max-w-sm space-y-1.5">
            <Label htmlFor="offer-label">Name this offer (optional)</Label>
            <Input id="offer-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Dealer offer A" />
          </div>
        </div>
      </Disclosure>

      <div className="space-y-4 border-t border-line pt-6">
        <div className="flex items-start gap-3">
          <Checkbox id="offer-confirm" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
          <label htmlFor="offer-confirm" className="text-sm leading-relaxed text-ink">
            These values match my loan offer. (They&apos;ll be labelled “You confirmed”.)
          </label>
        </div>
        {formError && (
          <p role="alert" className="text-sm font-medium text-deficit">
            {formError}
          </p>
        )}
        {serverError && <ErrorState error={serverError} title="The server didn't accept this offer" />}
        <PrimaryAction type="submit" disabled={busy} arrow={false}>
          {busy ? "Checking…" : "Save offer"}
        </PrimaryAction>
      </div>
    </form>
  );
}
