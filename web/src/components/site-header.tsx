"use client";

import { AppBar } from "@/components/shell/app-bar";

/** The app frame's top bar (see components/shell/app-bar.tsx). Kept under this name for existing imports. */
export function SiteHeader() {
  return <AppBar />;
}

/** Former results tabs. The app bar carries this navigation; kept so existing imports compile. */
export function ResultsTabs() {
  return null;
}
