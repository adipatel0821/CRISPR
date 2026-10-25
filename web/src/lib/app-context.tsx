"use client";

import * as React from "react";
import { api, ApiError, USE_FIXTURES } from "./api";
import type { DecisionReport, HealthResponse } from "./contracts";
import { store } from "./session-store";

/* ---- tiny external store so "is there a session?" is hydration-safe ---- */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notifySession() {
  listeners.forEach((l) => l());
}
const noopSubscribe = () => () => {};

/** false during server render / hydration, true after mount. */
export function useMounted(): boolean {
  return React.useSyncExternalStore(noopSubscribe, () => true, () => false);
}

interface AppState {
  health: HealthResponse | null;
  healthError: ApiError | null;
  fixtures: boolean;
  hasSession: boolean;
  refreshSession: () => void;
  /** Report cache shared by the results pages (one snapshot for every section). */
  report: DecisionReport | null;
  setReport: (r: DecisionReport | null) => void;
}

const Ctx = React.createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = React.useState<ApiError | null>(null);
  const [report, setReport] = React.useState<DecisionReport | null>(null);
  const hasSession = React.useSyncExternalStore(
    subscribe,
    () => store.credentials() !== null,
    () => false,
  );

  React.useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch((e: unknown) => {
        if (!cancelled) setHealthError(e instanceof ApiError ? e : new ApiError("NETWORK", "Server unreachable.", 0));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = React.useMemo(
    () => ({
      health,
      healthError,
      fixtures: USE_FIXTURES,
      hasSession,
      refreshSession: notifySession,
      report,
      setReport,
    }),
    [health, healthError, hasSession, report],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}

export type ReportState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; error: ApiError }
  | { status: "ready"; report: DecisionReport };

/** Load the latest report for this session (cached across the results pages). */
export function useReport(): ReportState & { retry: () => void } {
  const { report, setReport } = useApp();
  const mounted = useMounted();
  const [attempt, setAttempt] = React.useState(0);
  const [failure, setFailure] = React.useState<{ attempt: number; error: ApiError } | null>(null);

  const id = mounted ? store.reportId() : null;
  const shouldFetch = mounted && !report && (id !== null || USE_FIXTURES);

  React.useEffect(() => {
    if (!shouldFetch) return;
    let cancelled = false;
    api
      .getReport(id ?? "r_fixture_demo")
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setFailure({ attempt, error: e instanceof ApiError ? e : new ApiError("INTERNAL", String(e), 0) });
      });
    return () => {
      cancelled = true;
    };
  }, [shouldFetch, id, attempt, setReport]);

  const retry = () => setAttempt((a) => a + 1);
  if (report) return { status: "ready", report, retry };
  if (!mounted) return { status: "loading", retry };
  if (!shouldFetch) return { status: "empty", retry };
  if (failure && failure.attempt === attempt) return { status: "error", error: failure.error, retry };
  return { status: "loading", retry };
}
