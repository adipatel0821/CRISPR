"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/misc";
import { useToast } from "@/components/system/toast";
import { publishOffer } from "@/components/shell/loan-store";

const TITLE = "Delete your data?";
const DESCRIPTION =
  "This removes your answers, your loan offer, any document you uploaded and your results from the server. You can't undo this.";
const CONFIRM = "Delete my data";

/**
 * The delete flow shared by the app bar's More menu and the report page: DELETE /sessions/{id}, then back to
 * the start with a short confirmation. Errors stay on screen in a polite status line.
 */
export function useDeleteData() {
  const router = useRouter();
  const toast = useToast();
  const { refreshSession, setReport } = useApp();
  const [status, setStatus] = React.useState("");

  const run = React.useCallback(async () => {
    setStatus("Deleting your data");
    try {
      await api.deleteSession();
      setReport(null);
      publishOffer(null);
      refreshSession();
      setStatus("Your data was deleted.");
      toast.show("Your data was deleted");
      router.push("/");
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.message} ${e.recovery}` : "We couldn't delete your data. Try again.";
      setStatus(msg);
      toast.show(msg, "problem");
    }
  }, [refreshSession, router, setReport, toast]);

  return { run, status };
}

/** Controlled confirmation dialog for "Delete my data" (opened from a menu item). */
export function DeleteDataDialog({
  open,
  onOpenChange,
  onStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the status line (deleting, done, or the error) so the caller can show it. */
  onStatus?: (status: string) => void;
}) {
  const { run, status } = useDeleteData();
  React.useEffect(() => {
    onStatus?.(status);
  }, [status, onStatus]);
  return (
    <ConfirmDialog
      danger
      open={open}
      onOpenChange={onOpenChange}
      title={TITLE}
      description={DESCRIPTION}
      confirmLabel={CONFIRM}
      onConfirm={run}
    />
  );
}

/** "Delete my data" as a button with its own confirmation (used on the report page). */
export function DeleteDataButton({ size = "sm" }: { size?: "sm" | "md" }) {
  const { hasSession } = useApp();
  const { run, status } = useDeleteData();
  if (!hasSession) return null;
  return (
    <span className="no-print inline-flex flex-wrap items-center gap-2">
      <ConfirmDialog
        danger
        trigger={
          <Button variant="danger" size={size}>
            Delete my data
          </Button>
        }
        title={TITLE}
        description={DESCRIPTION}
        confirmLabel={CONFIRM}
        onConfirm={run}
      />
      <span role="status" aria-live="polite" className="text-sm text-ink-muted">
        {status}
      </span>
    </span>
  );
}
