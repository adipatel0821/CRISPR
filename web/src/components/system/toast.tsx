"use client";

import * as React from "react";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "done" | "problem";

interface ToastApi {
  /**
   * Show a short message such as "Saved". Replaces any toast already showing. "problem" swaps the check for an
   * alert icon and stays a little longer.
   */
  show: (message: string, tone?: ToastTone) => void;
}

const ToastCtx = React.createContext<ToastApi | null>(null);

const DURATION_MS = { done: 2400, problem: 6000 } as const;

/**
 * Hosts the app's one toast. The polite live region is always in the DOM, so screen readers announce each
 * message reliably; the visible pill fades in above the docked action on phones and at the bottom on wide
 * screens. Mounted once in the root layout.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = React.useState<{ text: string; id: number; tone: ToastTone } | null>(null);
  const counter = React.useRef(0);
  const show = React.useCallback((text: string, tone: ToastTone = "done") => {
    counter.current += 1;
    setToast({ text, id: counter.current, tone });
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), DURATION_MS[toast.tone]);
    return () => window.clearTimeout(t);
  }, [toast]);

  const api = React.useMemo(() => ({ show }), [show]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastRegion message={toast?.text ?? null} messageKey={toast?.id} tone={toast?.tone ?? "done"} />
    </ToastCtx.Provider>
  );
}

/** `const toast = useToast(); toast.show("Saved")`. Outside a provider it does nothing. */
export function useToast(): ToastApi {
  return React.useContext(ToastCtx) ?? NOOP;
}

const NOOP: ToastApi = { show: () => {} };

function ToastRegion({ message, messageKey, tone }: { message: string | null; messageKey?: number; tone: ToastTone }) {
  const Icon = tone === "problem" ? AlertCircle : Check;
  return (
    <div
      data-toast=""
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 sm:bottom-6"
    >
      {message && (
        <p
          key={messageKey}
          data-toast-tone={tone}
          className="dt-panel-in inline-flex max-w-[34rem] items-start gap-2 rounded-control bg-primary px-3.5 py-2 text-sm font-medium text-primary-ink shadow-overlay"
        >
          <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * Stand-alone toast for one message prop, when a screen wants to own the state itself.
 * `message` null hides it. Same live-region behaviour as the provider's toast.
 */
export function Toast({ message, className }: { message: string | null; className?: string }) {
  return (
    <div data-toast="" role="status" aria-live="polite" aria-atomic="true" className={cn("min-h-0", className)}>
      {message && (
        <p className="dt-panel-in inline-flex items-center gap-2 rounded-control bg-primary px-3.5 py-2 text-sm font-medium text-primary-ink">
          <Check aria-hidden className="size-4" />
          {message}
        </p>
      )}
    </div>
  );
}
