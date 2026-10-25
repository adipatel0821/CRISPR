import * as React from "react";

/**
 * The padded body of a StageLayout workspace plus its docked action row. Pages pass
 * workspaceClassName={STAGE_PANE_WORKSPACE} to StageLayout so the pane owns the padding and a form can wrap
 * both the question and the Continue button (Enter submits natively).
 */
export const STAGE_PANE_WORKSPACE = "flex flex-col p-0 sm:p-0 lg:p-0";

export function StagePane({
  lead,
  children,
  aside,
  actions,
}: {
  /** Above the content (saved note, errors). */
  lead?: React.ReactNode;
  children: React.ReactNode;
  /** Wide screens: a picture or context column on the right. */
  aside?: React.ReactNode;
  /** Usually <ActionRow>. */
  actions?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:p-[var(--workspace-pad)]">
        {lead}
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(15rem,21rem)] xl:items-start xl:gap-16">
          <div className="min-w-0 max-w-[46rem] space-y-8">{children}</div>
          {aside}
        </div>
      </div>
      {actions}
    </>
  );
}
