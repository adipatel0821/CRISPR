/**
 * Display formatting and input normalisation. NO loan math lives here (or anywhere in the UI):
 * the backend sends string decimals and these helpers only format them for reading, or turn what
 * the user typed into the string decimals the API expects.
 *
 * Rule: unknown is never zero. Every formatter returns NOT_KNOWN for null/undefined/invalid input.
 * This module must stay dependency-free (it is unit-tested with `node --test`).
 */

export const NOT_KNOWN = "Not known";

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

/** True when `s` is a plain decimal string such as "375.14", "-50.00" or "60". */
export function isDecimalString(s: unknown): s is string {
  return typeof s === "string" && DECIMAL_RE.test(s);
}

/** Parse a backend decimal string to a JS number FOR DISPLAY ONLY (Intl formatting, chart position). */
export function displayNumber(s: string | number | null | undefined): number | null {
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  if (!isDecimalString(s)) return null;
  return Number(s);
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "3008.29" -> "$3,008.29"; "-50.00" -> "−$50.00" (true minus sign). */
export function formatMoney(s: string | null | undefined): string {
  const n = displayNumber(s);
  if (n === null) return NOT_KNOWN;
  const out = usd.format(Math.abs(n));
  return n < 0 ? `−${out}` : out;
}

/** Axis-tick style: "22000.00" -> "$22,000". Only for chart axes, never for figures. */
export function formatMoneyTick(n: number): string {
  return usdWhole.format(n);
}

/** Change values: "+$83.18" / "−$508.69" / "$0.00". */
export function formatSignedMoney(s: string | null | undefined): string {
  const n = displayNumber(s);
  if (n === null) return NOT_KNOWN;
  if (n === 0) return usd.format(0);
  return `${n > 0 ? "+" : "−"}${usd.format(Math.abs(n))}`;
}

/**
 * Shift the decimal point of a non-negative decimal string by `places` (positive = right).
 * Pure string manipulation: no floating point is involved.
 */
function shiftDecimal(s: string, places: number): string | null {
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [intPart, fracPart = ""] = s.split(".");
  let digits = intPart + fracPart;
  let point = intPart.length + places;
  if (point < 0) {
    digits = "0".repeat(-point) + digits;
    point = 0;
  }
  if (point > digits.length) digits = digits + "0".repeat(point - digits.length);
  let i = digits.slice(0, point).replace(/^0+(?=\d)/, "");
  if (i === "") i = "0";
  const f = digits.slice(point).replace(/0+$/, "");
  return f ? `${i}.${f}` : i;
}

/**
 * User typed a percentage ("4.75", "4.75 %", " 12 ") -> fraction string for the API ("0.0475").
 * Returns null when the text is not a non-negative decimal percentage.
 */
export function percentToFraction(input: string): string | null {
  const t = input.trim().replace(/\s*%$/, "").trim();
  if (t === "") return null;
  const normalised = t.startsWith(".") ? `0${t}` : t;
  return shiftDecimal(normalised, -2);
}

/** API fraction ("0.05796") -> percentage digits ("5.796"). */
export function fractionToPercent(fraction: string | null | undefined): string | null {
  if (typeof fraction !== "string") return null;
  return shiftDecimal(fraction, 2);
}

/** "0.05796" -> "5.796%". Keeps the precision the backend sent (no rounding). */
export function formatRate(fraction: string | null | undefined): string {
  const p = fractionToPercent(fraction);
  return p === null ? NOT_KNOWN : `${p}%`;
}

/** Ratios shown as a percent with fixed decimals, e.g. "0.0893" -> "8.93%" (display rounding only). */
export function formatRatioPercent(fraction: string | null | undefined, decimals = 1): string {
  const n = displayNumber(fraction);
  if (n === null) return NOT_KNOWN;
  return `${(n * 100).toFixed(decimals)}%`;
}

/** "0.60" -> "0.60 months"; "1" -> "1 month". */
export function formatMonths(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return NOT_KNOWN;
  const text = typeof s === "number" ? String(s) : s;
  if (!isDecimalString(text)) return NOT_KNOWN;
  return `${text} ${text === "1" ? "month" : "months"}`;
}

/**
 * What the user typed in a currency field ("$4,200", "4200.5") -> API string ("4200.00", "4200.50").
 * Returns null for anything that is not a non-negative amount with at most 2 decimals (no rounding).
 */
export function normalizeCurrencyInput(input: string): string | null {
  const t = input.trim().replace(/^\$/, "").replace(/,/g, "").trim();
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(t);
  if (!m) return null;
  const intPart = m[1].replace(/^0+(?=\d)/, "");
  const frac = (m[2] ?? "").padEnd(2, "0");
  return `${intPart}.${frac}`;
}

/** Whole numbers only ("60", " 3 ") -> "60". */
export function normalizeIntegerInput(input: string): string | null {
  const t = input.trim().replace(/,/g, "");
  if (!/^\d+$/.test(t)) return null;
  return t.replace(/^0+(?=\d)/, "");
}

/** Fact-key-ish identifiers to readable text: "income.take_home_monthly" -> "Income take home monthly". */
export function humanizeKey(key: string): string {
  const t = key.replace(/\[[^\]]*\]/g, "").replace(/[._]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** ISO timestamp -> "Oct 25, 2026, 1:30 AM UTC". */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return NOT_KNOWN;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NOT_KNOWN;
  // dateStyle/timeStyle cannot be combined with timeZoneName (RangeError), so list the fields.
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(d);
}
