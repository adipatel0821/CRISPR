# Stage 02 — AI Financial Document Intelligence

> **Version 1.1 (post-audit, 2026-10-24).** Revised per `reviews/stage_02_review.md` (verdict REVISE). Main changes: principal (note amount) and itemization added so the engine computes on the correct base (CH-06); label co-location checks, a deterministic TILA-box reader as an independent second reader, and an offer chooser for multi-option sheets (CH-07); `LLM_DATA_MODE` because Gemini unpaid-tier terms prohibit sensitive data, plus inline requests only (CH-08); verification levels distinct from user confirmation (CH-09); model confidence internal only (CH-34); negation-safe product detection (CH-35); manual entry gets the same checks (CH-36). Scanned/image mode moves to enhanced scope.

**Agent:** Stage Architecture Agent 2 · **Reviewed by:** Supervisor (Phase C: review with Agent 3) · **Contracts:** `supervisor/api_and_data_contracts.md` v1.1 (authoritative schemas)
**Research date:** 2026-10-24. ✅ = fetched today; ◻ = known documentation URL, not re-fetched today.

---

## 1. Stage objective

Turn an uploaded loan document (retail installment contract, lender offer sheet, TILA disclosure) into a `LoanOffer` whose every term is a `VerifiedFinancialTerm` with verbatim evidence, programmatic consistency checks, and explicit user confirmation — so that no AI-read number reaches the calculation engine unverified.

## 2. Problem decomposition

1. Validate and ingest the file safely (type, size, pages, prompt-injection surface).
2. Extract text (text layer) and page images (for scans) deterministically.
3. Extract candidate terms with an LLM constrained to a JSON schema, each with a verbatim quote and page.
4. Verify: quote-in-text match, arithmetic consistency, range sanity, product-type detection.
5. Present to the user for confirmation/edit; mark missing/conflicting fields; block unsupported products.
6. Emit `LoanOffer` with `ready_for_calculation` and full provenance.

## 3. Functional requirements

- FR1 Accept text PDFs ≤ 10 MB, ≤ 30 pages (MVP). Scans and photos are enhanced scope.
- FR2 Extract the five TILA box values (APR, finance charge, amount financed, total of payments, total sale price), plus principal, contract rate, term, payment, cash price, taxes/title/fees, cash down, trade-in value and payoff, prepaid finance charges (and whether paid in cash), add-ons with an optional flag, prepayment penalty, late fee, variable-rate and balloon indicators, and the itemization of amount financed.
- FR3 Every value carries `page`, `label_text`, `value_text` and a verbatim `quote`. The verifier checks the quote exists **and** the label sits next to the value.
- FR4 Run an independent deterministic reader for the TILA box in text mode, and compare it with the LLM.
- FR5 Detect multiple offers in one document (`document_offers_count`); require the user to pick one.
- FR6 Run arithmetic, itemization, APR-recompute (warn-only), range and product-type checks before the user sees the table.
- FR7 Per-field confirm / edit / mark-missing, recorded in `verification`.
- FR8 Manual entry produces the same `LoanOffer` shape and runs the same checks.
- FR9 Respect `LLM_DATA_MODE`. In `synthetic_only`, only bundled demo documents may be uploaded.

## 4. Nonfunctional requirements

- End-to-end extraction ≤ 30 s p95 for a 6-page contract; UI shows progress.
- Documents are never stored beyond the session TTL; raw files deleted after extraction completes (text + evidence kept for the session only).
- Model output is schema-validated; a malformed response is retried once, then falls back to manual entry.
- Prompt-injection resistant by construction (no tools, schema-only output, verbatim-quote requirement).

## 5. Data requirements

