"use client";

import { ReportGate } from "@/components/report-gate";
import { ReportScreen } from "@/components/report/report-screen";

export default function ReportPage() {
  return <ReportGate>{(report) => <ReportScreen report={report} />}</ReportGate>;
}
