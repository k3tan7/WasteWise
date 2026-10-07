import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { buildMonthlyReport, reportToCsvRows } from "@/lib/services/report";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month") ?? "";
  const [y, m] = month.split("-").map(Number);
  const date = y && m && m >= 1 && m <= 12 ? new Date(y, m - 1, 1) : new Date();

  const report = await buildMonthlyReport(date);
  const csv = toCsv(reportToCsvRows(report));

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wastewise-report-${report.month}.csv"`,
    },
  });
}
