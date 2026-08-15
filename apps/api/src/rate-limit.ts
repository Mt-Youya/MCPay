export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number }
export type TaskRateLimiter = (clientIp: string) => RateLimitResult | Promise<RateLimitResult>

export const createFixedWindowRateLimiter = (
  limit: number,
  periodMs: number,
  now: () => number = Date.now
): TaskRateLimiter => {
  const buckets = new Map<string, { window: number; count: number }>()

  return (clientIp) => {
    const currentTime = now()
    const window = Math.floor(currentTime / periodMs)
    const bucket = buckets.get(clientIp)
    const retryAfterSeconds = Math.max(1, Math.ceil(((window + 1) * periodMs - currentTime) / 1000))

    if (!bucket || bucket.window !== window) {
      buckets.set(clientIp, { window, count: 1 })
      return { allowed: true, retryAfterSeconds }
    }

    bucket.count += 1
    return { allowed: bucket.count <= limit, retryAfterSeconds }
  }
}

export const requestClientIp = (request: Request) => {
  const cloudflareIp = request.headers.get("cf-connecting-ip")
  if (cloudflareIp) return cloudflareIp

  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}
