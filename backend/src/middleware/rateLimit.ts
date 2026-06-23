import { Context, Next } from 'hono';
import { AppType } from '../types';

export async function rateLimitMiddleware(c: Context<AppType>, next: Next) {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401);
  }

  const key = `submit:${user.userId}`;
  const windowMs = 60_000;
  const maxRequests = 10;

  try {
    // Use D1 for rate limiting (works across Workers instances)
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries and count recent submissions
    await c.env.DB.prepare(
      "DELETE FROM rate_limits WHERE created_at < ?"
    ).bind(windowStart).run();

    const result = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM rate_limits WHERE key = ? AND created_at >= ?"
    ).bind(key, windowStart).first();

    const count = (result as any)?.count || 0;

    if (count >= maxRequests) {
      return c.json({
        success: false,
        error: {
          message: 'Rate limit exceeded: max 10 submissions per minute',
          code: 'RATE_LIMITED'
        }
      }, 429);
    }

    // Record this request
    await c.env.DB.prepare(
      "INSERT INTO rate_limits (key, created_at) VALUES (?, ?)"
    ).bind(key, now).run();

    await next();
  } catch (e) {
    // If rate limiting fails (e.g., table doesn't exist), fail open
    console.error('Rate limit error:', e);
    await next();
  }
}

export function createRateLimiter(prefix: string, maxRequests: number, windowMs: number) {
  return async (c: Context<AppType>, next: Next) => {
    const user = c.get('user');
    // For unauthenticated routes (login/register), use IP as key
    const key = user ? `${prefix}:${user.userId}` : `${prefix}:ip:${c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    try {
      await c.env.DB.prepare("DELETE FROM rate_limits WHERE created_at < ?").bind(windowStart).run();
      const result = await c.env.DB.prepare("SELECT COUNT(*) as count FROM rate_limits WHERE key = ? AND created_at >= ?").bind(key, windowStart).first();
      const count = (result as any)?.count || 0;
      if (count >= maxRequests) {
        return c.json({ success: false, error: { message: `Rate limit exceeded`, code: 'RATE_LIMITED' } }, 429);
      }
      await c.env.DB.prepare("INSERT INTO rate_limits (key, created_at) VALUES (?, ?)").bind(key, now).run();
      await next();
    } catch (e) {
      console.error('Rate limit error:', e);
      await next();
    }
  };
}
