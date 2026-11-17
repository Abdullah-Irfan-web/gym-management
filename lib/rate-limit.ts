import { HttpError } from "@/utils/misc";
// Per-instance sliding window. On serverless this is best-effort; swap for Upstash Redis for strict global limits.
const hits = new Map<string, number[]>();
export function rateLimit(req: Request, bucket: string, limit: number, windowMs = 60_000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const k = `${bucket}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(k) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) throw new HttpError(429, "Too many requests. Please wait a minute and try again.");
  arr.push(now); hits.set(k, arr);
  if (hits.size > 5000) for (const [key, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(key);
}
