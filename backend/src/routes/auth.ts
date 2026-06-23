import { Hono } from 'hono';
import { Env } from '../types';
import { AppType } from '../types';
import { signJWT } from '../utils/jwt';
import { validateUsername, validateEmail } from '../utils/validator';
import * as bcrypt from 'bcryptjs';
import { createRateLimiter } from '../middleware/rateLimit';

const auth = new Hono<AppType>();

// CP OAuth with PKCE
auth.get('/cpoauth', async (c) => {
  const clientId = c.env.CPOAUTH_CLIENT_ID;
  const redirectUri = `${new URL(c.req.url).origin}/api/v1/auth/cpoauth/callback`;

  // Generate PKCE code_verifier (43-128 chars, URL-safe)
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID() + crypto.randomUUID();

  // Compute code_challenge = BASE64URL(SHA256(code_verifier))
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const state = crypto.randomUUID();

  const cpoauthUrl = `https://www.cpoauth.com/api/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid+profile&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  // Store code_verifier in cookie for callback
  c.header('Set-Cookie', `cpoauth_verifier=${codeVerifier}; Path=/api/v1/auth/cpoauth/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  return c.redirect(cpoauthUrl);
});

auth.get('/cpoauth/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) {
    return c.json({ success: false, error: { message: 'Missing authorization code', code: 'BAD_REQUEST' } }, 400);
  }

  const redirectUri = `${new URL(c.req.url).origin}/api/v1/auth/cpoauth/callback`;

  // Retrieve code_verifier from cookie
  const cookieHeader = c.req.header('Cookie') || '';
  const codeVerifier = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('cpoauth_verifier='))?.split('=')[1];

  // Exchange code for access token (use PKCE code_verifier)
  const tokenBody: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: c.env.CPOAUTH_CLIENT_ID,
    client_secret: c.env.CPOAUTH_CLIENT_SECRET,
  };
  if (codeVerifier) {
    tokenBody.code_verifier = codeVerifier;
  }

  const tokenResponse = await fetch('https://www.cpoauth.com/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tokenBody),
  });

  const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!tokenData.access_token) {
    console.error('CP OAuth token error:', tokenData);
    return c.json({ success: false, error: { message: 'Failed to obtain access token from CP OAuth', code: 'BAD_REQUEST' } }, 400);
  }

  // Fetch user info
  const userResponse = await fetch('https://www.cpoauth.com/api/oauth/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const cpUser = (await userResponse.json()) as {
    sub: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };

  if (!cpUser.sub || !cpUser.username) {
    return c.json({ success: false, error: { message: 'Failed to get user info from CP OAuth', code: 'BAD_REQUEST' } }, 400);
  }

  // Find or create user by cpoauth_id
  let user: any = await c.env.DB.prepare('SELECT * FROM users WHERE cpoauth_id = ?')
    .bind(cpUser.sub)
    .first();

  if (!user) {
    // Also check if username already exists (from a different login method)
    const existing: any = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?')
      .bind(cpUser.username)
      .first();

    if (existing) {
      // Link CP OAuth to existing account
      await c.env.DB.prepare('UPDATE users SET cpoauth_id = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?')
        .bind(cpUser.sub, cpUser.avatar_url || null, existing.id)
        .run();
      user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(existing.id).first();
    } else {
      // Create new user
      const result = await c.env.DB.prepare(
        'INSERT INTO users (cpoauth_id, username, avatar_url, role) VALUES (?, ?, ?, ?)'
      )
        .bind(cpUser.sub, cpUser.username, cpUser.avatar_url || null, 'user')
        .run();
      user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(result.meta.last_row_id)
        .first();
    }
  } else {
    // Update avatar on subsequent logins
    if (cpUser.avatar_url && user.avatar_url !== cpUser.avatar_url) {
      await c.env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?')
        .bind(cpUser.avatar_url, user.id)
        .run();
      user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    }
  }

  const token = await signJWT(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions ? JSON.parse(user.permissions) : [],
    },
    c.env.JWT_SECRET
  );

  return c.redirect(`${c.env.FRONTEND_URL}/auth/callback?token=${token}`);
});

