import { NextResponse } from "next/server";
import { readProjects } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const projects = readProjects();
  return NextResponse.json([...projects].reverse().slice(0, 12));
}
