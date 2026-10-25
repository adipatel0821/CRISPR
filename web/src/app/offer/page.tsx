"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { AnalysisReadiness, LoanOffer } from "@/lib/contracts";
import { useApp, useMounted } from "@/lib/app-context";
import { DataModeBanner } from "@/components/banners";
import { DocumentFlow } from "@/components/document-flow";
import { OfferForm } from "@/components/offer-form";
import { OfferSummary } from "@/components/offer-summary";
import { ReadinessPanel } from "@/components/readiness-panel";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";

export default function OfferPage() {
  const router = useRouter();
  const mounted = useMounted();
  const { hasSession, setReport } = useApp();
  const [tab, setTab] = React.useState("manual");
  const [offer, setOffer] = React.useState<LoanOffer | null>(null);
  const [readiness, setReadiness] = React.useState<AnalysisReadiness[] | null>(null);
  const [loadError, setLoadError] = React.useState<ApiError | null>(null);
  const [runError, setRunError] = React.useState<ApiError | null>(null);
  const [running, setRunning] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!hasSession) return;
    let cancelled = false;
    Promise.all([api.getSession(), api.readiness()])
      .then(([s, r]) => {
        if (cancelled) return;
        const existing = s.offers[s.offers.length - 1] ?? null;
        setOffer((o) => o ?? existing);
        setReadiness(r);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof ApiError ? e : new ApiError("INTERNAL", String(e), 0));
      });
    return () => {
      cancelled = true;
    };
  }, [hasSession, reloadKey]);

  function saved(o: LoanOffer) {
    setOffer(o);
    setEditing(false);
    setRunError(null);
    setReloadKey((k) => k + 1);
  }

  async function run() {
    if (!offer) return;
    setRunning(true);
    setRunError(null);
    try {
      const report = await api.runAnalysis({ offer_id: offer.offer_id });
      setReport(report);
      router.push("/dashboard");
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError("INTERNAL", String(e), 0);
      setRunError(err);
      const d = err.details as { readiness?: AnalysisReadiness[] } | null;
      if (d && Array.isArray(d.readiness)) setReadiness(d.readiness);
      setRunning(false);
    }
  }

  if (!mounted) return <PageSkeleton label="Loading the offer step" />;
  if (!hasSession) {
    return (
      <EmptyState title="Start a session first" action={{ href: "/", label: "Go to the start" }}>
        Your loan offer is stored in a session together with your answers.
      </EmptyState>
    );
  }

  const showForm = !offer || editing;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Loan offer</h1>
        <p className="text-sm text-ink-muted">Type the terms from the contract, or upload a sample contract and check what we read.</p>
      </div>

      {loadError && <ErrorState error={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          {offer && !editing && (
            <>
              <OfferSummary offer={offer} />
              <Card>
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div>
                    <p className="font-semibold text-ink">Ready when you are</p>
                    <p className="text-sm text-ink-muted">
                      We&apos;ll calculate the loan&apos;s cost, your month and savings, stress tests and alternatives.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="secondary" onClick={() => setEditing(true)}>
                      Change the offer
                    </Button>
                    <Button disabled={running || !offer.ready_for_calculation || offer.unsupported_features.length > 0} onClick={run}>
                      <BarChart3 aria-hidden /> {running ? "Calculating…" : "See my results"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              {runError && (
                <div className="space-y-2">
                  <ErrorState error={runError} title="We couldn't run the analysis" onRetry={run} />
                  {runError.code === "INSUFFICIENT_INFORMATION" && (
                    <Button asChild variant="link">
                      <Link href="/intake">
                        Go back to your finances <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {showForm && (
            <Tabs value={tab} onValueChange={setTab} className="space-y-6">
              <TabsList aria-label="How to add the offer">
                <TabsTrigger value="manual">Type the terms</TabsTrigger>
                <TabsTrigger value="upload">Upload a document</TabsTrigger>
              </TabsList>
              <TabsContent value="manual">
                <Card>
                  <CardContent className="p-5 sm:p-6">
                    <OfferForm onSaved={saved} />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="upload" className="space-y-4">
                <DataModeBanner />
                <DocumentFlow onSaved={saved} onUseManual={() => setTab("manual")} />
              </TabsContent>
              {editing && (
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Keep the current offer
                </Button>
              )}
            </Tabs>
          )}
        </div>
        {readiness ? <ReadinessPanel readiness={readiness} /> : <div />}
      </div>
    </div>
  );
}
