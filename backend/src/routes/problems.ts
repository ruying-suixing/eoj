import { Hono } from 'hono';
import { AppType } from '../types';
import { authMiddleware, problemAdminMiddleware } from '../middleware/auth';
import { validateSlug } from '../utils/validator';
import { fetchTestcases, saveTestcases, deleteTestcases } from '../utils/github-testcases';
import { fetchSpjCode, saveSpjCode, deleteSpjCode } from '../utils/github-spj';

const VALID_SPJ_LANGUAGES = ['python', 'cpp', 'java', 'javascript', 'c', 'go', 'rust'];

const problems = new Hono<AppType>();

problems.get('/', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize') || '20')));
  const search = c.req.query('search') || '';
  const tag = c.req.query('tag') || '';
  const difficulty = c.req.query('difficulty') || '';
  const offset = (page - 1) * pageSize;

  let countQuery = 'SELECT COUNT(*) as total FROM problems WHERE is_public = 1';
  let dataQuery = `
    SELECT p.id, p.title, p.slug, p.tags, p.difficulty, p.time_limit, p.memory_limit, p.judge_type, p.created_at,
           COUNT(DISTINCT s.id) as submission_count,
           COUNT(DISTINCT CASE WHEN s.status = 'accepted' THEN s.id END) as accepted_count
    FROM problems p
    LEFT JOIN submissions s ON p.id = s.problem_id
    WHERE p.is_public = 1
  `;
  const binds: any[] = [];

  if (search) {
    countQuery += ' AND (title LIKE ? OR slug LIKE ?)';
    dataQuery += ' AND (p.title LIKE ? OR p.slug LIKE ?)';
    binds.push(`%${search}%`, `%${search}%`);
  }

  if (tag) {
    countQuery += ' AND tags LIKE ?';
    dataQuery += ' AND p.tags LIKE ?';
    binds.push(`%"${tag}"%`);
  }

  if (difficulty) {
    countQuery += ' AND difficulty = ?';
    dataQuery += ' AND p.difficulty = ?';
    binds.push(difficulty);
  }

  dataQuery += ' GROUP BY p.id, p.title, p.slug, p.tags, p.difficulty, p.time_limit, p.memory_limit, p.judge_type, p.created_at';
  dataQuery += ' ORDER BY p.id ASC LIMIT ? OFFSET ?';

  const countResult = await c.env.DB.prepare(countQuery)
    .bind(...binds)
    .first();
  const total = (countResult as any)?.total || 0;

  const results = await c.env.DB.prepare(dataQuery)
    .bind(...binds, pageSize, offset)
    .all();

  const problemsWithStats = results.results.map((problem: any) => ({
    ...problem,
    submission_count: problem.submission_count || 0,
    accepted_count: problem.accepted_count || 0,
    pass_rate: problem.submission_count > 0 ? Math.round((problem.accepted_count / problem.submission_count) * 100) / 100 : 0
  }));

  return c.json({
    success: true,
    data: {
      problems: problemsWithStats,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  });
});

// ── Literal-path routes BEFORE /:slug to avoid shadowing ──

