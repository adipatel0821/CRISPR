// A-42 label honesty: no chip says "verified"; user-confirmed values say "You confirmed"; source and
// checking are separate (the label names the source, verificationText says how far it was checked).
import { test } from "node:test";
import assert from "node:assert/strict";
import { factStatusChip, honestLabel, sourceChip, verificationText } from "./provenance.ts";

const KINDS = ["user_input", "document", "calculation", "assumption", "ai_interpretation", "external_source"];
const VERIFICATIONS = ["none", "user_confirmed", "evidence_matched", "evidence_matched_user_confirmed"];
const STATUSES = ["provided", "estimated", "assumed", "missing", "declined", "conflicting", "superseded", "calculated"];

test("no source/verification combination produces the word 'verified', a dash or an exclamation mark", () => {
  for (const k of KINDS) {
    for (const v of VERIFICATIONS) {
      for (const s of [null, ...STATUSES]) {
        const chip = sourceChip(k, v, { page: 1, status: s });
        assert.doesNotMatch(chip.label, /verified|[–—!]/i, `${k}/${v}/${s} -> ${chip.label}`);
      }
      assert.doesNotMatch(verificationText(v) ?? "", /verified|[–—!]/i);
    }
  }
  for (const s of STATUSES) assert.doesNotMatch(factStatusChip(s).label, /verified|[–—]/i);
});

test("user confirmation is labelled as such, never as independent evidence", () => {
  assert.equal(sourceChip("user_input", "user_confirmed").label, "You confirmed");
  assert.equal(sourceChip("user_input", "none").label, "You told us");
  assert.equal(sourceChip("document", "evidence_matched_user_confirmed", { page: 1 }).label, "From your contract, page 1");
  assert.equal(sourceChip("document", "user_confirmed", { page: 2 }).label, "From your contract, page 2");
  assert.equal(sourceChip("document", "none").label, "From your contract");
  assert.equal(sourceChip("calculation", "none").label, "Calculated");
  assert.equal(sourceChip("assumption", "none").label, "Assumption");
  assert.equal(sourceChip("user_input", "none", { status: "estimated" }).label, "Estimate");
  // how far it was checked is a separate sentence
  assert.equal(verificationText("evidence_matched_user_confirmed"), "It matches the text in your contract, and you confirmed it.");
  assert.equal(verificationText("evidence_matched"), "It matches the text in your contract.");
  assert.equal(verificationText("user_confirmed"), "You confirmed it.");
  assert.equal(verificationText("none"), null);
});

test("fact status chips", () => {
  assert.equal(factStatusChip("provided").label, "You told us");
  assert.equal(factStatusChip("estimated").label, "Estimate");
  assert.equal(factStatusChip("declined").label, "Not shared");
  assert.equal(factStatusChip("conflicting").label, "Answers disagree");
});

test("honestLabel scrubs upstream 'verified' wording", () => {
  assert.equal(honestLabel("Verified by lender"), "checked by lender");
  assert.doesNotMatch(honestLabel("unverified value"), /verified/i);
});
