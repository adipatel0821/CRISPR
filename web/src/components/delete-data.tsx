"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertDialog as AD } from "radix-ui";
import { Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/misc";

const TITLE = "Delete everything from this session?";
const DESCRIPTION =
  "This removes your answers, loan offer, uploaded document and results from the server. It can't be undone.";

/** Shared delete action: DELETE /sessions/{id}, clear the report, refresh the session, go home. */
function useDeleteSession() {
  const router = useRouter();
  const { refreshSession, setReport } = useApp();
  const [status, setStatus] = React.useState<string>("");
  const run = React.useCallback(async () => {
    setStatus("Deleting your data.");
    try {
      await api.deleteSession();
      setReport(null);
      refreshSession();
      setStatus("Your session data was deleted.");
      router.push("/");
    } catch (e) {
      setStatus(e instanceof ApiError ? `${e.message} ${e.recovery}` : "Couldn't delete. Try again.");
    }
  }, [refreshSession, router, setReport]);
  return { status, run };
}

/** "Delete my data" button with its confirmation (used on the report and anywhere a visible button fits). */
export function DeleteDataButton({ size = "sm" }: { size?: "sm" | "md" }) {
  const { hasSession } = useApp();
  const { status, run } = useDeleteSession();
  if (!hasSession) return null;
  return (
    <span className="no-print inline-flex items-center gap-2">
      <ConfirmDialog
        danger
        trigger={
          <Button variant="danger" size={size}>
            <Trash2 aria-hidden /> Delete my data
          </Button>
        }
        title={TITLE}
        description={DESCRIPTION}
        confirmLabel="Delete my data"
        onConfirm={run}
      />
      <span role="status" aria-live="polite" className="text-xs text-ink-muted">
        {status}
      </span>
    </span>
  );
}

/** Controlled confirmation for menus ("Delete my data" in the header menu). Same request and outcome. */
export function DeleteDataDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { status, run } = useDeleteSession();
  return (
    <>
      <AD.Root open={open} onOpenChange={onOpenChange}>
        <AD.Portal>
          <AD.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]" />
          <AD.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-card bg-surface p-6 shadow-surface data-[state=open]:animate-fade-in">
            <AD.Title className="text-lg font-bold text-ink">{TITLE}</AD.Title>
            <AD.Description className="mt-2 text-[15px] text-ink-2">{DESCRIPTION}</AD.Description>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AD.Cancel className={buttonVariants({ variant: "secondary" })}>Cancel</AD.Cancel>
              <AD.Action className={buttonVariants({ variant: "danger" })} onClick={() => void run()}>
                Delete my data
              </AD.Action>
            </div>
          </AD.Content>
        </AD.Portal>
      </AD.Root>
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
    </>
  );
}
