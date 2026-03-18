import { NextRequest, NextResponse } from "next/server";
import { handleNotifyRequest } from "@/lib/notify-route-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    email?: unknown;
    source?: unknown;
  };
  const result = await handleNotifyRequest(body);

  return NextResponse.json(result.body, { status: result.status });
}
