# Stage 02 Review — Document Intelligence, Extraction & Grounding

**Reviewer:** Review Agent 2 (simulated, scoped pass) · **Reviewed:** `stage_02_architecture.md` v1.0, `document_intelligence_flow.mmd`, contracts §3.5–3.6, Stage 3 F01/F05 · **Date:** 2026-10-24

## 1. Executive verdict

**REVISE.** The pipeline shape stays: PyMuPDF, then Gemini schema extraction with page and quote, then programmatic checks, then user confirmation, with manual fallback. Four weaknesses need fixing:

1. **Consistency is not correctness.** A consistently wrong extraction passes every arithmetic check.
2. **Term semantics.** The LoanOffer has no principal (note amount), so the engine computes payments on the wrong base.
3. **Self-reported confidence** is shown to users though it carries no calibrated meaning.
4. **Data handling.** Gemini's unpaid tier forbids sensitive data.

The fix adds a **deterministic label-anchored second reader** for the TILA box, **label co-location checks**, **itemization reconciliation**, and an explicit **LLM data mode**.

## 2. Existing architecture summary

Upload validation; text mode (with redaction) or image mode (with consent); one extraction call with value, page and quote per field; checks (quote match, TILA identities, APR within ⅛ pt, ranges, product type); then a verification table where the user confirms, edits or marks each field missing. Manual entry is the fallback.

## 3. Detailed user journey

Upload → progress (5–15 s) → table of terms with quotes and check marks → confirm/edit each → "ready" or "what's missing / ask the lender". If extraction fails: manual form. If the product is unsupported: explanation, no calculation.

## 4. Detailed technical workflow

`validate → sanitize → text layer → mode → (redact) → LLM extraction → schema check → quote match → arithmetic → range → product type → table → user action → LoanOffer.ready`

## 5. Algorithms and technology review

| Element | Assessment |
|---|---|
| PyMuPDF text and pixmaps | Correct, dependency-light. Keep. |
| Gemini structured output with quotes | Appropriate and verified capability. Keep. |
| Quote match (exact → normalized → fuzzy ≥ 90) | Necessary but insufficient. It proves the text exists, not that it belongs to *this field* (S2-ISSUE-001). |
| TILA arithmetic identities | Necessary but insufficient. A self-consistent wrong row passes (S2-ISSUE-002). |
| `extraction_confidence` (high/medium/low) | Uncalibrated. Displaying it invites false trust (S2-ISSUE-004). |
| Keyword product detection | False positives on negations ("no balloon payment") (S2-ISSUE-006). |

## 6. Verified strengths

Evidence per field. No extracted value reaches the engine without user action. Unsupported products are blocked. Prompt-injection posture is sound by construction (no tools, schema-only, evidence requirement).

## 7. Identified weaknesses

| ID | Severity | Issue |
|---|---|---|
| S2-ISSUE-001 | High | **Quote ≠ field.** A quote like "$19,500.00" may exist in the document but under "Cash Price" or "Amount Financed". Matching the value text doesn't prove the label. |
| S2-ISSUE-002 | High | **Consistent-but-wrong extraction.** Example: the model reads APR and Finance Charge from a *different* scenario column on a dealer worksheet (e.g., a 72-month option). AF + FC = TOP and payment × n = TOP still hold, because they are a coherent alternative offer. The arithmetic passes and the wrong offer is analyzed. |
| S2-ISSUE-003 | Critical | **No principal / note amount.** v1.0 `LoanOffer` treats `amount_financed` as the computation base. Reg Z §1026.18(b): AF = principal (or cash price − down) + other financed amounts − prepaid finance charges. Interest accrues on the principal. With $500 of prepaid finance charges on a $20,000 note at 4.75%/60, computing on AF understates the payment by $9.38/mo and total of payments by $562.68 (reproduced today). |
| S2-ISSUE-004 | Medium | The model's self-reported confidence is shown in the UI. LLM self-confidence is not a calibrated probability, so displaying it adds false precision. |
| S2-ISSUE-005 | Medium | **APR reproduction false alarms.** Odd first periods, deferred first payments, or day-count conventions can make a correct disclosed APR fail a monthly-regular recompute. v1.0 marks both fields `conflicting`, wrongly accusing a correct document. |
| S2-ISSUE-006 | Medium | Keyword product detection blocks on negations ("This is not a variable-rate loan"). |
| S2-ISSUE-007 | Medium | **Manual entry bypasses checks.** Typed manual terms skip arithmetic checks, so typos ($3,750 for $375) flow through. |
| S2-ISSUE-008 | High | **Data terms.** Gemini API Additional Terms (fetched today): on unpaid services, content may be used to improve Google products and read by human reviewers, and users are told not to submit sensitive, confidential or personal information. v1.0 only said "verify terms". Real loan documents on the free tier would violate this. |
| S2-ISSUE-009 | Medium | **No itemization.** Retail installment contracts include an *itemization of amount financed* (cash price, taxes, fees, add-ons, trade-in payoff). v1.0 extracts some items but never reconciles them to AF, so it misses rolled-in negative equity and unwanted add-ons, the main consumer-harm patterns cited in the project research. |
| S2-ISSUE-010 | Low | The File API stores uploads for 48 h. Inline requests (≤ 20 MB) avoid provider-side file storage; v1.0 didn't prefer inline. |
| S2-ISSUE-011 | Medium | **"Verified" = user confirmation** (same as S1-ISSUE-002). After S1, a term's `verification` must distinguish `evidence_matched` from `user_confirmed`. |

