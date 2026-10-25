"use client";

import * as React from "react";
import type { LoanOffer } from "@/lib/contracts";
import { useApp } from "@/lib/app-context";
import { store } from "@/lib/session-store";

/*
 * The offer the app bar's loan chip describes. Results pages already hold it (report.offer in app state);
 * setup screens can publish the offer they just saved with publishOffer(offer) so the chip appears before any
 * analysis exists. Memory only (never written to storage) and tied to the session that saved it, so a new
 * session or "Delete my data" never shows an old loan.
 */
let published: { sessionId: string | null; offer: LoanOffer } | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Make `offer` the loan shown in the app bar (null clears it). Call after a manual or document offer is saved. */
export function publishOffer(offer: LoanOffer | null): void {
  published = offer ? { sessionId: store.credentials()?.sessionId ?? null, offer } : null;
  listeners.forEach((l) => l());
}

const getPublished = () => published;
const getServer = () => null;

/**
 * The current session's offer: report.offer when a report is loaded, otherwise the published one.
 * Null when there is no session or no offer yet.
 */
export function useCurrentOffer(): LoanOffer | null {
  const { report, hasSession } = useApp();
  const p = React.useSyncExternalStore(subscribe, getPublished, getServer);
  if (!hasSession) return null;
  // The cached report always belongs to this session: it is cleared when a session starts or is deleted.
  if (report?.offer) return report.offer;
  if (p && p.sessionId === (store.credentials()?.sessionId ?? null)) return p.offer;
  return null;
}
