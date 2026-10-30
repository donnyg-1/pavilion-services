import { NextResponse } from "next/server";
import { runDailyJobs } from "@/lib/services/admin";

// Vercel Cron calls this once a day with `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runDailyJobs());
}
