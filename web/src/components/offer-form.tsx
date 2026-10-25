"use client";

import * as React from "react";
import { Car, Percent, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { ItemizationItemBody } from "@/lib/api-types";
import type { LoanOffer } from "@/lib/contracts";
import { normalizeCurrencyInput, normalizeIntegerInput, percentToFraction } from "@/lib/format";
import { ErrorState } from "@/components/states";
import { Disclosure, PrimaryAction } from "@/components/system";
import { IconBadge } from "@/components/visual";
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
  cash_down: { key: "cash_down", label: "Cash down payment", kind: "currency", hint: "If you pay it from savings, your savings go down by this much." },
  apr: { key: "apr", label: "APR", kind: "percent", hint: "Annual percentage rate, for example 5.796" },
  term_months: { key: "term_months", label: "Term (months)", kind: "integer", hint: "Number of monthly payments, 6 to 96" },
  monthly_payment: { key: "monthly_payment", label: "Monthly payment on the contract", kind: "currency", hint: "We check it against the other terms." },
  principal: { key: "principal", label: "Principal (amount of the note)", kind: "currency", hint: "Or fill in the amount financed." },
  amount_financed: { key: "amount_financed", label: "Amount financed", kind: "currency", hint: "From the federal disclosure box." },
  prepaid_finance_charges: { key: "prepaid_finance_charges", label: "Prepaid finance charges", kind: "currency", hint: "Loan fees paid up front, if listed." },
  contract_rate: { key: "contract_rate", label: "Contract (interest) rate", kind: "percent", hint: "If different from the APR, for example 4.75" },
  taxes_title_fees: { key: "taxes_title_fees", label: "Taxes, title and fees", kind: "currency" },
  trade_in_value: { key: "trade_in_value", label: "Trade-in value", kind: "currency", hint: "Leave blank if there's no trade-in." },
  trade_in_payoff: { key: "trade_in_payoff", label: "Still owed on the trade-in", kind: "currency" },
};

const ESSENTIAL: FieldDef[] = ESSENTIAL_TERM_KEYS.map((k) => FIELDS[k]);
const DETAILS: FieldDef[] = DETAIL_TERM_KEYS.map((k) => FIELDS[k]);
const ALL_FIELDS: FieldDef[] = [...ESSENTIAL, ...DETAILS];
const DETAIL_KEYS = new Set<string>(DETAIL_TERM_KEYS);

/** Visible groups (every field the calculation needs is here) and the labelled groups under "More details". */
const CAR_KEYS = ["cash_price", "cash_down"];
const LOAN_KEYS = ["apr", "term_months", "monthly_payment"];
const DISCLOSURE_KEYS = ["amount_financed", "principal", "prepaid_finance_charges", "contract_rate"];
const TRADE_KEYS = ["taxes_title_fees", "trade_in_value", "trade_in_payoff"];

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
  large = false,
}: {
  f: FieldDef;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  large?: boolean;
}) {
  const id = `term-${f.key}`;
  const describedBy = [f.hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  const size = large ? "h-14 text-lg font-semibold sm:text-lg" : "h-12";
  const common = {
    id,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    "aria-invalid": !!error,
    "aria-describedby": describedBy,
  };
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-[15px] font-semibold">
        {f.label}
      </Label>
      {f.kind === "currency" && <CurrencyInput {...common} placeholder="0.00" className={size} />}
      {f.kind === "percent" && <PercentInput {...common} placeholder="0.00" className={size} />}
      {f.kind === "integer" && <Input {...common} inputMode="numeric" placeholder="Months" className={size} />}
      {f.hint && (
        <FieldHint id={`${id}-hint`} className="text-sm text-ink-2">
          {f.hint}
        </FieldHint>
      )}
      <FieldError id={`${id}-err`} className="text-sm">
        {error}
      </FieldError>
    </div>
  );
}

function Group({
  icon,
  title,
  note,
  children,
}: {
  icon: React.ComponentProps<typeof IconBadge>["icon"];
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0 rounded-[24px] border border-line bg-surface p-5 sm:p-7">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center gap-3">
        <IconBadge icon={icon} tone="brand" size="sm" />
        <div className="min-w-0">
          <p aria-hidden className="text-lg font-extrabold text-ink">
            {title}
          </p>
          {note && <p className="text-sm text-ink-2">{note}</p>}
        </div>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/**
 * Manual offer entry (POST /sessions/{id}/offers). The terms the calculation needs sit in two short groups (the car,
 * the loan); the rest is in labelled groups under "More details". Rates are typed as % and sent as fractions; nothing
 * is computed here.
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
      setFormError("Some values need fixing. See the highlighted fields.");
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
  const field = (k: string, large = false) => (
    <Field key={k} f={FIELDS[k]} value={values[k] ?? ""} error={errors[k]} onChange={(v) => set(k, v)} large={large} />
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6" data-offer-form="">
      <div className="grid gap-6 2xl:grid-cols-2">
        <Group icon={Car} title="The car" note="What you pay for it and what you put down.">
          {CAR_KEYS.map((k) => field(k, true))}
        </Group>
        <Group icon={Percent} title="The loan" note="From the contract or the dealer's worksheet.">
          {LOAN_KEYS.map((k) => field(k, true))}
        </Group>
      </div>

      <Disclosure
        variant="card"
        open={moreOpen}
        onOpenChange={setMoreOpen}
        className="[&>summary]:min-h-14"
        summary={<span className="text-[17px] font-bold text-ink">More details from the contract</span>}
        meta={detailCount > 0 ? `${detailCount} added` : "Optional"}
      >
        <div className="space-y-8 pt-2">
          <p className="max-w-[var(--measure)] text-[15px] text-ink-2">
            Copy these from the contract if you have them. They make the figures match it exactly.
          </p>
          <fieldset className="space-y-4">
            <legend className="text-[15px] font-extrabold text-ink">Amounts and rate in the disclosure box</legend>
            <div className="grid gap-5 sm:grid-cols-2">{DISCLOSURE_KEYS.map((k) => field(k))}</div>
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-[15px] font-extrabold text-ink">Taxes, fees and trade-in</legend>
            <div className="grid gap-5 sm:grid-cols-2">{TRADE_KEYS.map((k) => field(k))}</div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-[15px] font-extrabold text-ink">Add-ons</legend>
            <p className="text-sm text-ink-2">
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
            <Input id="offer-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="For example, Dealer offer A" />
          </div>
        </div>
      </Disclosure>

      <div className="flex flex-col gap-5 border-t border-line pt-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox id="offer-confirm" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-1" />
            <label htmlFor="offer-confirm" className="text-[15px] leading-relaxed text-ink">
              These values match my loan offer. We label them &ldquo;You confirmed&rdquo;.
            </label>
          </div>
          {formError && (
            <p role="alert" className="text-[15px] font-semibold text-shortfall-ink">
              {formError}
            </p>
          )}
          {serverError && <ErrorState error={serverError} title="The server didn't accept this offer" />}
        </div>
        <PrimaryAction type="submit" disabled={busy} className="shrink-0">
          {busy ? "Checking…" : "Save offer"}
        </PrimaryAction>
      </div>
    </form>
  );
}
