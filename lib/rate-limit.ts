const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS_PER_WINDOW = 30;
const DEFAULT_BURST_WINDOW_MS = 10_000;
const DEFAULT_MAX_REQUESTS_PER_BURST = 20;
const STORE_TTL_MS = 5 * DEFAULT_WINDOW_MS;

type RequestTimestamps = {
  timestamps: number[];
  lastSeenAt: number;
};

const requestStore = new Map<string, RequestTimestamps>();

type RateLimitOptions = {
  bucket?: string;
  windowMs?: number;
  maxRequestsPerWindow?: number;
  burstWindowMs?: number;
  maxRequestsPerBurst?: number;
};

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

export function checkRateLimit(identifier: string, options: RateLimitOptions = {}) {
  const now = Date.now();
  pruneOldEntries(now);

  const bucket = options.bucket ?? "default";
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequestsPerWindow =
    options.maxRequestsPerWindow ?? DEFAULT_MAX_REQUESTS_PER_WINDOW;
  const burstWindowMs = options.burstWindowMs ?? DEFAULT_BURST_WINDOW_MS;
  const maxRequestsPerBurst =
    options.maxRequestsPerBurst ?? DEFAULT_MAX_REQUESTS_PER_BURST;
  const scopedIdentifier = `${bucket}:${identifier}`;

  const existing = requestStore.get(scopedIdentifier);
  const timestamps = existing?.timestamps ?? [];
  const recentWindowTimestamps = getRecentCount(timestamps, now, windowMs);
  const recentBurstTimestamps = getRecentCount(
    recentWindowTimestamps,
    now,
    burstWindowMs
  );

  const burstBlocked = recentBurstTimestamps.length >= maxRequestsPerBurst;
  const windowBlocked = recentWindowTimestamps.length >= maxRequestsPerWindow;

  if (burstBlocked || windowBlocked) {
    const activeTimestamps = burstBlocked
      ? recentBurstTimestamps
      : recentWindowTimestamps;
    const activeWindowMs = burstBlocked ? burstWindowMs : windowMs;
    const oldestTimestamp = activeTimestamps[0] ?? now;
    const retryAfterMs = Math.max(activeWindowMs - (now - oldestTimestamp), 1_000);

    requestStore.set(scopedIdentifier, {
      timestamps: recentWindowTimestamps,
      lastSeenAt: now,
    });

    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  recentWindowTimestamps.push(now);
  requestStore.set(scopedIdentifier, {
    timestamps: recentWindowTimestamps,
    lastSeenAt: now,
  });

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export function resetRateLimitStore() {
  requestStore.clear();
}
