// Unit tests for display formatting and input normalisation. Run: npm test (node --test).
// Expected values are written by hand from the contracts' running example, not produced by the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NOT_KNOWN,
  formatMoney,
  formatMonths,
  formatRate,
  formatRatioPercent,
  formatSignedMoney,
  fractionToPercent,
  normalizeCurrencyInput,
  normalizeIntegerInput,
  percentToFraction,
} from "./format.ts";

test("percentToFraction converts typed percentages by string manipulation", () => {
  assert.equal(percentToFraction("4.75"), "0.0475");
  assert.equal(percentToFraction("5.796"), "0.05796");
  assert.equal(percentToFraction("4.75 %"), "0.0475");
  assert.equal(percentToFraction(" 12 "), "0.12");
  assert.equal(percentToFraction("0"), "0");
  assert.equal(percentToFraction("0.5"), "0.005");
  assert.equal(percentToFraction(".5"), "0.005");
  assert.equal(percentToFraction("100"), "1");
  assert.equal(percentToFraction("29.99"), "0.2999");
  // values where binary floats go wrong (4.35 / 100 = 0.043499999999999997 in IEEE-754)
  assert.equal(percentToFraction("4.35"), "0.0435");
  assert.equal(percentToFraction("0.07"), "0.0007");
});

test("percentToFraction rejects non-numeric input", () => {
  assert.equal(percentToFraction(""), null);
  assert.equal(percentToFraction("abc"), null);
  assert.equal(percentToFraction("-4.75"), null);
  assert.equal(percentToFraction("4.7.5"), null);
});

test("fractionToPercent is the inverse for display", () => {
  assert.equal(fractionToPercent("0.0475"), "4.75");
  assert.equal(fractionToPercent("0.05796"), "5.796");
  assert.equal(fractionToPercent("0.12"), "12");
  assert.equal(fractionToPercent(null), null);
});

test("formatRate keeps backend precision", () => {
  assert.equal(formatRate("0.05796"), "5.796%");
  assert.equal(formatRate("0.0475"), "4.75%");
  assert.equal(formatRate(null), NOT_KNOWN);
});

test("formatMoney formats string decimals and never turns unknown into zero", () => {
  assert.equal(formatMoney("3008.29"), "$3,008.29");
  assert.equal(formatMoney("26508.29"), "$26,508.29");
  assert.equal(formatMoney("474.86"), "$474.86");
  assert.equal(formatMoney("0.00"), "$0.00");
  assert.equal(formatMoney("-50.00"), "−$50.00");
  assert.equal(formatMoney(null), NOT_KNOWN);
  assert.equal(formatMoney(undefined), NOT_KNOWN);
  assert.equal(formatMoney("n/a"), NOT_KNOWN);
});

test("formatSignedMoney shows direction explicitly", () => {
  assert.equal(formatSignedMoney("83.18"), "+$83.18");
  assert.equal(formatSignedMoney("-508.69"), "−$508.69");
  assert.equal(formatSignedMoney("0.00"), "$0.00");
  assert.equal(formatSignedMoney(null), NOT_KNOWN);
});

test("formatMonths and ratio percent", () => {
  assert.equal(formatMonths("0.60"), "0.60 months");
  assert.equal(formatMonths("2.07"), "2.07 months");
  assert.equal(formatMonths(1), "1 month");
  assert.equal(formatMonths(null), NOT_KNOWN);
  assert.equal(formatRatioPercent("0.0893", 2), "8.93%");
  assert.equal(formatRatioPercent(null), NOT_KNOWN);
});

test("normalizeCurrencyInput accepts what people type and rejects the rest", () => {
  assert.equal(normalizeCurrencyInput("$4,200"), "4200.00");
  assert.equal(normalizeCurrencyInput("4200.5"), "4200.50");
  assert.equal(normalizeCurrencyInput(" 375.14 "), "375.14");
  assert.equal(normalizeCurrencyInput("0"), "0.00");
  assert.equal(normalizeCurrencyInput("007"), "7.00");
  assert.equal(normalizeCurrencyInput("12.345"), null); // no silent rounding
  assert.equal(normalizeCurrencyInput("-5"), null);
  assert.equal(normalizeCurrencyInput(""), null);
  assert.equal(normalizeCurrencyInput("four"), null);
});

test("normalizeIntegerInput", () => {
  assert.equal(normalizeIntegerInput("60"), "60");
  assert.equal(normalizeIntegerInput(" 0 "), "0");
  assert.equal(normalizeIntegerInput("1.5"), null);
  assert.equal(normalizeIntegerInput("x"), null);
});
