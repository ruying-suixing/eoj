import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppType } from './types';
import auth from './routes/auth';
import problems from './routes/problems';
import submissions from './routes/submissions';
import rankings from './routes/rankings';
import users from './routes/users';
import internal from './routes/internal';
import admin from './routes/admin';
import contests from './routes/contests';
import tickets from './routes/tickets';
import problemLists from './routes/problemLists';
import solutions from './routes/solutions';
import discussions from './routes/discussions';
import settings from './routes/settings';
import uploads from './routes/uploads';
import { seedDatabase } from './seed';

const app = new Hono<AppType>();

app.use('/api/*', async (c, next) => {
  const corsMiddleware = cors({
    origin: [c.env.FRONTEND_URL || 'http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

app.onError((err, c) => {
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return c.json({
      success: false,
      error: {
        message: 'Invalid JSON',
        code: 'BAD_REQUEST'
      }
    }, 400);
  }
  console.error('Server error:', err);
  return c.json({
    success: false,
    error: {
      message: err.message || 'An internal server error occurred',
      code: 'INTERNAL_ERROR'
    }
  }, 500);
});

app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      message: 'Resource not found',
      code: 'NOT_FOUND'
    }
  }, 404);
});

const api = new Hono<AppType>();

api.get('/health', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1').first();
    return c.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  } catch (e) {
    return c.json({ success: false, error: { message: 'Database unavailable' } }, 503);
  }
});

api.route('/auth', auth);
api.route('/problems', problems);
api.route('/submissions', submissions);
api.route('/rankings', rankings);
api.route('/users', users);
api.route('/admin', admin);
api.route('/internal', internal);
api.route('/contests', contests);
api.route('/tickets', tickets);
api.route('/lists', problemLists);
api.route('/solutions', solutions);
api.route('/discussions', discussions);
api.route('/uploads', uploads);
api.route('/settings', settings);

app.route('/api/v1', api);

app.get('/__dev_info', async (c) => {
  const info: any = { hasProcess: typeof process !== 'undefined' };
  if (typeof process !== 'undefined') {
    try {
      const fsMod = await import('fs');
      const pathMod = await import('path');
      const cwd = process.cwd();
      const bases = [
        pathMod.join(cwd, 'public'),
        pathMod.join(cwd, 'backend', 'public'),
        pathMod.join(cwd, '..', 'backend', 'public'),
        pathMod.join(cwd, '..', 'public'),
        pathMod.join(cwd, 'dist'),
      ];
      info.cwd = cwd;
      info.bases = [];
      for (const b of bases) {
        const exists = await fsMod.promises.stat(b).then(s => (s.isDirectory()||s.isFile())?true:false).catch(() => false);
        info.bases.push({ path: b, exists });
      }
    } catch (e) {
      info.error = String(e);
    }
  }
  return c.json({ success: true, data: info });
});

// Dev-only: seed database with sample problems (can only run once)
app.get('/__seed', async (c) => {
  try {
    await seedDatabase(c.env.DB as any, c.env);
    return c.json({ success: true, data: { message: 'Seeded database' } });
  } catch (e: any) {
    if (e.message?.includes('already been executed')) {
      return c.json({ success: false, error: { message: 'Seed has already been executed', code: 'CONFLICT' } }, 409);
    }
    console.error('Seed error:', e);
    return c.json({ success: false, error: { message: 'Seed failed', detail: String(e) } }, 500);
  }
});

app.all('*', async (c) => {
  const request = c.req.raw;
  const assets = (c.env as any).ASSETS;

  if (assets && typeof assets.fetch === 'function') {
    const assetResponse = await assets.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    const indexResponse = await assets.fetch(
      new Request(new URL('/index.html', request.url).toString(), request)
    );
    if (indexResponse.status !== 404) {
      return indexResponse;
    }
  }

  // Fallback for local development: serve files from ./public when ASSETS binding is not present or assets returned 404
  if (typeof process !== 'undefined') {
    try {
      const url = new URL(request.url);
      const fsMod = await import('fs');
      const pathMod = await import('path');

      const possibleBases = [
        pathMod.join(process.cwd(), 'public'),
        pathMod.join(process.cwd(), 'backend', 'public'),
        pathMod.join(process.cwd(), '..', 'backend', 'public'),
        pathMod.join(process.cwd(), '..', 'public'),
        pathMod.join(process.cwd(), 'dist'),
      ];

      let found = false;
      let data: Buffer | null = null;
      let filePath = '';

      for (const base of possibleBases) {
        const candidate = pathMod.join(base, url.pathname.replace(/^\//, ''));
        const stat = await fsMod.promises.stat(candidate).catch(() => null);
        if (stat && stat.isFile()) {
          data = await fsMod.promises.readFile(candidate);
          filePath = candidate;
          found = true;
          break;
        }

        // try index.html fallback inside candidate dir
        const indexCandidate = pathMod.join(base, 'index.html');
        const idxStat = await fsMod.promises.stat(indexCandidate).catch(() => null);
        if (idxStat && idxStat.isFile()) {
          data = await fsMod.promises.readFile(indexCandidate);
          filePath = indexCandidate;
          found = true;
          break;
        }
      }

      if (!found || !data) {
        return c.text('Static assets not available', 404);
      }

      const contentType = filePath.endsWith('.html') ? 'text/html' : filePath.endsWith('.js') ? 'application/javascript' : filePath.endsWith('.css') ? 'text/css' : 'application/octet-stream';
      return new Response(new Uint8Array(data), { headers: { 'Content-Type': contentType } });
    } catch (e) {
      return c.text('Static assets not available', 404);
    }
  }

  return c.text('Static assets not available', 404);
});

export default app;