problems.get('/user/solved', authMiddleware, async (c) => {
  const user = c.get('user');
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize') || '20')));
  const offset = (page - 1) * pageSize;

  const countQuery = `
    SELECT COUNT(DISTINCT p.id) as total 
    FROM problems p 
    JOIN submissions s ON p.id = s.problem_id 
    WHERE s.user_id = ? AND s.status = 'accepted' AND p.is_public = 1
  `;

  const dataQuery = `
    SELECT DISTINCT p.id, p.title, p.slug, p.tags, p.difficulty, p.time_limit, p.memory_limit, p.judge_type, p.created_at,
           COUNT(DISTINCT s_all.id) as submission_count,
           COUNT(DISTINCT CASE WHEN s_all.status = 'accepted' THEN s_all.id END) as accepted_count
    FROM problems p
    JOIN submissions s ON p.id = s.problem_id AND s.user_id = ? AND s.status = 'accepted'
    LEFT JOIN submissions s_all ON p.id = s_all.problem_id
    WHERE p.is_public = 1
    GROUP BY p.id, p.title, p.slug, p.tags, p.difficulty, p.time_limit, p.memory_limit, p.judge_type, p.created_at
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countResult = await c.env.DB.prepare(countQuery).bind(user.userId).first();
  const total = (countResult as any)?.total || 0;

  const results = await c.env.DB.prepare(dataQuery).bind(user.userId, pageSize, offset).all();

  const problemsWithStats = results.results.map((problem: any) => ({
    ...problem,
    submission_count: problem.submission_count || 0,
    accepted_count: problem.accepted_count || 0,
    pass_rate: problem.submission_count > 0 ? Math.round((problem.accepted_count / problem.submission_count) * 100) / 100 : 0
  }));

  return c.json({
    success: true,
    data: {
      problems: problemsWithStats,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  });
});

problems.get('/user/favorites', authMiddleware, async (c) => {
  const user = c.get('user');
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize') || '20')));
  const offset = (page - 1) * pageSize;

  const countQuery = `
    SELECT COUNT(*) as total 
    FROM favorites f 
    JOIN problems p ON f.problem_id = p.id 
    WHERE f.user_id = ? AND p.is_public = 1
  `;

  const dataQuery = `
    SELECT p.id, p.title, p.slug, p.tags, p.difficulty, p.time_limit, p.memory_limit, p.judge_type, p.created_at, f.created_at as favorited_at,
           COUNT(DISTINCT s.id) as submission_count,
           COUNT(DISTINCT CASE WHEN s.status = 'accepted' THEN s.id END) as accepted_count
    FROM favorites f
    JOIN problems p ON f.problem_id = p.id
    LEFT JOIN submissions s ON p.id = s.problem_id
    WHERE f.user_id = ? AND p.is_public = 1
    GROUP BY p.id, p.title, p.slug, p.tags, p.difficulty, p.time_limit, p.memory_limit, p.judge_type, p.created_at, f.created_at
    ORDER BY f.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const countResult = await c.env.DB.prepare(countQuery).bind(user.userId).first();
  const total = (countResult as any)?.total || 0;

  const results = await c.env.DB.prepare(dataQuery).bind(user.userId, pageSize, offset).all();

  const problemsWithStats = results.results.map((problem: any) => ({
    ...problem,
    submission_count: problem.submission_count || 0,
    accepted_count: problem.accepted_count || 0,
    pass_rate: problem.submission_count > 0 ? Math.round((problem.accepted_count / problem.submission_count) * 100) / 100 : 0
  }));

  return c.json({
    success: true,
    data: {
      problems: problemsWithStats,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  });
});

// ── Parameterized routes ──

problems.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const problem = await c.env.DB.prepare(
    'SELECT * FROM problems WHERE slug = ? AND is_public = 1'
  )
    .bind(slug)
    .first();

  if (!problem) {
    return c.json({ success: false, error: { message: 'Problem not found', code: 'NOT_FOUND' } }, 404);
  }

  const statsResult = await c.env.DB.prepare(
    `SELECT
       COUNT(*) as submission_count,
       COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_count
     FROM submissions
     WHERE problem_id = ?`
  )
    .bind((problem as any).id)
    .first();

  const stats = statsResult as any;
  const submission_count = stats?.submission_count || 0;
  const accepted_count = stats?.accepted_count || 0;
  const pass_rate = submission_count > 0 ? Math.round((accepted_count / submission_count) * 100) / 100 : 0;

  const allTestcases = await fetchTestcases(c.env, slug);
  const sampleTestcases = allTestcases.filter(tc => tc.is_sample);

  const responseData: any = {
    problem,
    stats: {
      submission_count,
      accepted_count,
      pass_rate
    },
    sampleTestcases,
  };

  // Include SPJ code if judge_type is 'spj'
  if ((problem as any).judge_type === 'spj' && (problem as any).spj_language) {
    const spjCode = await fetchSpjCode(c.env, slug, (problem as any).spj_language);
    responseData.spj_code = spjCode;
  }

  return c.json({
    success: true,
    data: responseData,
  });
});

// ── Problem status endpoint (Bug 3 fix) ──

problems.get('/:id/status', authMiddleware, async (c) => {
  const user = c.get('user');
  const problemId = parseInt(c.req.param('id') || '0');

  const solved = await c.env.DB.prepare(
    "SELECT id FROM submissions WHERE user_id = ? AND problem_id = ? AND status = 'accepted' LIMIT 1"
  )
    .bind(user.userId, problemId)
    .first();

  const attempted = solved ? true : !!(await c.env.DB.prepare(
    "SELECT id FROM submissions WHERE user_id = ? AND problem_id = ? LIMIT 1"
  )
    .bind(user.userId, problemId)
    .first());

  return c.json({
    success: true,
    data: {
      solved: !!solved,
      attempted,
    },
  });
});

