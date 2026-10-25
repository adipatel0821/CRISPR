import { test } from "node:test";
import assert from "node:assert/strict";
import {
  confirmRemaining,
  keyTerms,
  reviewState,
  reviewStatusText,
  DETAIL_TERM_KEYS,
  ESSENTIAL_TERM_KEYS,
} from "./model.ts";
import type { LoanOffer, VerifiedFinancialTerm } from "../../lib/contracts.ts";

const term = (term_key: string, value: string | null, status = "provided"): VerifiedFinancialTerm =>
  ({ term_key, value, status, value_type: "currency", checks: {}, alternatives_found: [] }) as unknown as VerifiedFinancialTerm;
const offerOf = (...ts: VerifiedFinancialTerm[]) =>
  ({ terms: Object.fromEntries(ts.map((t) => [t.term_key, t])) }) as unknown as Pick<LoanOffer, "terms">;

test("essential and detail field lists do not overlap", () => {
  const e = new Set<string>(ESSENTIAL_TERM_KEYS);
  for (const k of DETAIL_TERM_KEYS) assert.equal(e.has(k), false, k);
});

test("keyTerms picks headline terms in order and skips unknown values", () => {
  const o = offerOf(
    term("term_months", "60"),
    term("cash_price", "22000.00"),
    term("monthly_payment", "375.14"),
    term("apr", null),
    term("amount_financed", "19500.00"),
  );
  assert.deepEqual(keyTerms(o).map((t) => t.term_key), ["monthly_payment", "term_months", "amount_financed"]);
});

test("keyTerms falls back to the principal when the amount financed is unknown", () => {
  const o = offerOf(term("monthly_payment", "375.14"), term("principal", "20000.00"));
  assert.deepEqual(keyTerms(o).map((t) => t.term_key), ["monthly_payment", "principal"]);
});

test("reviewState counts conflicts and unreviewed terms; a correction resolves a conflict", () => {
  const terms = [term("apr", "0.05796"), term("monthly_payment", "375.14", "conflicting"), term("term_months", "60")];
  let s = reviewState(terms, {});
  assert.deepEqual(s.conflicts, ["monthly_payment"]);
  assert.equal(s.unreviewed.length, 3);
  assert.match(reviewStatusText(s), /Choose a value for 1 disagreeing term first/);
  const confirmed = confirmRemaining(terms, {});
  assert.deepEqual(Object.keys(confirmed).sort(), ["apr", "term_months"]);
  s = reviewState(terms, { ...confirmed, monthly_payment: { action: "correct", value: "375.14" } });
  assert.deepEqual(s.conflicts, []);
  assert.equal(reviewStatusText(s), "All values reviewed.");
});

test("confirmRemaining keeps existing actions", () => {
  const terms = [term("apr", "0.05796"), term("term_months", "60")];
  const out = confirmRemaining(terms, { apr: { action: "reject" } });
  assert.equal(out.apr.action, "reject");
  assert.equal(out.term_months.action, "confirm");
  assert.equal(reviewStatusText(reviewState(terms, { apr: { action: "reject" } })), "1 of 2 checked · 1 value not reviewed yet.");
});
