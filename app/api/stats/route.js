import { NextResponse } from "next/server";
import { readMakers, readProjects } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const makers = readMakers();
  const projects = readProjects();
  return NextResponse.json({
    projectCount: projects.length,
    expertCount: makers.length,
    verifiedCount: makers.filter((m) => m.verified).length,
    teamFormedCount: projects.filter((p) => p.teamFormed).length,
  });
}
