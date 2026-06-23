import { Hono } from 'hono';
import { AppType } from '../types';
import { authMiddleware, adminMiddleware, superAdminMiddleware, problemAdminMiddleware, contestAdminMiddleware, ticketAdminMiddleware, listAdminMiddleware } from '../middleware/auth';
import { fetchTestcases } from '../utils/github-testcases';

const admin = new Hono<AppType>();

// GET /stats - Admin dashboard stats
admin.get('/stats', authMiddleware, adminMiddleware, async (c) => {
  const userCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
  const problemCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM problems').first();
  const submissionCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM submissions').first();
  const todaySubmissions = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM submissions WHERE date(created_at) = date('now')"
  ).first();

  return c.json({
    success: true,
    data: {
      users: (userCount as any)?.count || 0,
      problems: (problemCount as any)?.count || 0,
      submissions: (submissionCount as any)?.count || 0,
      today_submissions: (todaySubmissions as any)?.count || 0,
    },
  });
});

// GET /problems - List all problems (including private)
admin.get('/problems', authMiddleware, problemAdminMiddleware, async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize') || '20')));
  const search = c.req.query('search') || '';
  const offset = (page - 1) * pageSize;

  let countQuery = 'SELECT COUNT(*) as total FROM problems';
  let dataQuery = 'SELECT * FROM problems';
  const binds: any[] = [];

  if (search) {
    countQuery += ' WHERE title LIKE ? OR slug LIKE ?';
    dataQuery += ' WHERE title LIKE ? OR slug LIKE ?';
    binds.push(`%${search}%`, `%${search}%`);
  }

  dataQuery += ' ORDER BY id DESC LIMIT ? OFFSET ?';

  const countResult = await c.env.DB.prepare(countQuery).bind(...binds).first();
  const total = (countResult as any)?.total || 0;

  const results = await c.env.DB.prepare(dataQuery).bind(...binds, pageSize, offset).all();

  const problemsWithCounts = await Promise.all(
    results.results.map(async (problem: any) => {
      try {
        const testcases = await fetchTestcases(c.env, problem.slug);
        return { ...problem, testcase_count: testcases.length };
      } catch {
        return { ...problem, testcase_count: 0 };
      }
    })
  );

  return c.json({
    success: true,
    data: {
      problems: problemsWithCounts,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    },
  });
});

// GET /contests - List all contests (admin, including private)
admin.get('/contests', authMiddleware, contestAdminMiddleware, async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize') || '20')));
  const offset = (page - 1) * pageSize;

  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as total FROM contests').first();
  const total = (countResult as any)?.total || 0;
  const results = await c.env.DB.prepare(
    'SELECT c.*, u.username as creator_name FROM contests c JOIN users u ON c.created_by = u.id ORDER BY c.id DESC LIMIT ? OFFSET ?'
  ).bind(pageSize, offset).all();

  return c.json({
    success: true,
    data: {
      contests: results.results,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    },
  });
});

// GET /tickets - List all tickets (admin)
admin.get('/tickets', authMiddleware, ticketAdminMiddleware, async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize') || '20')));
  const status = c.req.query('status');
  const offset = (page - 1) * pageSize;

  let countQuery = 'SELECT COUNT(*) as total FROM tickets';
  let dataQuery = 'SELECT t.*, u.username FROM tickets t JOIN users u ON t.user_id = u.id';
  const binds: any[] = [];
  const countBinds: any[] = [];

  if (status) {
    countQuery += ' WHERE status = ?';
    dataQuery += ' WHERE t.status = ?';
    binds.push(status);
    countBinds.push(status);
  }

  dataQuery += ' ORDER BY t.updated_at DESC LIMIT ? OFFSET ?';

  const countResult = await c.env.DB.prepare(countQuery).bind(...countBinds).first();
  const total = (countResult as any)?.total || 0;
  const results = await c.env.DB.prepare(dataQuery).bind(...binds, pageSize, offset).all();

  return c.json({
    success: true,
    data: {
      tickets: results.results,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    },
  });
});

