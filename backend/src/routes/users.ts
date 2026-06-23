import { Hono } from 'hono';
import { AppType } from '../types';
import { authMiddleware, adminMiddleware, superAdminMiddleware } from '../middleware/auth';
import * as bcrypt from 'bcryptjs';

const users = new Hono<AppType>();

// Admin only: List all users (paginated)
users.get('/list', authMiddleware, adminMiddleware, async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20')));
  const search = c.req.query('search') || '';
  const offset = (page - 1) * pageSize;

  let countQuery = 'SELECT COUNT(*) as total FROM users';
  let dataQuery = 'SELECT id, username, avatar_url, role, permissions, created_at FROM users';
  const binds: any[] = [];
  const countBinds: any[] = [];

  if (search) {
    countQuery += ' WHERE username LIKE ?';
    dataQuery += ' WHERE username LIKE ?';
    binds.push(`%${search}%`);
    countBinds.push(`%${search}%`);
  }

  dataQuery += ' ORDER BY id ASC LIMIT ? OFFSET ?';

  const countResult = await c.env.DB.prepare(countQuery).bind(...countBinds).first();
  const total = (countResult as any)?.total || 0;

  const results = await c.env.DB.prepare(dataQuery).bind(...binds, pageSize, offset).all();
  
  return c.json({
    success: true,
    data: {
      users: results.results,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  });
});

// Admin only: Update user role
users.put('/:id/role', authMiddleware, adminMiddleware, async (c) => {
  const userId = parseInt(c.req.param('id') || '0');
  const body: any = await c.req.json();
  const { role } = body;

  // Check if trying to change super admin (user id=1)
  if (userId === 1) {
    return c.json({ success: false, error: { message: 'Cannot modify super admin role', code: 'FORBIDDEN' } }, 403);
  }

  if (!['user', 'admin'].includes(role)) {
    return c.json({ success: false, error: { message: 'Invalid role', code: 'BAD_REQUEST' } }, 400);
  }

  await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?')
    .bind(role, userId)
    .run();

  return c.json({ success: true, data: { message: 'Role updated' } });
});

// Super admin only: Update user permissions
users.put('/:id/permissions', authMiddleware, superAdminMiddleware, async (c) => {
  const userId = parseInt(c.req.param('id') || '0');
  const body: any = await c.req.json();
  const { permissions } = body;

  if (userId === 1) {
    return c.json({ success: false, error: { message: 'Cannot modify super admin permissions', code: 'FORBIDDEN' } }, 403);
  }

  const validPermissions = ['contest_admin', 'problem_admin', 'list_admin', 'ticket_admin', 'upload_admin'];
  if (!Array.isArray(permissions) || !permissions.every((p: string) => validPermissions.includes(p))) {
    return c.json({ success: false, error: { message: 'Invalid permissions', code: 'BAD_REQUEST' } }, 400);
  }

  await c.env.DB.prepare('UPDATE users SET permissions = ? WHERE id = ?')
    .bind(JSON.stringify(permissions), userId)
    .run();

  return c.json({ success: true, data: { message: 'Permissions updated' } });
});

users.get('/profile', authMiddleware, async (c) => {
  const user = c.get('user');
  
  // Fetch full user details from DB since JWT only contains basic info
  const fullUser: any = await c.env.DB.prepare('SELECT id, username, avatar_url, role, created_at FROM users WHERE id = ?')
    .bind(user.id)
    .first();

  if (!fullUser) {
    return c.json({ success: false, error: { message: 'User not found', code: 'NOT_FOUND' } }, 404);
  }
  
  const statsResult = await c.env.DB.prepare(`
    SELECT 
      COUNT(DISTINCT CASE WHEN s.status = 'accepted' THEN s.problem_id END) as solved_count,
      COUNT(s.id) as total_submissions,
      COUNT(DISTINCT s.problem_id) as attempted_count
    FROM submissions s
    WHERE s.user_id = ?
  `).bind(fullUser.id).first();
  
  const recentSubmissions = await c.env.DB.prepare(`
    SELECT s.*, p.title, p.slug 
    FROM submissions s
    JOIN problems p ON s.problem_id = p.id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
    LIMIT 10
  `).bind(fullUser.id).all();
  
  return c.json({
    success: true,
    data: {
      user: {
        id: fullUser.id,
        username: fullUser.username,
        avatar_url: fullUser.avatar_url,
        role: fullUser.role,
        created_at: fullUser.created_at,
      },
      stats: {
        solved_count: (statsResult as any)?.solved_count || 0,
        total_submissions: (statsResult as any)?.total_submissions || 0,
        attempted_count: (statsResult as any)?.attempted_count || 0,
      },
      recent_submissions: recentSubmissions.results,
    },
  });
});