problems.post('/', authMiddleware, problemAdminMiddleware, async (c) => {
  const body = await c.req.json();
  const { title, slug, description, input_format, output_format, time_limit, memory_limit, tags, difficulty, is_public, testcases, judge_type, spj_language, spj_code } = body;

  if (!title || !slug || !description) {
    return c.json({ success: false, error: { message: 'title, slug, and description are required', code: 'BAD_REQUEST' } }, 400);
  }

  const slugError = validateSlug(slug);
  if (slugError) {
    return c.json({ success: false, error: { message: slugError, code: 'BAD_REQUEST' } }, 400);
  }

  // Validate SPJ fields
  const effectiveJudgeType = judge_type || 'default';
  if (effectiveJudgeType === 'spj') {
    if (!spj_language || !VALID_SPJ_LANGUAGES.includes(spj_language)) {
      return c.json({ success: false, error: { message: `spj_language is required and must be one of: ${VALID_SPJ_LANGUAGES.join(', ')}`, code: 'BAD_REQUEST' } }, 400);
    }
    if (spj_code && spj_code.length > 65535) {
      return c.json({ success: false, error: { message: 'SPJ code must be at most 65535 characters', code: 'BAD_REQUEST' } }, 400);
    }
  }

  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO problems (title, slug, description, input_format, output_format, time_limit, memory_limit, tags, difficulty, is_public, judge_type, spj_language)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        title,
        slug,
        description,
        input_format || null,
        output_format || null,
        time_limit || 1000,
        memory_limit || 256,
        JSON.stringify(tags || []),
        difficulty || 'Easy',
        is_public !== undefined ? (is_public ? 1 : 0) : 1,
        effectiveJudgeType,
        effectiveJudgeType === 'spj' ? spj_language : null
      )
      .run();

    // Save testcases to GitHub if provided
    if (testcases && Array.isArray(testcases) && testcases.length > 0) {
      await saveTestcases(c.env, slug, testcases);
    }

    // Save SPJ code to GitHub if provided
    if (effectiveJudgeType === 'spj' && spj_code) {
      await saveSpjCode(c.env, slug, spj_language, spj_code);
    }

    return c.json({ success: true, data: { id: result.meta.last_row_id, message: 'Problem created' } }, 201);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint')) {
      return c.json({ success: false, error: { message: 'Slug already exists', code: 'CONFLICT' } }, 409);
    }
    return c.json({ success: false, error: { message: 'Failed to create problem', code: 'INTERNAL_ERROR' } }, 500);
  }
});

