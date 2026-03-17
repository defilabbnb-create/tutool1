const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const BURST_WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_BURST = 20;
const STORE_TTL_MS = 5 * WINDOW_MS;

type RequestTimestamps = {
  timestamps: number[];
  lastSeenAt: number;
};

const requestStore = new Map<string, RequestTimestamps>();

function pruneOldEntries(now: number) {
  for (const [key, value] of requestStore.entries()) {
    if (now - value.lastSeenAt > STORE_TTL_MS) {
      requestStore.delete(key);
    }
  }
}

function getRecentCount(timestamps: number[], now: number, windowMs: number) {
  return timestamps.filter((timestamp) => now - timestamp < windowMs);
}

function parseForwardedHeader(forwardedHeader: string | null) {
  if (!forwardedHeader) {
    return "";
  }

  const match = forwardedHeader.match(/for="?([^;,\s"]+)/i);
  return match?.[1]?.trim() ?? "";
}

export function getClientIdentifier(headers: Headers) {
  const candidateHeaders = [
    headers.get("x-forwarded-for"),
    headers.get("x-real-ip"),
    headers.get("x-vercel-forwarded-for"),
    headers.get("cf-connecting-ip"),
    parseForwardedHeader(headers.get("forwarded")),
  ];

  for (const candidate of candidateHeaders) {
    const firstIp = candidate?.split(",")[0]?.trim();

    if (firstIp) {
      return firstIp;
    }
  }

  const userAgent = headers.get("user-agent")?.trim();
  return userAgent ? `unknown:${userAgent}` : "unknown";
}

export function checkRateLimit(identifier: string) {
  const now = Date.now();
  pruneOldEntries(now);

  const existing = requestStore.get(identifier);
  const timestamps = existing?.timestamps ?? [];
  const recentWindowTimestamps = getRecentCount(timestamps, now, WINDOW_MS);
  const recentBurstTimestamps = getRecentCount(
    recentWindowTimestamps,
    now,
    BURST_WINDOW_MS
  );

  const burstBlocked = recentBurstTimestamps.length >= MAX_REQUESTS_PER_BURST;
  const windowBlocked = recentWindowTimestamps.length >= MAX_REQUESTS_PER_WINDOW;

  if (burstBlocked || windowBlocked) {
    const activeTimestamps = burstBlocked
      ? recentBurstTimestamps
      : recentWindowTimestamps;
    const windowMs = burstBlocked ? BURST_WINDOW_MS : WINDOW_MS;
    const oldestTimestamp = activeTimestamps[0] ?? now;
    const retryAfterMs = Math.max(windowMs - (now - oldestTimestamp), 1_000);

    requestStore.set(identifier, {
      timestamps: recentWindowTimestamps,
      lastSeenAt: now,
    });

    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  recentWindowTimestamps.push(now);
  requestStore.set(identifier, {
    timestamps: recentWindowTimestamps,
    lastSeenAt: now,
  });

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}