Sample documents for testing: CFPB TILA-RESPA sample forms are mortgage-specific but useful for the TILA box layout (◻ https://www.consumerfinance.gov/compliance/compliance-resources/mortgage-resources/tila-respa-integrated-disclosures/forms-samples/, from project file); the team must author 4–6 synthetic auto retail installment contracts (text PDF, scanned PDF, photo) with known ground truth. No real customer documents are used.

## 6. Research findings

- **Gemini document understanding** ✅ (https://ai.google.dev/gemini-api/docs/document-processing, verified 2026-10-24): native PDF vision (text + layout + tables), up to 1,000 pages, 258 tokens per page; inline requests ≤ 20 MB, File API for larger (files stored 48 h). This covers scanned contracts without a separate OCR engine.
- **Gemini structured output** ✅ (https://ai.google.dev/gemini-api/docs/structured-output): JSON Schema / Pydantic schemas; property ordering preserved on current models; `response_mime_type: application/json`. Model names on the docs page today include `gemini-3.5-flash`; the exact model string must be confirmed on the models page at implementation time (◻ https://ai.google.dev/gemini-api/docs/models).
- **PyMuPDF** ◻ (https://pymupdf.readthedocs.io/en/latest/): `page.get_text("dict")` returns text with bounding boxes; `page.get_pixmap()` renders pages for image paths; no external binaries. Detects whether a text layer exists (empty text ⇒ scanned).
- **TILA disclosures** — Regulation Z §1026.18 lists the required closed-end disclosures (amount financed, finance charge, APR, total of payments, total sale price, payment schedule, prepayment, late fees, variable rate) and §1026.22 sets APR accuracy tolerance (⅛ of 1 percentage point for regular transactions). ◻ https://www.consumerfinance.gov/rules-policy/regulations/1026/ (interactive Reg Z, from project file). These five fields are the extraction target and the arithmetic check basis (project file §2: total loan cost = amount financed + finance charge).
- **Dealer practices that extraction must surface** (project file §3): add-ons rolled into the loan (GAP: cost must be in APR if required), bait-and-switch rates, spot delivery, blank forms. Hence: add-ons extracted with `optional` flag; `contract_rate` and `apr` extracted separately; "prepayment penalty" extracted as text + boolean.
- **Prompt injection via documents** — OWASP's LLM Top 10 lists indirect prompt injection as a primary risk for document-processing LLM apps (◻ https://owasp.org/www-project-top-10-for-large-language-model-applications/). Mitigations we adopt: no tools/function calling in the extraction call; strict output schema; evidence must be verbatim in the document; instruction-like text in output free-text fields rejected; the model is told the document is untrusted data.

## 7. Alternatives investigated

| Option | Description | Strengths | Weaknesses |
|---|---|---|---|
| A. PyMuPDF + regex/rules | Deterministic patterns for "ANNUAL PERCENTAGE RATE", etc. | Fully auditable, free, fast | Brittle across layouts; fails on scans; high authoring cost per template |
| B. Gemini-only | Send PDF, get JSON | Fastest to build; handles scans | No independent verification; hallucination risk; evidence not checkable |
| **C. Hybrid (recommended)** | PyMuPDF text/pixmaps → Gemini structured extraction with verbatim quotes → programmatic verification → human confirmation | Checkable evidence; scans supported; LLM cannot "invent" a number that survives verification | Two components; quote matching needs fuzzy logic for OCR noise |
| D. Cloud Document AI (Google Document AI / AWS Textract) + rules | Managed OCR + key-value extraction | Strong OCR, bounding boxes | Account setup, IAM, quotas, and billing in-event; still needs an LLM for semantics |
| E. Open-source layout models (LayoutLMv3/Donut) | Fine-tuned extraction | Private, offline | No labeled data; training out of scope for 24 h |

## 8. Comparative decision matrix

| Criterion (weight) | A | B | **C** | D | E |
|---|---|---|---|---|---|
| Correctness & reliability (25%) | 3 | 3 | 5 | 4 | 3 |
| Hackathon feasibility (20%) | 4 | 5 | 4 | 2 | 1 |
| Integration simplicity (15%) | 5 | 4 | 4 | 3 | 2 |
| Functional capability (15%) | 2 | 4 | 5 | 4 | 4 |
| Explainability (10%) | 5 | 2 | 5 | 4 | 3 |
| Performance & cost (10%) | 5 | 4 | 4 | 2 | 2 |
| Extensibility (5%) | 2 | 4 | 4 | 4 | 3 |
| **Weighted** | **3.70** | **3.75** | **4.50** | **3.25** | **2.50** |

*Sensitivity test:* B overtakes C only if correctness and explainability weights are both set to zero — contrary to the mission. A becomes competitive (4.0+) only if the capability weight is zeroed. Robust.

## 9. Recommended architecture

```
upload → data-mode gate → validate (magic bytes, size, pages, not encrypted) → re-save via PyMuPDF → text per page
      → text density check (MVP: text PDFs; image mode = enhanced, with consent)
      → redact SSN / account numbers / email / phone
      → LLM extraction (inline request, temperature 0): value, value_text, label_text, page, quote per field; offers_count; itemization
      → deterministic TILA reader (regex near the federal box labels: AMOUNT FINANCED, FINANCE CHARGE, ANNUAL PERCENTAGE RATE, TOTAL OF PAYMENTS, TOTAL SALE PRICE)
      → verifier: quote_match, label_anchor, independent_reader, arithmetic, itemization, apr_recompute (warn), range, product_type (booleans)
      → offer chooser if offers_count > 1 → verification table → user actions → LoanOffer (principal resolved by engine F00)
```

One LLM call per document. No File API (inline only; avoids 48 h provider-side storage).

## 10. Detailed processing workflow

1. **Data mode gate:** `paid` allows user documents; `synthetic_only` accepts only bundled fixtures (`DATA_MODE_RESTRICTED` otherwise); `off` means manual entry only.
2. **Validate** and **sanitize** (as v1.0).
3. **Text layer** per page; record text density. Low-density documents in the MVP are routed to manual entry with an explanation.
4. **Extraction call** with untrusted-document framing, no tools, schema-only output.
5. **Deterministic reader** on the same page text.
6. **Verify** (§11).
7. **Offer chooser** when needed.
8. **Verification table** (Stage 6).
9. **Finalize** the `LoanOffer`; delete the raw file.

## 11. Algorithms and reasoning strategies

**Quote match.** Exact → normalized (whitespace, case, currency symbols) → fuzzy partial ratio ≥ 90 (RapidFuzz). This proves the text exists, nothing more.

**Label anchor (new).** `label_text` must match the field's synonym list (e.g., APR: "ANNUAL PERCENTAGE RATE"; amount financed: "AMOUNT FINANCED"; principal: "PRINCIPAL", "AMOUNT OF NOTE", "LOAN AMOUNT"). `value_text` must appear within 120 characters of the label on the same page. Failure → `label_anchor: fail`, and the field cannot reach `evidence_matched`.

**Independent reader (new).** For the five TILA box fields, a regex extractor finds the first currency or percentage after each mandated label. If it agrees with the LLM (exact after normalization) → `independent_reader: pass`. If it disagrees → `status: conflicting` with both candidates and their evidence. If it finds nothing → `not_applicable`.

**Offer chooser (new).** If the schema reports `document_offers_count > 1` (multi-term dealer worksheets), the user picks the offer before verification. This blocks the consistent-but-wrong-column failure (S2-ISSUE-002).

**Arithmetic identities** (tolerance $1.00): AF + FC ≈ TOP; payment × n ≈ TOP (final payment may differ); TSP ≈ TOP + cash down (+ positive trade equity).

**Itemization reconciliation (new):** cash price + taxes/title/fees + add-ons + trade payoff − cash down − trade value ≈ AF + financed PFC.

**APR recompute (changed):** solve on amount financed (engine F05). Outside ⅛ pt while the other identities pass → `warn` with an explanation (odd first period, deferred first payment), never `conflicting` on its own.

**Range sanity:** as v1.0.

**Product type (changed):** block only when the extracted boolean (`variable_rate_present`, `balloon_payment_present`, lease, precomputed) is true **with a quote**. A keyword hit without a positive boolean → ask the user. Negations ("no balloon payment") never block.

**Verification state:** `evidence_matched` = quote_match pass + label_anchor pass + (independent_reader pass where applicable). Confirming then makes it `evidence_matched_user_confirmed`. Edited values become `provided` with `user_confirmed`. Model self-confidence is logged as `model_self_report` and never displayed or used.

## 12. Data models and schemas

Extraction schema v1.1 (Pydantic → JSON Schema):

```
ExtractedTerm { value: str|null, unit, page: int|null, label_text: str|null, value_text: str|null, quote: str|null, self_report: "high"|"medium"|"low" }
LoanDocumentExtraction {
  document_type, document_offers_count: int, offers_labels: [str],
  cash_price, taxes_title_fees, cash_down, trade_in_value, trade_in_payoff, principal, amount_financed,
  prepaid_finance_charges, pfc_paid_in_cash: bool|null, apr, contract_rate, term_months, monthly_payment,
  payment_count, first_payment_date, finance_charge, total_of_payments, total_sale_price,
  prepayment_penalty_present, prepayment_penalty_text, late_fee_text, variable_rate_present, balloon_payment_present,
  add_ons: [{name, price, optional: bool|null, quote, page}], itemization: [{item, amount, quote, page}]
}
```

These map 1:1 onto `LoanOffer` (contracts v1.1 §3.6). Free-text fields are capped at 200 characters and screened for instruction-like content.

## 13. Inputs and outputs

**Inputs:** file bytes, session_id. **Outputs:** `doc_id`, `LoanDocumentExtraction` (internal), `VerifiedFinancialTerm[]`, `LoanOffer` draft; after verification, `LoanOffer` final.

## 14. API interaction requirements

`POST /sessions/{id}/documents` (async job; returns `doc_id`, poll `GET /documents/{doc_id}` with `status: processing|ready|failed`), `POST /documents/{doc_id}/verify`, `POST /sessions/{id}/offers` (manual). Gemini SDK: `google-genai` Python package (◻ https://googleapis.github.io/python-genai/); API key via environment variable; timeout 30 s; 1 retry on schema failure.

## 15. Integration dependencies

- **Stage 3:** F00 principal resolution, F01 payment (mismatch check), F05 APR on amount financed. In-process import; no duplicated math.
- **Stage 1:** readiness shows `awaiting_offer` while extraction runs. The interview never asks loan terms.
- **Stage 6:** verification table with evidence (label + value + quote), check states, two-candidate conflicts, offer chooser, payment-mismatch explanation, data-mode banner.

## 16. Error and failure handling

| Failure | Handling |
|---|---|
| `synthetic_only` + non-fixture upload | 403 `DATA_MODE_RESTRICTED`; manual entry offered |
| Invalid, oversized or encrypted file | 400; manual entry |
| Scanned (low text density) in MVP | Manual entry with explanation (image mode is enhanced) |
| LLM timeout or outage | `LLM_UNAVAILABLE`; manual entry |
| Malformed JSON | Retry once, then manual entry |
| Reader disagreement | Field `conflicting`; user picks or edits |
| Multiple offers | Chooser before verification |
| APR not reproducible | `warn` with explanation |
| Arithmetic or itemization conflict | Fields flagged; user resolves |
| Unsupported product (boolean + quote) | 422 with explanation; terms still shown |

## 17. Security and privacy

- **Gemini data terms (verified 2026-10-24).** On unpaid quota, content may be used to improve Google products and may be read by human reviewers, and Google says not to submit sensitive, confidential or personal information. On paid services, prompts and responses are not used to improve products. Hence `LLM_DATA_MODE`: real user documents require `paid`; the hackathon demo runs `synthetic_only` unless billing is enabled.
- Inline requests only (no File API storage). Raw files are deleted after extraction; page text and quotes persist for the session (24 h TTL).
- Redaction before text-mode calls; image mode (enhanced) needs explicit consent because images can't be redacted.
- Prompt injection: untrusted framing, no tools, schema-only output, evidence plus label anchor, independent reader, instruction screening.
- Secrets in environment only.

## 18. Testing and evaluation

Ground truth: ≥ 4 synthetic text-PDF contracts with labeled fields, including a **two-option dealer worksheet**, a contract with **$500 of financed prepaid finance charges**, a negative-equity trade-in, and a contract stating "no balloon payment". Tests: A-05r (measured field accuracy; every reader disagreement surfaces as conflicting), A-06r (chooser and wrong-column capture), A-14 (injection), A-24 (principal basis), A-25 (negation), A-26 (data mode), A-27 (manual typo warning). Results are reported as measured, with sample sizes.

## 19. Performance and cost estimates

Text-mode call ≈ 4k input tokens for a 6-page contract (+258 tokens/page if images are attached ✅), ~600 output tokens; latency 5–15 s on a Flash-tier model (estimate, not benchmarked). Cost at hackathon volume is negligible under the free tier/credits; production cost scales with pages (assumption: ≤ $0.01–0.05 per document on a Flash-tier model — **verify against the current pricing page** ◻ https://ai.google.dev/gemini-api/docs/pricing).

## 20. MVP, enhanced, and production scope

- **MVP:** text-PDF extraction, independent TILA reader, label anchors, itemization, chooser, verification table, manual entry with checks, data mode, unsupported-product block.
- **Enhanced:** image mode for scans and photos (consent), bounding-box highlights, comparing several uploaded offers.
- **Production:** managed OCR second reader for scans, PII classification, vendor DPA review, audit-log retention.

## 21. Architectural decision records

**ADR-S2-01 Extraction strategy** — Hybrid (C). Evidence: verifiability requirement; scans. Rejected: Gemini-only (unverifiable), rules-only (brittle), Document AI (setup time), fine-tuned models (no data). Confidence: high.
**ADR-S2-02 Verification gate** — No extracted term enters calculation without quote-match/arithmetic checks **and** user confirmation. Confidence: high.
**ADR-S2-03 Model provider** — Gemini API (sponsor track, native PDF, structured output). Abstraction: single `LLMClient` interface so Claude/OpenAI could replace it. Confidence: medium (depends on credits/quotas on the day).
**ADR-S2-05 (v1.1) Independent reader and label anchors** — consistency checks can't prove correctness; a deterministic second reader and label co-location provide independent evidence for the five TILA fields. Rejected: a second LLM self-check (correlated errors). Confidence: high. (ADR-021.)
**ADR-S2-06 (v1.1) Data mode** — real documents only on paid Gemini quota; synthetic fixtures otherwise. Confidence: high. (ADR-022.)
**ADR-S2-04 Privacy posture** — text-mode first with redaction; image mode requires explicit consent. Confidence: high.

## 22. Unresolved questions

- Gemini model string and rate limits on the day (UD-01, Dev 2, before CP1).
- Billing (paid mode) vs synthetic-only demo (UD-02, team decision before CP1).
- Resolved in v1.1: page images when a text layer exists (no, in the MVP).

## 23. Source references

- Gemini document understanding ✅ https://ai.google.dev/gemini-api/docs/document-processing (2026-10-24)
- Gemini structured output ✅ https://ai.google.dev/gemini-api/docs/structured-output (2026-10-24)
- Gemini models list ◻ https://ai.google.dev/gemini-api/docs/models · pricing ◻ https://ai.google.dev/gemini-api/docs/pricing · terms ◻ https://ai.google.dev/gemini-api/terms
- PyMuPDF ◻ https://pymupdf.readthedocs.io/en/latest/
- RapidFuzz ◻ https://rapidfuzz.github.io/RapidFuzz/
- Regulation Z (TILA) interactive ◻ https://www.consumerfinance.gov/rules-policy/regulations/1026/ (§1026.18 disclosures, §1026.22 APR accuracy)
- CFPB Ask CFPB en-787 (TILA disclosure for auto loans), en-797 (GAP), en-2132 (what is negotiable), en-727 (buy rate) — project CFPB research file (2026-10-24)
- OWASP Top 10 for LLM Applications ◻ https://owasp.org/www-project-top-10-for-large-language-model-applications/