// GET /lists - List all problem lists (admin)
admin.get('/lists', authMiddleware, listAdminMiddleware, async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize') || '20')));
  const offset = (page - 1) * pageSize;

  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as total FROM problem_lists').first();
  const total = (countResult as any)?.total || 0;
  const results = await c.env.DB.prepare(
    'SELECT pl.*, u.username FROM problem_lists pl JOIN users u ON pl.user_id = u.id ORDER BY pl.id DESC LIMIT ? OFFSET ?'
  ).bind(pageSize, offset).all();

  const listsWithCount = await Promise.all(
    results.results.map(async (list: any) => {
      const count = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM problem_list_items WHERE list_id = ?').bind(list.id).first();
      return { ...list, problem_count: (count as any)?.cnt || 0 };
    })
  );

  return c.json({
    success: true,
    data: {
      lists: listsWithCount,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    },
  });
});

// POST /sql - Execute SQL query (super admin only)
admin.post('/sql', authMiddleware, superAdminMiddleware, async (c) => {
  const body = await c.req.json();
  const { query, password } = body;

  if (!query || typeof query !== 'string') {
    return c.json({ success: false, error: { message: 'Query is required', code: 'BAD_REQUEST' } }, 400);
  }

  const upperQuery = query.trim().toUpperCase();

  // Block structural changes
  const forbidden = ['DROP ', 'ALTER ', 'CREATE ', 'ATTACH ', 'DETACH '];
  for (const f of forbidden) {
    if (upperQuery.startsWith(f)) {
      return c.json({ success: false, error: { message: `Structural operation not allowed: ${f.trim()}`, code: 'FORBIDDEN' } }, 403);
    }
  }

  // DELETE requires password verification
  if (upperQuery.startsWith('DELETE')) {
    if (!password) {
      return c.json({ success: false, error: { message: 'Password confirmation required for DELETE operations', code: 'PASSWORD_REQUIRED' } }, 403);
    }
    // Verify password by checking against GitHub OAuth (users registered via GitHub don't have passwords)
    // Instead, verify the password matches the CALLBACK_SECRET env var as a master password
    if (password !== c.env.CALLBACK_SECRET) {
      return c.json({ success: false, error: { message: 'Invalid password', code: 'INVALID_PASSWORD' } }, 403);
    }
  }

  try {
    const isRead = upperQuery.startsWith('SELECT') || upperQuery.startsWith('PRAGMA');
    if (isRead) {
      const results = await c.env.DB.prepare(query).all();
      return c.json({ success: true, data: { results: results.results, meta: results.meta } });
    } else {
      const result = await c.env.DB.prepare(query).run();
      return c.json({ success: true, data: { meta: result.meta } });
    }
  } catch (e: any) {
    return c.json({ success: false, error: { message: e.message || 'SQL execution failed', code: 'SQL_ERROR' } }, 400);
  }
});

// GET /sql/tables - List all tables (super admin only)
admin.get('/sql/tables', authMiddleware, superAdminMiddleware, async (c) => {
  const results = await c.env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%' AND name != 'd1_migrations' ORDER BY name"
  ).all();
  return c.json({ success: true, data: { tables: results.results.map((r: any) => r.name) } });
});

// GET /sql/table/:name/schema - Get table schema (super admin only)
admin.get('/sql/table/:name/schema', authMiddleware, superAdminMiddleware, async (c) => {
  const tableName = c.req.param('name');
  if (!tableName) {
    return c.json({ success: false, error: { message: 'Table name is required', code: 'BAD_REQUEST' } }, 400);
  }
  // Validate table name to prevent injection
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    return c.json({ success: false, error: { message: 'Invalid table name', code: 'BAD_REQUEST' } }, 400);
  }
  const results = await c.env.DB.prepare(`PRAGMA table_info("${tableName}")`).all();
  return c.json({ success: true, data: { schema: results.results } });
});

// GET /sql/table/:name/data - Get table data with pagination (super admin only)
admin.get('/sql/table/:name/data', authMiddleware, superAdminMiddleware, async (c) => {
  const tableName = c.req.param('name');
  if (!tableName) {
    return c.json({ success: false, error: { message: 'Table name is required', code: 'BAD_REQUEST' } }, 400);
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    return c.json({ success: false, error: { message: 'Invalid table name', code: 'BAD_REQUEST' } }, 400);
  }
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20')));
  const offset = (page - 1) * pageSize;

  const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM "${tableName}"`).first();
  const total = (countResult as any)?.total || 0;
  const results = await c.env.DB.prepare(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`).bind(pageSize, offset).all();

  return c.json({
    success: true,
    data: {
      rows: results.results,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    },
  });
});