## 8. Architectural contradictions

S2-ISSUE-003: Stage 2's `ready_for_calculation` accepts AF alone, while Stage 3's own APR example used a payment computed on $20,000 with AF $19,500. Same project, two bases.

## 9. Relevant research findings

- Reg Z §1026.18(b) and its commentary (✅ 2026-10-24): definitions of principal loan amount, prepaid finance charge, and amount financed; the creditor's option to include fees in the principal.
- Gemini API terms (✅ 2026-10-24): unpaid vs paid data use. On paid services, prompts and responses are not used to improve products.
- Gemini document understanding (✅ earlier today): inline ≤ 20 MB; File API storage is 48 h.

## 10. Alternatives considered

| Option | Verdict |
|---|---|
| Add a second LLM pass ("self-check") | Rejected: correlated errors, doubled latency |
| **Deterministic label-anchored reader for the TILA box (regex near the five federal box labels) + label co-location check for all fields** | **Selected.** An independent method that is cheap and auditable, and works in text mode. |
| Managed OCR key-value (Document AI) as a second reader | Deferred (setup time; useful for scans in production) |

## 11. Recommended changes

| Change | Resolves |
|---|---|
| **R2-01 Label co-location.** The extraction schema returns `label_text` and `value_text`. The verifier requires both on the same page within N characters (text mode). The label must match a field-specific synonym list (e.g., APR: "ANNUAL PERCENTAGE RATE"). Failure → check `label_anchor: fail`. | 001 |
| **R2-02 Independent reader.** In text mode, deterministic regex extraction of the five TILA box values (AF, FC, APR, TOP, TSP) by their mandated labels. Agreement with the LLM → `independent_reader: agree`. Disagreement → field `conflicting`, and both candidates are shown with evidence. | 001, 002 |
| **R2-03 Scenario-column guard.** The schema requires `document_offers_count`. If > 1 (multiple payment options), the user must pick which offer they are evaluating before verification. | 002 |
| **R2-04 Principal and itemization.** Add terms `principal` (note amount), `itemization[]` (cash price, taxes/title, fees, add-ons, payoff of prior loan) and `negative_equity_rolled_in` (calculated). Reconcile: `cash_price + taxes + fees + add_ons + prior_payoff − cash_down − trade_value = AF + PFC (± $1)` where all present. | 003, 009 |
| **R2-05 Payment basis rule.** Principal = stated principal, else AF + PFC when PFC is known, else AF with assumption `a_pfc_zero` ("assumes no prepaid finance charges; if your payment differs from ours, fees may have been financed"). Then the stated-vs-computed payment check catches the discrepancy. | 003 |
| **R2-06 Drop confidence from the UI.** Keep `model_self_report` internally for logs only. Users see check results. | 004 |
| **R2-07 APR non-reproduction = warning.** If the recomputed APR is outside ⅛ pt *and* other identities pass, set `checks.apr: warn` with an explanation; do not mark it conflicting. | 005 |
| **R2-08 Product type.** Use extracted booleans with quotes, not keywords. A keyword hit without a positive boolean → user confirmation ("Is this a variable-rate loan?"). | 006 |
| **R2-09 Manual entry checks.** Manual offers pass the same arithmetic and range checks, with warnings shown inline. | 007 |
| **R2-10 LLM data mode.** Config `LLM_DATA_MODE ∈ {paid, synthetic_only, off}`. In `synthetic_only` (any unpaid key), uploads are restricted to the bundled synthetic demo documents and free-text parsing is disabled (typed widgets only). Real-user upload requires `paid`. The UI states the mode. | 008 |
| **R2-11 Inline requests only (≤ 20 MB, ≤ 30 pages).** No File API in the MVP. | 010 |
| **R2-12 Verification state** per S1 R1-04: `evidence_matched` requires a quote match plus label anchor (plus independent reader where applicable), and is distinct from `user_confirmed`. | 011 |