problems.put('/:id', authMiddleware, problemAdminMiddleware, async (c) => {
  const id = parseInt(c.req.param('id') || '0');
  const body = await c.req.json();

  const existing = await c.env.DB.prepare('SELECT id, slug, judge_type, spj_language FROM problems WHERE id = ?')
    .bind(id)
    .first();
  if (!existing) {
    return c.json({ success: false, error: { message: 'Problem not found', code: 'NOT_FOUND' } }, 404);
  }

  // Validate SPJ fields if provided
  if (body.judge_type === 'spj') {
    const spjLang = body.spj_language || (existing as any).spj_language;
    if (!spjLang || !VALID_SPJ_LANGUAGES.includes(spjLang)) {
      return c.json({ success: false, error: { message: `spj_language is required and must be one of: ${VALID_SPJ_LANGUAGES.join(', ')}`, code: 'BAD_REQUEST' } }, 400);
    }
  }

  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (['title', 'description', 'input_format', 'output_format', 'time_limit', 'memory_limit', 'difficulty', 'is_public'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(key === 'tags' ? JSON.stringify(value) : value);
    }
    if (key === 'tags') {
      fields.push('tags = ?');
      values.push(JSON.stringify(value));
    }
    if (key === 'judge_type') {
      fields.push('judge_type = ?');
      values.push(value);
    }
    if (key === 'spj_language') {
      fields.push('spj_language = ?');
      values.push(value || null);
    }
  }

  if (fields.length === 0) {
    return c.json({ success: false, error: { message: 'No fields to update', code: 'BAD_REQUEST' } }, 400);
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  await c.env.DB.prepare(`UPDATE problems SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return c.json({ success: true, data: { message: 'Problem updated' } });
});

problems.delete('/:id', authMiddleware, problemAdminMiddleware, async (c) => {
  const id = parseInt(c.req.param('id') || '0');

  const existing = await c.env.DB.prepare('SELECT id, slug, judge_type, spj_language FROM problems WHERE id = ?')
    .bind(id)
    .first();
  if (!existing) {
    return c.json({ success: false, error: { message: 'Problem not found', code: 'NOT_FOUND' } }, 404);
  }

  // Delete testcases from GitHub
  await deleteTestcases(c.env, (existing as any).slug);
  // Delete SPJ code from GitHub if exists
  if ((existing as any).judge_type === 'spj' && (existing as any).spj_language) {
    await deleteSpjCode(c.env, (existing as any).slug, (existing as any).spj_language);
  }
  // Delete related data from D1
  await c.env.DB.prepare('DELETE FROM submissions WHERE problem_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM favorites WHERE problem_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM problems WHERE id = ?').bind(id).run();

  return c.json({ success: true, data: { message: 'Problem deleted' } });
});

problems.get('/:id/testcases', authMiddleware, problemAdminMiddleware, async (c) => {
  const problemId = parseInt(c.req.param('id') || '0');

  const existing = await c.env.DB.prepare('SELECT id, slug FROM problems WHERE id = ?')
    .bind(problemId)
    .first();
  if (!existing) {
    return c.json({ success: false, error: { message: 'Problem not found', code: 'NOT_FOUND' } }, 404);
  }

  const testcases = await fetchTestcases(c.env, (existing as any).slug);

  return c.json({
    success: true,
    data: {
      testcases,
    },
  });
});

problems.delete('/:id/testcases/:index', authMiddleware, problemAdminMiddleware, async (c) => {
  const problemId = parseInt(c.req.param('id') || '0');
  const index = parseInt(c.req.param('index') || '0');

  const existing = await c.env.DB.prepare('SELECT id, slug FROM problems WHERE id = ?')
    .bind(problemId)
    .first();
  if (!existing) {
    return c.json({ success: false, error: { message: 'Problem not found', code: 'NOT_FOUND' } }, 404);
  }

  const testcases = await fetchTestcases(c.env, (existing as any).slug);
  if (index < 0 || index >= testcases.length) {
    return c.json({ success: false, error: { message: 'Testcase index out of range', code: 'NOT_FOUND' } }, 404);
  }

  testcases.splice(index, 1);
  const success = await saveTestcases(c.env, (existing as any).slug, testcases);

  if (!success) {
    return c.json({ success: false, error: { message: 'Failed to delete testcase', code: 'INTERNAL_ERROR' } }, 500);
  }

  return c.json({ success: true, data: { message: 'Testcase deleted' } });
});

problems.post('/:id/testcases', authMiddleware, problemAdminMiddleware, async (c) => {
  const problemId = parseInt(c.req.param('id') || '0');
  const body = await c.req.json();

  const existing = await c.env.DB.prepare('SELECT id, slug, judge_type FROM problems WHERE id = ?')
    .bind(problemId)
    .first();
  if (!existing) {
    return c.json({ success: false, error: { message: 'Problem not found', code: 'NOT_FOUND' } }, 404);
  }

  const slug = (existing as any).slug;
  const isSpj = (existing as any).judge_type === 'spj';
  const newTestcases = Array.isArray(body) ? body : [body];

  // Filter out invalid testcases - for SPJ problems, expected_output is optional
  const validTestcases = newTestcases.filter(tc =>
    tc.input && (isSpj || tc.expected_output)
  );
  if (validTestcases.length === 0) {
    return c.json({ success: false, error: { message: 'No valid testcases provided', code: 'BAD_REQUEST' } }, 400);
  }

  // Get existing testcases and append new ones
  const existingTestcases = await fetchTestcases(c.env, slug);
  const allTestcases = [
    ...existingTestcases,
    ...validTestcases.map(tc => ({
      input: tc.input,
      expected_output: tc.expected_output || '',
      is_sample: tc.is_sample || false,
      score: tc.score || 10,
    })),
  ];

  const success = await saveTestcases(c.env, slug, allTestcases);

  if (!success) {
    return c.json({ success: false, error: { message: 'Failed to save testcases', code: 'INTERNAL_ERROR' } }, 500);
  }

  return c.json({ success: true, data: { message: 'Testcases added', count: validTestcases.length } }, 201);
});

// ── SPJ endpoints ──

problems.get('/:id/spj', authMiddleware, problemAdminMiddleware, async (c) => {
  const problemId = parseInt(c.req.param('id') || '0');

  const existing = await c.env.DB.prepare('SELECT id, slug, judge_type, spj_language FROM problems WHERE id = ?')
    .bind(problemId)
    .first();
  if (!existing) {
    return c.json({ success: false, error: { message: 'Problem not found', code: 'NOT_FOUND' } }, 404);
  }

  if ((existing as any).judge_type !== 'spj') {
    return c.json({ success: false, error: { message: 'Problem is not a special judge problem', code: 'BAD_REQUEST' } }, 400);
  }

  const spjCode = await fetchSpjCode(c.env, (existing as any).slug, (existing as any).spj_language);

  return c.json({
    success: true,
    data: {
      language: (existing as any).spj_language,
      code: spjCode,
    },
  });
});

problems.put('/:id/spj', authMiddleware, problemAdminMiddleware, async (c) => {
  const problemId = parseInt(c.req.param('id') || '0');
  const body = await c.req.json();
  const { language, code } = body;

  const existing = await c.env.DB.prepare('SELECT id, slug, judge_type, spj_language FROM problems WHERE id = ?')
    .bind(problemId)
    .first();
  if (!existing) {
    return c.json({ success: false, error: { message: 'Problem not found', code: 'NOT_FOUND' } }, 404);
  }

  if (!language || !VALID_SPJ_LANGUAGES.includes(language)) {
    return c.json({ success: false, error: { message: `language is required and must be one of: ${VALID_SPJ_LANGUAGES.join(', ')}`, code: 'BAD_REQUEST' } }, 400);
  }

  if (!code || typeof code !== 'string') {
    return c.json({ success: false, error: { message: 'code is required', code: 'BAD_REQUEST' } }, 400);
  }

  if (code.length > 65535) {
    return c.json({ success: false, error: { message: 'SPJ code must be at most 65535 characters', code: 'BAD_REQUEST' } }, 400);
  }

  // If language changed, delete old SPJ file first
  if ((existing as any).spj_language && (existing as any).spj_language !== language) {
    await deleteSpjCode(c.env, (existing as any).slug, (existing as any).spj_language);
  }

  // Save new SPJ code
  const success = await saveSpjCode(c.env, (existing as any).slug, language, code);
  if (!success) {
    return c.json({ success: false, error: { message: 'Failed to save SPJ code', code: 'INTERNAL_ERROR' } }, 500);
  }

  // Update spj_language and judge_type in database
  await c.env.DB.prepare(
    'UPDATE problems SET judge_type = ?, spj_language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind('spj', language, problemId)
    .run();

  return c.json({ success: true, data: { message: 'SPJ code saved' } });
});

problems.delete('/:id/spj', authMiddleware, problemAdminMiddleware, async (c) => {
  const problemId = parseInt(c.req.param('id') || '0');

  const existing = await c.env.DB.prepare('SELECT id, slug, judge_type, spj_language FROM problems WHERE id = ?')
    .bind(problemId)
    .first();
  if (!existing) {
    return c.json({ success: false, error: { message: 'Problem not found', code: 'NOT_FOUND' } }, 404);
  }

  if ((existing as any).spj_language) {
    await deleteSpjCode(c.env, (existing as any).slug, (existing as any).spj_language);
  }

  // Reset judge_type to default
  await c.env.DB.prepare(
    'UPDATE problems SET judge_type = ?, spj_language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  )
    .bind('default', null, problemId)
    .run();

  return c.json({ success: true, data: { message: 'SPJ code deleted' } });
});

problems.get('/:id/favorite', authMiddleware, async (c) => {
  const user = c.get('user');
  const problemId = parseInt(c.req.param('id') || '0');

  const favorite = await c.env.DB.prepare(
    'SELECT id FROM favorites WHERE user_id = ? AND problem_id = ?'
  )
    .bind(user.userId, problemId)
    .first();

  return c.json({
    success: true,
    data: {
      is_favorited: !!favorite
    }
  });
});

problems.post('/:id/favorite', authMiddleware, async (c) => {
  const user = c.get('user');
  const problemId = parseInt(c.req.param('id') || '0');

  const problem = await c.env.DB.prepare(
    'SELECT id FROM problems WHERE id = ? AND is_public = 1'
  )
    .bind(problemId)
    .first();

  if (!problem) {
    return c.json({ success: false, error: { message: 'Problem not found', code: 'NOT_FOUND' } }, 404);
  }

  try {
    await c.env.DB.prepare(
      'INSERT INTO favorites (user_id, problem_id) VALUES (?, ?)'
    )
      .bind(user.userId, problemId)
      .run();

    return c.json({ success: true, data: { message: 'Favorite added' } });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint')) {
      return c.json({ success: false, error: { message: 'Already favorited', code: 'CONFLICT' } }, 409);
    }
    return c.json({ success: false, error: { message: 'Failed to add favorite', code: 'INTERNAL_ERROR' } }, 500);
  }
});

problems.delete('/:id/favorite', authMiddleware, async (c) => {
  const user = c.get('user');
  const problemId = parseInt(c.req.param('id') || '0');

  await c.env.DB.prepare(
    'DELETE FROM favorites WHERE user_id = ? AND problem_id = ?'
  )
    .bind(user.userId, problemId)
    .run();

  return c.json({ success: true, data: { message: 'Favorite removed' } });
});

export default problems;
