/**
 * Per-tab session credentials and ids in sessionStorage. Every access is wrapped in try/catch:
 * storage can be unavailable (private mode, blocked site data, server render) and the app must
 * still work, falling back to in-memory values for the life of the page.
 */
const KEYS = {
  sessionId: "dt.session_id",
  token: "dt.token",
  dataMode: "dt.data_mode",
  reportId: "dt.report_id",
  offerId: "dt.offer_id",
  docId: "dt.doc_id",
  consent: "dt.consent",
} as const;

type Key = keyof typeof KEYS;
const memory = new Map<string, string>();

function read(key: Key): string | null {
  const k = KEYS[key];
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      const v = window.sessionStorage.getItem(k);
      if (v !== null) return v;
    }
  } catch {
    /* storage unavailable */
  }
  return memory.get(k) ?? null;
}

function write(key: Key, value: string | null): void {
  const k = KEYS[key];
  if (value === null) memory.delete(k);
  else memory.set(k, value);
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      if (value === null) window.sessionStorage.removeItem(k);
      else window.sessionStorage.setItem(k, value);
    }
  } catch {
    /* storage unavailable: memory copy still works for this page */
  }
}

export interface Credentials {
  sessionId: string;
  token: string;
}

export const store = {
  credentials(): Credentials | null {
    const sessionId = read("sessionId");
    const token = read("token");
    return sessionId && token ? { sessionId, token } : null;
  },
  setCredentials(c: Credentials, dataMode: string) {
    write("sessionId", c.sessionId);
    write("token", c.token);
    write("dataMode", dataMode);
  },
  dataMode: () => read("dataMode"),
  reportId: () => read("reportId"),
  setReportId: (v: string | null) => write("reportId", v),
  offerId: () => read("offerId"),
  setOfferId: (v: string | null) => write("offerId", v),
  docId: () => read("docId"),
  setDocId: (v: string | null) => write("docId", v),
  consent: () => read("consent") === "1",
  setConsent: (v: boolean) => write("consent", v ? "1" : null),
  clear() {
    (Object.keys(KEYS) as Key[]).forEach((k) => write(k, null));
  },
};