## 12. Updated workflow description

```
validate → sanitize → text layer → mode
 → [LLM extraction: value, value_text, label_text, page, quote; offers_count; itemization]
 → [deterministic TILA reader (text mode)]
 → checks: quote_match, label_anchor, independent_reader, arithmetic, itemization_reconcile, apr(warn), range, product_type(booleans)
 → if offers_count > 1: choose offer
 → table (evidence + checks; no confidence) → per-field user action
 → LoanOffer (principal resolved per R2-05) → ready_for_calculation
```

## 13. Input and output contracts (changes)

`VerifiedFinancialTerm`: `verification` enum; `checks` adds `label_anchor`, `independent_reader` and `itemization`; `apr` check allows `warn`; `extraction_confidence` renamed `model_self_report` (internal). `LoanOffer`: adds `principal`, `cash_down`, `itemization[]`, `negative_equity_rolled_in`, `trade_in_equity`, `offer_choice`; the minimum computable set is revised (see contracts v1.1 §3.6).

## 14. Cross-stage dependencies

S3 consumes `principal` (payment) and `amount_financed` (APR). S1 does not ask loan questions; the readiness "awaiting offer" state replaces them. S6 renders two-candidate conflicts and the offer chooser.

## 15. Failure handling

| Case | Handling |
|---|---|
| Independent reader disagrees | Field conflicting; user picks |
| Multiple offers | Chooser |
| APR not reproducible | Warning with explanation |
| Unpaid tier | Synthetic-only mode |
| Extraction failure | Manual entry (with checks) |

## 16. Security and privacy

R2-10 is the material change: **do not send real financial documents to unpaid Gemini quota.** For the hackathon demo, use synthetic contracts, or enable billing on the project and run in `paid` mode. Redaction and image-mode consent remain. Inline-only removes 48 h provider file storage.

## 17. Performance implications

The deterministic reader adds < 50 ms. Extraction latency is unchanged (one LLM call).

## 18. MVP vs future scope

**MVP:** text-PDF extraction, independent TILA reader, label anchors, itemization reconciliation, offer chooser, manual entry with checks, data mode.
**Deferred:** image mode for scans (enhanced, after CP2), bounding-box highlights, managed OCR second reader.

## 19. Acceptance tests

| ID | Test | Pass |
|---|---|---|
| A-05r | Ground-truth set (text PDFs) | Five TILA fields: report measured accuracy; any disagreement must surface as `conflicting`, never silently accepted |
| A-06r | Seeded inconsistencies + **two-option dealer sheet** | Offer chooser appears; wrong-column extraction is caught by the reader or the chooser |
| A-24 | Principal basis | Contract with $500 PFC: engine payment equals the disclosed payment ± $0.01; v1.0 basis would fail by $9.38 |
| A-25 | Negation | "No balloon payment" text does not block |
| A-26 | Data mode | With an unpaid key, a real (non-fixture) upload is refused with an explanation |
| A-27 | Manual typo | A payment of $3,751.40 vs computed $375.14 shows a warning |

## 20. Verdict

**REVISE.**

## 21. Implementation readiness

Ready after contract v1.1. Difficulty: medium. The reader and itemization add about 2–3 developer-hours.

## 22. Sources and evidence

Reg Z §1026.18 (✅ https://www.consumerfinance.gov/rules-policy/regulations/1026/18/ , 2026-10-24); Gemini API terms (✅ https://ai.google.dev/gemini-api/terms , 2026-10-24); Gemini document processing (✅ https://ai.google.dev/gemini-api/docs/document-processing , 2026-10-24); `verify.py` (principal basis).

## Required changes to existing repository files

- `stage_02_architecture.md`: §9–12, §16–18, §21.
- `stage_02_technical_stack.docx`.
- Contracts §3.5–3.6.
- `document_intelligence_flow.mmd`.
- Risk register (R-01, new R-17 data terms).
- Acceptance plan (A-05r, A-06r, A-24–A-27).
