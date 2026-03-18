import { NextRequest, NextResponse } from "next/server";
import { handleNotifyRequest } from "@/lib/notify-route-utils";
import { getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: {
    email?: unknown;
    source?: unknown;
  } = {};

  try {
    body = (await request.json()) as {
      email?: unknown;
      source?: unknown;
    };
  } catch {
    return NextResponse.json(
      {
        error: "Please enter a valid email address.",
      },
      { status: 400 }
    );
  }

  const result = await handleNotifyRequest(body, undefined, {
    clientIdentifier: getClientIdentifier(request.headers),
  });

  return NextResponse.json(result.body, { status: result.status });
}
