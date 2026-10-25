"use client";

import * as React from "react";
import { Menu as MenuIcon } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Menu, MenuItem, MenuSeparator } from "@/components/system/menu";
import { DeleteDataDialog } from "@/components/delete-data";
import { AboutDialog } from "./about-dialog";

/**
 * Header actions on the blue band: "How it works" (opens About: sources, data mode, privacy, disclaimer) and a
 * menu with Start over and Delete my data (the existing confirmation, then DELETE /sessions/{id}).
 */
export function HeaderActions() {
  const { hasSession } = useApp();
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        data-how-it-works=""
        onClick={() => setAboutOpen(true)}
        className="inline-flex h-10 items-center rounded-full border border-white/60 px-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/10 sm:px-4 sm:text-[15px]"
      >
        How it works
      </button>
      <Menu
        label="Menu"
        trigger={
          <button
            type="button"
            data-more-menu=""
            aria-label="Menu"
            className="inline-flex size-10 items-center justify-center rounded-full text-white transition-colors duration-150 hover:bg-white/10 data-[state=open]:bg-white/15"
          >
            <MenuIcon aria-hidden className="size-5" />
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
        <MenuItem onSelect={() => setAboutOpen(true)}>How it works</MenuItem>
      </Menu>
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <DeleteDataDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}

/** Former name kept for imports. */
export const MoreMenu = HeaderActions;
