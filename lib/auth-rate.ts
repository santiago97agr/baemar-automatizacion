const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_ATTEMPTS = 5;

interface RateBucket {
  attempts: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateBucket>();

export function isLoginBlocked(ip: string): boolean {
  const now = Date.now();
  const bucket = rateLimitMap.get(ip);
  if (!bucket) return false;
  if (now - bucket.windowStart > LOGIN_WINDOW_MS) {
    rateLimitMap.delete(ip);
    return false;
  }
  return bucket.attempts >= LOGIN_MAX_ATTEMPTS;
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const bucket = rateLimitMap.get(ip);
  if (!bucket || now - bucket.windowStart > LOGIN_WINDOW_MS) {
    rateLimitMap.set(ip, { attempts: 1, windowStart: now });
  } else {
    bucket.attempts += 1;
  }
}

export function clearLoginAttempts(ip: string): void {
  rateLimitMap.delete(ip);
}

export function getRemainingBlockSeconds(ip: string): number {
  const now = Date.now();
  const bucket = rateLimitMap.get(ip);
  if (!bucket) return 0;
  if (now - bucket.windowStart > LOGIN_WINDOW_MS) return 0;
  if (bucket.attempts < LOGIN_MAX_ATTEMPTS) return 0;
  return Math.ceil((bucket.windowStart + LOGIN_WINDOW_MS - now) / 1000);
}

// Utilidad para tests.
export function __resetRateLimitForTests(): void {
  rateLimitMap.clear();
}