// POST /sql/table/:name/row - Insert a new row (super admin only)
admin.post('/sql/table/:name/row', authMiddleware, superAdminMiddleware, async (c) => {
  const tableName = c.req.param('name');
  if (!tableName) {
    return c.json({ success: false, error: { message: 'Table name is required', code: 'BAD_REQUEST' } }, 400);
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    return c.json({ success: false, error: { message: 'Invalid table name', code: 'BAD_REQUEST' } }, 400);
  }
  const body = await c.req.json();
  const { data } = body;
  if (!data || typeof data !== 'object') {
    return c.json({ success: false, error: { message: 'Data object is required', code: 'BAD_REQUEST' } }, 400);
  }

  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => '?').join(', ');
  const colNames = columns.map(c => `"${c}"`).join(', ');

  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`
    ).bind(...values).run();
    return c.json({ success: true, data: { meta: result.meta } });
  } catch (e: any) {
    return c.json({ success: false, error: { message: e.message || 'Insert failed', code: 'SQL_ERROR' } }, 400);
  }
});

// PUT /sql/table/:name/row - Update a row (super admin only)
admin.put('/sql/table/:name/row', authMiddleware, superAdminMiddleware, async (c) => {
  const tableName = c.req.param('name');
  if (!tableName) {
    return c.json({ success: false, error: { message: 'Table name is required', code: 'BAD_REQUEST' } }, 400);
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    return c.json({ success: false, error: { message: 'Invalid table name', code: 'BAD_REQUEST' } }, 400);
  }
  const body = await c.req.json();
  const { data, where } = body;
  if (!data || typeof data !== 'object' || !where || typeof where !== 'object') {
    return c.json({ success: false, error: { message: 'Data and where objects are required', code: 'BAD_REQUEST' } }, 400);
  }

  const setClauses = Object.keys(data).map(k => `"${k}" = ?`).join(', ');
  const whereClauses = Object.keys(where).map(k => `"${k}" = ?`).join(' AND ');
  const values = [...Object.values(data), ...Object.values(where)];

  try {
    const result = await c.env.DB.prepare(
      `UPDATE "${tableName}" SET ${setClauses} WHERE ${whereClauses}`
    ).bind(...values).run();
    return c.json({ success: true, data: { meta: result.meta } });
  } catch (e: any) {
    return c.json({ success: false, error: { message: e.message || 'Update failed', code: 'SQL_ERROR' } }, 400);
  }
});

// DELETE /sql/table/:name/row - Delete a row (super admin only, requires password)
admin.delete('/sql/table/:name/row', authMiddleware, superAdminMiddleware, async (c) => {
  const tableName = c.req.param('name');
  if (!tableName) {
    return c.json({ success: false, error: { message: 'Table name is required', code: 'BAD_REQUEST' } }, 400);
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    return c.json({ success: false, error: { message: 'Invalid table name', code: 'BAD_REQUEST' } }, 400);
  }
  const body = await c.req.json();
  const { where, password } = body;
  if (!where || typeof where !== 'object') {
    return c.json({ success: false, error: { message: 'Where object is required', code: 'BAD_REQUEST' } }, 400);
  }
  if (!password) {
    return c.json({ success: false, error: { message: 'Password confirmation required for DELETE', code: 'PASSWORD_REQUIRED' } }, 403);
  }
  if (password !== c.env.CALLBACK_SECRET) {
    return c.json({ success: false, error: { message: 'Invalid password', code: 'INVALID_PASSWORD' } }, 403);
  }

  const whereClauses = Object.keys(where).map(k => `"${k}" = ?`).join(' AND ');
  const values = Object.values(where);

  try {
    const result = await c.env.DB.prepare(
      `DELETE FROM "${tableName}" WHERE ${whereClauses}`
    ).bind(...values).run();
    return c.json({ success: true, data: { meta: result.meta } });
  } catch (e: any) {
    return c.json({ success: false, error: { message: e.message || 'Delete failed', code: 'SQL_ERROR' } }, 400);
  }
});

export default admin;
