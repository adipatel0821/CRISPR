"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/misc";

/** "Delete my data" — DELETE /sessions/{id}, with confirmation. */
export function DeleteDataButton({ size = "sm" }: { size?: "sm" | "md" }) {
  const router = useRouter();
  const { hasSession, refreshSession, setReport } = useApp();
  const [status, setStatus] = React.useState<string>("");

  if (!hasSession) return null;

  async function onConfirm() {
    setStatus("Deleting…");
    try {
      await api.deleteSession();
      setReport(null);
      refreshSession();
      setStatus("Your session data was deleted.");
      router.push("/");
    } catch (e) {
      setStatus(e instanceof ApiError ? `${e.message} ${e.recovery}` : "Couldn't delete. Try again.");
    }
  }

  return (
    <span className="no-print inline-flex items-center gap-2">
      <ConfirmDialog
        danger
        trigger={
          <Button variant="danger" size={size}>
            <Trash2 aria-hidden /> Delete my data
          </Button>
        }
        title="Delete everything from this session?"
        description="This removes your answers, loan offer, uploaded document and results from the server. It can't be undone."
        confirmLabel="Delete my data"
        onConfirm={onConfirm}
      />
      <span role="status" aria-live="polite" className="text-xs text-ink-muted">
        {status}
      </span>
    </span>
  );
}
