import * as React from "react";
import Link from "next/link";
import { AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoteTone = "neutral" | "attention" | "gap";

export interface NoteProps {
  /** One short line: a limitation or a warning. */
  children: React.ReactNode;
  /**
   * neutral (default): quiet gray line with an info icon.
   * attention: amber icon and ink text, for limitations that change the meaning (e.g. running costs not included).
   * gap: rose icon, for a deficit or savings running out.
   */
  tone?: NoteTone;
  /** Optional action: a link ({ href, label }) or a button ({ onClick, label }). */
  action?: { href: string; label: string } | { onClick: () => void; label: string };
  /** ARIA role (default "note"; "status" for live updates, "alert" for errors). */
  role?: "note" | "status" | "alert";
  id?: string;
  className?: string;
}

const TONE: Record<NoteTone, { text: string; icon: string; Icon: typeof Info }> = {
  neutral: { text: "text-ink-muted", icon: "text-ink-subtle", Icon: Info },
  attention: { text: "text-ink", icon: "text-info", Icon: Info },
  gap: { text: "text-ink", icon: "text-deficit", Icon: AlertCircle },
};

/**
 * A one-line limitation or warning. No card: an icon (shape differs by tone, so colour is not the only
 * signal) and a sentence, with an optional quiet action.
 */
export function Note({ children, tone = "neutral", action, role = "note", id, className }: NoteProps) {
  const t = TONE[tone];
  return (
    <div id={id} role={role} data-note={tone} className={cn("flex items-start gap-2.5 text-[15px] leading-relaxed", t.text, className)}>
      <t.Icon aria-hidden className={cn("mt-[0.2em] size-4 shrink-0", t.icon)} />
      <div className="min-w-0">
        {children}
        {action && (
          <>
            {" "}
            {"href" in action ? (
              <Link href={action.href} className="dt-link whitespace-nowrap font-medium">
                {action.label}
              </Link>
            ) : (
              <button type="button" onClick={action.onClick} className="dt-link whitespace-nowrap font-medium">
                {action.label}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
