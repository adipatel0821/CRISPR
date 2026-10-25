"use client";

import { Database, FlaskConical, ShieldCheck, WifiOff } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { DATA_MODE_TEXT } from "@/components/banners";
import { Disclosure } from "@/components/system";

/**
 * Data mode + privacy as ONE quiet line, with the detail behind "Learn more". Same facts as DataModeBanner
 * (GET /health), just quieter. Fixture mode and an unreachable server stay explicit.
 */
export function DataModeLine() {
  const { health, healthError, fixtures } = useApp();

  if (healthError && !fixtures) {
    return (
      <p data-banner role="status" className="flex items-start gap-2 rounded-control bg-deficit-soft px-3.5 py-2.5 text-[13px] text-deficit">
        <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="font-semibold">Can&apos;t reach the server.</strong> {healthError.recovery}
        </span>
      </p>
    );
  }

  const mode = fixtures
    ? { title: "Fixture mode", body: "This build shows bundled example data (the synthetic reference case), not a live analysis of anything you type." }
    : health
      ? (DATA_MODE_TEXT[health.data_mode] ?? DATA_MODE_TEXT.synthetic_only)
      : null;
  const Icon = fixtures ? FlaskConical : health?.data_mode === "synthetic_only" ? Database : ShieldCheck;

  return (
    <div data-banner className="text-[13px] text-ink-muted">
      <Disclosure
        summary={
          <span className="flex items-center gap-2 font-normal">
            <Icon aria-hidden className="size-4 shrink-0 text-accent" />
            <span>
              {mode ? <span className="font-medium text-ink">{mode.title}</span> : "Checking the server"}
              <span className="text-ink-subtle"> · Kept for this session only · </span>
              <span className="text-accent-strong underline-offset-4 group-hover/disclosure:underline">Learn more</span>
            </span>
          </span>
        }
      >
        <ul className="space-y-1.5 pl-6 text-[13px]">
          {mode && <li>{mode.body}</li>}
          <li>
            Your answers are kept only for this browser session. You can delete them at any time.
          </li>
          <li>Numbers you type are labelled “You told us”. Nothing you enter is described as checked by anyone else.</li>
          <li>Stress tests are illustrative scenarios, not forecasts. This is a calculation tool, not advice.</li>
        </ul>
      </Disclosure>
    </div>
  );
}
