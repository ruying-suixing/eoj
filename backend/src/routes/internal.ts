import { Hono } from 'hono';
import { AppType } from '../types';
import { fetchSpjCode } from '../utils/github-spj';

const internal = new Hono<AppType>();

internal.post('/callback', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401);
  }

  const token = authHeader.slice(7);
  if (token !== c.env.CALLBACK_SECRET) {
    return c.json({ success: false, error: { message: 'Invalid callback secret', code: 'FORBIDDEN' } }, 403);
  }

  const body = await c.req.json();
  const { submission_id, status, score, time_used, memory_used, details, github_run_id } = body;

  if (!submission_id || !status) {
    return c.json({ success: false, error: { message: 'submission_id and status are required', code: 'BAD_REQUEST' } }, 400);
  }

  const validStatuses = [
    'accepted', 'wrong_answer', 'time_limit_exceeded',
    'memory_limit_exceeded', 'runtime_error', 'compile_error', 'system_error',
  ];

  if (!validStatuses.includes(status)) {
    return c.json({ success: false, error: { message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`, code: 'BAD_REQUEST' } }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM submissions WHERE id = ?')
    .bind(submission_id)
    .first();

  if (!existing) {
    return c.json({ success: false, error: { message: 'Submission not found', code: 'NOT_FOUND' } }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE submissions SET status = ?, score = ?, time_used = ?, memory_used = ?, details = ?, github_run_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  )
    .bind(
      status,
      score || 0,
      time_used || null,
      memory_used || null,
      details ? JSON.stringify(details) : null,
      github_run_id || null,
      submission_id
    )
    .run();

  return c.json({ success: true, data: { message: 'Submission updated' } });
});

internal.get('/judge-data', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } }, 401);
  }

  const token = authHeader.slice(7);
  if (token !== c.env.CALLBACK_SECRET) {
    return c.json({ success: false, error: { message: 'Invalid callback secret', code: 'FORBIDDEN' } }, 403);
  }

  const submissionId = parseInt(c.req.query('submission_id') || '0');
  if (!submissionId) {
    return c.json({ success: false, error: { message: 'submission_id is required', code: 'BAD_REQUEST' } }, 400);
  }

  const submission = await c.env.DB.prepare(
    'SELECT id, problem_id, language, source_code FROM submissions WHERE id = ?'
  )
    .bind(submissionId)
    .first();

  if (!submission) {
    return c.json({ success: false, error: { message: 'Submission not found', code: 'NOT_FOUND' } }, 404);
  }

  const problem = await c.env.DB.prepare(
    'SELECT slug, time_limit, memory_limit, judge_type, spj_language FROM problems WHERE id = ?'
  )
    .bind((submission as any).problem_id)
    .first();

  if (!problem) {
    return c.json({ success: false, error: { message: 'Problem not found', code: 'NOT_FOUND' } }, 404);
  }

  const filePath = `testcases/${(problem as any).slug}.json`;
  const githubResponse = await fetch(
    `https://api.github.com/repos/${c.env.JUDGE_REPO}/contents/${filePath}`,
    {
      headers: {
        Authorization: `Bearer ${c.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3.raw',
        'User-Agent': 'OJ-System',
      },
    }
  );

  if (!githubResponse.ok) {
    const body = await githubResponse.text();
    console.error('GitHub testcase fetch failed:', githubResponse.status, body);
    return c.json({ success: false, error: { message: 'Failed to load testcases from judge repository', code: 'INTERNAL_ERROR' } }, 500);
  }

  let testcases: any[];
  try {
    testcases = await githubResponse.json();
  } catch (e) {
    console.error('Invalid testcase JSON:', e);
    return c.json({ success: false, error: { message: 'Invalid testcase format in judge repository', code: 'INTERNAL_ERROR' } }, 500);
  }

  const responseData: any = {
    submission,
    testcases,
    problem,
  };

  // Include SPJ code if judge_type is 'spj'
  if ((problem as any).judge_type === 'spj' && (problem as any).spj_language) {
    const spjCode = await fetchSpjCode(c.env, (problem as any).slug, (problem as any).spj_language);
    responseData.spj_code = spjCode;
  }

  return c.json({
    success: true,
    data: responseData,
  });
});

export default internal;
