"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Menu, MenuItem, MenuSeparator } from "@/components/system/menu";
import { DeleteDataDialog } from "@/components/delete-data";
import { AboutDialog } from "./about-dialog";

/**
 * The app bar's overflow menu, a button named "More": Start over (back to the start, where Start begins a new
 * session), Delete my data (the existing confirmation, then DELETE /sessions/{id}) and About this analysis.
 */
export function MoreMenu() {
  const { hasSession } = useApp();
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <Menu
        label="More"
        trigger={
          <button
            type="button"
            data-more-menu=""
            className="inline-flex h-9 items-center gap-1.5 rounded-control px-2 text-sm text-ink-muted transition-colors duration-150 hover:bg-canvas hover:text-ink data-[state=open]:bg-canvas data-[state=open]:text-ink"
          >
            <MoreHorizontal aria-hidden className="size-5" />
            <span className="sr-only sm:not-sr-only">More</span>
          </button>
        }
      >
        <MenuItem href="/">Start over</MenuItem>
        {hasSession && (
          <MenuItem tone="danger" onSelect={() => setDeleteOpen(true)}>
            Delete my data
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem onSelect={() => setAboutOpen(true)}>About this analysis</MenuItem>
      </Menu>
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      {/* progress and errors are announced by the app's toast */}
      <DeleteDataDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