users.get('/submissions', authMiddleware, async (c) => {
  const user = c.get('user');
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize') || '20')));
  const status = c.req.query('status') || '';
  const offset = (page - 1) * pageSize;
  
  let countQuery = 'SELECT COUNT(*) as total FROM submissions WHERE user_id = ?';
  let dataQuery = `
    SELECT s.*, p.title, p.slug, p.difficulty 
    FROM submissions s
    JOIN problems p ON s.problem_id = p.id
    WHERE s.user_id = ?
  `;
  
  const binds: any[] = [user.id];
  const countBinds: any[] = [user.id];
  
  if (status) {
    countQuery += ' AND status = ?';
    dataQuery += ' AND s.status = ?';
    binds.push(status);
    countBinds.push(status);
  }
  
  dataQuery += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
  binds.push(pageSize, offset);
  
  const countResult = await c.env.DB.prepare(countQuery)
    .bind(...countBinds)
    .first();
  const total = (countResult as any)?.total || 0;
  
  const results = await c.env.DB.prepare(dataQuery)
    .bind(...binds)
    .all();
  
  return c.json({
    success: true,
    data: {
      submissions: results.results,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  });
});

users.get('/solved', authMiddleware, async (c) => {
  const user = c.get('user');
  
  const results = await c.env.DB.prepare(`
    SELECT DISTINCT p.* 
    FROM problems p
    JOIN submissions s ON p.id = s.problem_id
    WHERE s.user_id = ? AND s.status = 'accepted'
    ORDER BY p.id ASC
  `).bind(user.id).all();
  
  return c.json({
    success: true,
    data: {
      problems: results.results,
    },
  });
});

users.get('/contests', authMiddleware, async (c) => {
  const user = c.get('user');

  const results = await c.env.DB.prepare(`
    SELECT c.*, cp.joined_at,
      (SELECT COUNT(*) FROM contest_participants WHERE contest_id = c.id) as participant_count
    FROM contests c
    JOIN contest_participants cp ON c.id = cp.contest_id
    WHERE cp.user_id = ?
    ORDER BY c.start_time DESC
  `).bind(user.id).all();

  return c.json({
    success: true,
    data: {
      contests: results.results,
    },
  });
});

users.get('/:username', async (c) => {
  const username = c.req.param('username');
  
  const user = await c.env.DB.prepare(`
    SELECT id, username, avatar_url, bio, created_at
    FROM users WHERE username = ?
  `).bind(username).first();

  if (!user) {
    return c.json({
      success: false,
      error: { message: 'User not found', code: 'NOT_FOUND' }
    }, 404);
  }

  const statsResult = await c.env.DB.prepare(`
    SELECT
      COUNT(DISTINCT CASE WHEN s.status = 'accepted' THEN s.problem_id END) as solved_count,
      COUNT(s.id) as total_submissions,
      COUNT(DISTINCT s.problem_id) as attempted_count
    FROM submissions s
    WHERE s.user_id = ?
  `).bind((user as any).id).first();

  const solvedProblems = await c.env.DB.prepare(`
    SELECT p.id, p.title, p.slug, p.difficulty
    FROM problems p
    JOIN submissions s ON p.id = s.problem_id
    WHERE s.user_id = ? AND s.status = 'accepted'
    GROUP BY p.id
    ORDER BY p.id ASC
  `).bind((user as any).id).all();

  const recentSubmissions = await c.env.DB.prepare(`
    SELECT s.id, s.language, s.status, s.created_at, p.title, p.slug
    FROM submissions s
    JOIN problems p ON s.problem_id = p.id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
    LIMIT 10
  `).bind((user as any).id).all();

  return c.json({
    success: true,
    data: {
      user: {
        id: (user as any).id,
        username: (user as any).username,
        avatar_url: (user as any).avatar_url,
        bio: (user as any).bio || '',
        created_at: (user as any).created_at,
      },
      stats: {
        solved_count: (statsResult as any)?.solved_count || 0,
        total_submissions: (statsResult as any)?.total_submissions || 0,
        attempted_count: (statsResult as any)?.attempted_count || 0,
      },
      solved_problems: solvedProblems.results,
      recent_submissions: recentSubmissions.results,
    },
  });
});

users.put('/profile', authMiddleware, async (c) => {
  const user = c.get('user');
  const body: any = await c.req.json();
  const avatarUrl = body.avatar_url;
  const bio = body.bio;

  // Validate bio length
  if (bio !== undefined && bio.length > 500) {
    return c.json({ success: false, error: { message: 'Bio too long (max 500 characters)', code: 'BAD_REQUEST' } }, 400);
  }

  // Build update query dynamically
  const updates: string[] = [];
  const params: any[] = [];
  if (avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(avatarUrl); }
  if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }

  if (updates.length === 0) {
    return c.json({ success: false, error: { message: 'No fields to update', code: 'BAD_REQUEST' } }, 400);
  }

  params.push(user.userId);
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  const updatedUser = await c.env.DB.prepare('SELECT id, username, avatar_url, bio, role, created_at FROM users WHERE id = ?').bind(user.userId).first();
  return c.json({ success: true, data: { user: updatedUser } });
});

users.put('/change-password', authMiddleware, async (c) => {
  const user = c.get('user');
  const body: any = await c.req.json();
  const oldPassword = body.old_password;
  const newPassword = body.new_password;

  if (!oldPassword || !newPassword) {
    return c.json({ success: false, error: { message: 'Missing old_password or new_password', code: 'BAD_REQUEST' } }, 400);
  }

  if (newPassword.length < 8) {
    return c.json({ success: false, error: { message: 'New password must be at least 8 characters', code: 'BAD_REQUEST' } }, 400);
  }

  const dbUser: any = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.userId).first();

  if (!dbUser?.password_hash) {
    // OAuth user without password - allow setting initial password
    const hash = bcrypt.hashSync(newPassword, 10);
    await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, user.userId).run();
    return c.json({ success: true, data: { message: 'Password set successfully' } });
  }

  if (!bcrypt.compareSync(oldPassword, dbUser.password_hash)) {
    return c.json({ success: false, error: { message: 'Old password is incorrect', code: 'UNAUTHORIZED' } }, 401);
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, user.userId).run();
  return c.json({ success: true, data: { message: 'Password changed successfully' } });
});

export default users;