// GitHub OAuth (existing)
auth.get('/github', (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;
  const redirectUri = `${new URL(c.req.url).origin}/api/v1/auth/github/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  return c.redirect(githubAuthUrl);
});

auth.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) {
    return c.json({ success: false, error: { message: 'Missing authorization code', code: 'BAD_REQUEST' } }, 400);
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    return c.json({ success: false, error: { message: 'Failed to obtain access token', code: 'BAD_REQUEST' } }, 400);
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'User-Agent': 'OJ-System',
    },
  });

  const githubUser = (await userResponse.json()) as {
    id: number;
    login: string;
    avatar_url: string;
  };

  let user: any = await c.env.DB.prepare('SELECT * FROM users WHERE github_id = ?')
    .bind(githubUser.id)
    .first();

  if (!user) {
    const result = await c.env.DB.prepare(
      'INSERT INTO users (github_id, username, avatar_url, role) VALUES (?, ?, ?, ?)'
    )
      .bind(githubUser.id, githubUser.login, githubUser.avatar_url, 'user')
      .run();
    user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(result.meta.last_row_id)
      .first();
  }

  const token = await signJWT(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions ? JSON.parse(user.permissions) : [],
    },
    c.env.JWT_SECRET
  );

  return c.redirect(`${c.env.FRONTEND_URL}/auth/callback?token=${token}`);
});

// New: register with username/password
auth.post('/register', createRateLimiter('register', 10, 300_000), async (c) => {
  const body: any = await c.req.json();
  const username = (body.username || '').trim();
  const password = body.password;
  const email = body.email ? (body.email as string).trim() : undefined;

  if (!username || !password) {
    return c.json({ success: false, error: { message: 'Missing username or password', code: 'BAD_REQUEST' } }, 400);
  }

  const usernameError = validateUsername(username);
  if (usernameError) {
    return c.json({ success: false, error: { message: usernameError, code: 'BAD_REQUEST' } }, 400);
  }

  if (password.length < 8) {
    return c.json({ success: false, error: { message: 'Password too short', code: 'BAD_REQUEST' } }, 400);
  }

  // Check registration open flag from settings table or env
  let registrationOpen = true;
  try {
    const row: any = await c.env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('registration_open').first();
    if (row && row.value !== undefined) {
      registrationOpen = row.value === 'true';
    } else if (typeof c.env.REGISTRATION_OPEN !== 'undefined') {
      registrationOpen = String(c.env.REGISTRATION_OPEN) === 'true';
    }
  } catch (e) {
    // ignore and fallback to env
    if (typeof c.env.REGISTRATION_OPEN !== 'undefined') {
      registrationOpen = String(c.env.REGISTRATION_OPEN) === 'true';
    }
  }

  if (!registrationOpen) {
    return c.json({ success: false, error: { message: 'Registration is closed', code: 'FORBIDDEN' } }, 403);
  }

  // Check email_required setting
  let emailRequired = false;
  try {
    const row: any = await c.env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('email_required').first();
    if (row && row.value !== undefined) {
      emailRequired = row.value === 'true';
    }
  } catch { /* ignore */ }

  if (emailRequired && !email) {
    return c.json({ success: false, error: { message: 'Email is required', code: 'BAD_REQUEST' } }, 400);
  }

  // Validate email format if provided
  if (email) {
    const emailError = validateEmail(email);
    if (emailError) {
      return c.json({ success: false, error: { message: 'Invalid email format', code: 'BAD_REQUEST' } }, 400);
    }
  }

  // Check email_suffixes setting
  let emailSuffixes = '';
  try {
    const row: any = await c.env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('email_suffixes').first();
    if (row && row.value) {
      emailSuffixes = row.value;
    }
  } catch { /* ignore */ }

  if (email && emailSuffixes) {
    const allowedSuffixes = emailSuffixes.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    const emailLower = email.toLowerCase();
    const suffixMatch = allowedSuffixes.some((s: string) => emailLower.endsWith(s));
    if (!suffixMatch) {
      return c.json({ success: false, error: { message: 'Email suffix not allowed', code: 'BAD_REQUEST' } }, 400);
    }
  }

  // Check existing user
  const emailParam = email ?? null;
  const existing: any = await c.env.DB.prepare('SELECT id FROM users WHERE username = ? OR email = ?').bind(username, emailParam).first();
  if (existing) {
    return c.json({ success: false, error: { message: 'Username or email already exists', code: 'CONFLICT' } }, 409);
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const insertResult = await c.env.DB.prepare(
    'INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)' 
  ).bind(username, passwordHash, emailParam, 'user').run();

  const user: any = await c.env.DB.prepare('SELECT id, username, role, permissions FROM users WHERE id = ?').bind(insertResult.meta.last_row_id).first();

  try {
    const token = await signJWT({ userId: user.id, username: user.username, role: user.role, permissions: user.permissions ? JSON.parse(user.permissions) : [] }, c.env.JWT_SECRET);
    return c.json({ success: true, data: { token } });
  } catch (e) {
    console.error('JWT Sign Error:', e);
    return c.json({ success: false, error: { message: 'Server configuration error', code: 'INTERNAL_ERROR' } }, 500);
  }
});

// New: login with username/email + password
auth.post('/login', createRateLimiter('login', 10, 300_000), async (c) => {
  const body: any = await c.req.json();
  const usernameOrEmail = (body.username || body.email || '').trim();
  const password = body.password;

  if (!usernameOrEmail || !password) {
    return c.json({ success: false, error: { message: 'Missing credentials', code: 'BAD_REQUEST' } }, 400);
  }

  const user: any = await c.env.DB.prepare('SELECT * FROM users WHERE username = ? OR email = ?').bind(usernameOrEmail, usernameOrEmail).first();
  if (!user) {
    return c.json({ success: false, error: { message: 'Invalid username/email or password', code: 'UNAUTHORIZED' } }, 401);
  }

  if (!user.password_hash) {
    return c.json({ success: false, error: { message: 'Account does not have a password set; use OAuth login', code: 'UNAUTHORIZED' } }, 401);
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    return c.json({ success: false, error: { message: 'Invalid username/email or password', code: 'UNAUTHORIZED' } }, 401);
  }

  try {
    const token = await signJWT({ userId: user.id, username: user.username, role: user.role, permissions: user.permissions ? JSON.parse(user.permissions) : [] }, c.env.JWT_SECRET);
    return c.json({ success: true, data: { token } });
  } catch (e) {
    console.error('JWT Sign Error:', e);
    return c.json({ success: false, error: { message: 'Server configuration error', code: 'INTERNAL_ERROR' } }, 500);
  }
});

auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401);
  }

  const token = authHeader.slice(7);
  const { verifyJWT } = await import('../utils/jwt');
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' } }, 401);
  }

  const user = await c.env.DB.prepare('SELECT id, username, avatar_url, role, created_at FROM users WHERE id = ?')
    .bind(payload.userId)
    .first();

  if (!user) {
    return c.json({ success: false, error: { message: 'User not found', code: 'NOT_FOUND' } }, 404);
  }

  return c.json({ success: true, data: { user } });
});

export default auth;
