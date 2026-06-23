import { Hono } from 'hono';
import { AppType } from '../types';
import { authMiddleware, contestAdminMiddleware } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimit';

const contests = new Hono<AppType>();

const contestCreateLimiter = createRateLimiter('contest_create', 10, 60_000);
const contestRegisterLimiter = createRateLimiter('contest_register', 5, 60_000);

// List contests
contests.get('/', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize') || '20')));
  const status = c.req.query('status');
  const offset = (page - 1) * pageSize;

  let query = 'SELECT c.*, u.username as creator_name FROM contests c JOIN users u ON c.created_by = u.id WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as total FROM contests WHERE 1=1';
  const binds: any[] = [];
  const countBinds: any[] = [];

  if (status) {
    query += ' AND c.status = ?';
    countQuery += ' AND status = ?';
    binds.push(status);
    countBinds.push(status);
  } else {
    query += ' AND c.is_public = 1';
    countQuery += ' AND is_public = 1';
  }

  query += ' ORDER BY c.start_time DESC LIMIT ? OFFSET ?';

  const countResult = await c.env.DB.prepare(countQuery).bind(...countBinds).first();
  const total = (countResult as any)?.total || 0;
  const results = await c.env.DB.prepare(query).bind(...binds, pageSize, offset).all();

  return c.json({
    success: true,
    data: {
      contests: results.results,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    },
  });
});

// Get contest detail
contests.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const contest = await c.env.DB.prepare(
    'SELECT c.*, u.username as creator_name FROM contests c JOIN users u ON c.created_by = u.id WHERE c.id = ?'
  ).bind(id).first();

  if (!contest) {
    return c.json({ success: false, error: { message: 'Contest not found', code: 'NOT_FOUND' } }, 404);
  }

  return c.json({ success: true, data: { contest } });
});

// Create contest (admin only)
contests.post('/', authMiddleware, contestAdminMiddleware, contestCreateLimiter, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { title, description, start_time, end_time, is_public, problems } = body;

  if (!title || !start_time || !end_time) {
    return c.json({ success: false, error: { message: 'title, start_time, end_time are required', code: 'BAD_REQUEST' } }, 400);
  }

  if (title.length > 200) {
    return c.json({ success: false, error: { message: 'title must be at most 200 characters', code: 'BAD_REQUEST' } }, 400);
  }

  if (description && description.length > 5000) {
    return c.json({ success: false, error: { message: 'description must be at most 5000 characters', code: 'BAD_REQUEST' } }, 400);
  }

  if (new Date(start_time) >= new Date(end_time)) {
    return c.json({ success: false, error: { message: 'start_time must be before end_time', code: 'BAD_REQUEST' } }, 400);
  }

  if (problems && Array.isArray(problems) && problems.length > 26) {
    return c.json({ success: false, error: { message: 'problems array must have at most 26 items', code: 'BAD_REQUEST' } }, 400);
  }

  const startTime = new Date(start_time);
  const endTime = new Date(end_time);
  const now = new Date();
  let status = 'upcoming';
  if (now >= startTime && now < endTime) status = 'running';
  if (now >= endTime) status = 'ended';

  const result = await c.env.DB.prepare(
    'INSERT INTO contests (title, description, start_time, end_time, status, is_public, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(title, description || '', start_time, end_time, status, is_public ?? 1, user.userId).run();

  const contestId = result.meta.last_row_id;

  // Add problems to contest
  if (problems && Array.isArray(problems)) {
    for (let i = 0; i < problems.length; i++) {
      const p = problems[i];
      const label = String.fromCharCode(65 + i); // A, B, C...
      await c.env.DB.prepare(
        'INSERT INTO contest_problems (contest_id, problem_id, label, score) VALUES (?, ?, ?, ?)'
      ).bind(contestId, p.problem_id, p.label || label, p.score || 100).run();
    }
  }

  return c.json({ success: true, data: { id: contestId, message: 'Contest created' } }, 201);
});

// Update contest (admin only)
contests.put('/:id', authMiddleware, contestAdminMiddleware, async (c) => {
  const id = parseInt(c.req.param('id')!);
  const body = await c.req.json();
  const { title, description, start_time, end_time, is_public, status } = body;

  const contest = await c.env.DB.prepare('SELECT * FROM contests WHERE id = ?').bind(id).first();
  if (!contest) {
    return c.json({ success: false, error: { message: 'Contest not found', code: 'NOT_FOUND' } }, 404);
  }

  const updates: string[] = [];
  const binds: any[] = [];

  if (title !== undefined) { updates.push('title = ?'); binds.push(title); }
  if (description !== undefined) { updates.push('description = ?'); binds.push(description); }
  if (start_time !== undefined) { updates.push('start_time = ?'); binds.push(start_time); }
  if (end_time !== undefined) { updates.push('end_time = ?'); binds.push(end_time); }
  if (is_public !== undefined) { updates.push('is_public = ?'); binds.push(is_public); }
  if (status !== undefined) { updates.push('status = ?'); binds.push(status); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    binds.push(id);
    await c.env.DB.prepare(`UPDATE contests SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();
  }

  // Update problems if provided
  if (body.problems && Array.isArray(body.problems)) {
    await c.env.DB.prepare('DELETE FROM contest_problems WHERE contest_id = ?').bind(id).run();
    for (let i = 0; i < body.problems.length; i++) {
      const p = body.problems[i];
      const label = String.fromCharCode(65 + i);
      await c.env.DB.prepare(
        'INSERT INTO contest_problems (contest_id, problem_id, label, score) VALUES (?, ?, ?, ?)'
      ).bind(id, p.problem_id, p.label || label, p.score || 100).run();
    }
  }

  return c.json({ success: true, data: { message: 'Contest updated' } });
});

// Delete contest (admin only)
contests.delete('/:id', authMiddleware, contestAdminMiddleware, async (c) => {
  const id = parseInt(c.req.param('id')!);
  await c.env.DB.prepare('DELETE FROM contests WHERE id = ?').bind(id).run();
  return c.json({ success: true, data: { message: 'Contest deleted' } });
});

// Get contest problems
contests.get('/:id/problems', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id')!);

  const contest = await c.env.DB.prepare('SELECT * FROM contests WHERE id = ?').bind(id).first();
  if (!contest) {
    return c.json({ success: false, error: { message: 'Contest not found', code: 'NOT_FOUND' } }, 404);
  }

  // Check if user is participant or admin
  const isAdmin = user.role === 'admin';
  const isParticipant = !!(await c.env.DB.prepare(
    'SELECT id FROM contest_participants WHERE contest_id = ? AND user_id = ?'
  ).bind(id, user.userId).first());

  const contestStatus = (contest as any).status;
  const isRunning = contestStatus === 'running';
  const isEnded = contestStatus === 'ended';

  // Only participants (or admin) can see problems during running contest
  if (isRunning && !isAdmin && !isParticipant) {
    return c.json({ success: false, error: { message: 'You must register for this contest first', code: 'FORBIDDEN' } }, 403);
  }

  // During upcoming contest, only admin can see problems
  if (contestStatus === 'upcoming' && !isAdmin) {
    return c.json({ success: false, error: { message: 'Contest has not started yet', code: 'FORBIDDEN' } }, 403);
  }

  const problems = await c.env.DB.prepare(
    `SELECT cp.label, cp.score, p.id, p.title, p.slug, p.difficulty, p.tags, p.time_limit, p.memory_limit
     FROM contest_problems cp JOIN problems p ON cp.problem_id = p.id
     WHERE cp.contest_id = ? ORDER BY cp.label`
  ).bind(id).all();

  // If contest is running, include sample testcases
  // If ended, include all testcases
  return c.json({ success: true, data: { problems: problems.results } });
});

// Register for contest
contests.post('/:id/register', authMiddleware, contestRegisterLimiter, async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id')!);

  const contest = await c.env.DB.prepare('SELECT * FROM contests WHERE id = ?').bind(id).first();
  if (!contest) {
    return c.json({ success: false, error: { message: 'Contest not found', code: 'NOT_FOUND' } }, 404);
  }

  const contestStatus = (contest as any).status;
  if (contestStatus === 'ended') {
    return c.json({ success: false, error: { message: 'Contest has ended', code: 'BAD_REQUEST' } }, 400);
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM contest_participants WHERE contest_id = ? AND user_id = ?'
  ).bind(id, user.userId).first();

  if (existing) {
    return c.json({ success: false, error: { message: 'Already registered', code: 'BAD_REQUEST' } }, 400);
  }

  await c.env.DB.prepare(
    'INSERT INTO contest_participants (contest_id, user_id) VALUES (?, ?)'
  ).bind(id, user.userId).run();

  return c.json({ success: true, data: { message: 'Registered successfully' } });
});

// Get contest rankings/leaderboard
contests.get('/:id/rankings', async (c) => {
  const id = parseInt(c.req.param('id'));

  const contest = await c.env.DB.prepare('SELECT * FROM contests WHERE id = ?').bind(id).first();
  if (!contest) {
    return c.json({ success: false, error: { message: 'Contest not found', code: 'NOT_FOUND' } }, 404);
  }

  // Get all participants
  const participants = await c.env.DB.prepare(
    'SELECT cp.user_id, u.username FROM contest_participants cp JOIN users u ON cp.user_id = u.id WHERE cp.contest_id = ?'
  ).bind(id).all();

  // Get contest problems
  const contestProblems = await c.env.DB.prepare(
    'SELECT cp.label, cp.problem_id, cp.score FROM contest_problems cp WHERE cp.contest_id = ? ORDER BY cp.label'
  ).bind(id).all();

  if (participants.results.length === 0 || contestProblems.results.length === 0) {
    return c.json({ success: true, data: { rankings: [], problems: contestProblems.results } });
  }

  // Batch query: get ALL submissions for counting attempts, and best for each
  const userIds = participants.results.map((p: any) => p.user_id);
  const problemIds = contestProblems.results.map((p: any) => p.problem_id);

  const placeholders = userIds.map(() => '?').join(',');
  const problemPlaceholders = problemIds.map(() => '?').join(',');

  const allSubmissions = await c.env.DB.prepare(
    `SELECT id, user_id, problem_id, status, score, time_used, created_at FROM submissions
     WHERE user_id IN (${placeholders}) AND problem_id IN (${problemPlaceholders})
     AND status != 'pending' AND status != 'running'
     AND datetime(created_at) >= datetime(?) AND datetime(created_at) <= datetime(?)`
  ).bind(...userIds, ...problemIds, (contest as any).start_time, (contest as any).end_time).all();

  // Group submissions by user_id and problem_id
  const bestSubs: Record<string, any> = {};
  const attemptCounts: Record<string, number> = {};
  const firstAcceptedAt: Record<string, string> = {};

  for (const sub of allSubmissions.results as any[]) {
    const key = `${sub.user_id}:${sub.problem_id}`;
    // Count attempts (non-pending submissions)
    attemptCounts[key] = (attemptCounts[key] || 0) + 1;
    // Find best submission
    const existing = bestSubs[key];
    if (!existing || sub.score > existing.score || (sub.score === existing.score && sub.time_used < existing.time_used)) {
      bestSubs[key] = sub;
    }
    // Track first accepted time for penalty calculation
    if (sub.status === 'accepted') {
      if (!firstAcceptedAt[key] || new Date(sub.created_at) < new Date(firstAcceptedAt[key])) {
        firstAcceptedAt[key] = sub.created_at;
      }
    }
  }

  // Count wrong attempts before first accepted for penalty
  const wrongBeforeAccepted: Record<string, number> = {};
  for (const sub of allSubmissions.results as any[]) {
    const key = `${sub.user_id}:${sub.problem_id}`;
    if (firstAcceptedAt[key] && new Date(sub.created_at) <= new Date(firstAcceptedAt[key])) {
      if (sub.status !== 'accepted') {
        wrongBeforeAccepted[key] = (wrongBeforeAccepted[key] || 0) + 1;
      }
    }
  }

  const contestStartTime = new Date((contest as any).start_time).getTime();

  // Build rankings
  const rankings: any[] = [];
  for (const participant of participants.results) {
    const userId = (participant as any).user_id;
    const username = (participant as any).username;
    let totalScore = 0;
    let acceptedCount = 0;
    let totalPenalty = 0; // penalty in minutes
    const problemResults: any = {};

    for (const cp of contestProblems.results) {
      const problemId = (cp as any).problem_id;
      const label = (cp as any).label;
      const score = (cp as any).score;
      const key = `${userId}:${problemId}`;
      const bestSub = bestSubs[key];
      const attempts = attemptCounts[key] || 0;
      const wrongAttempts = wrongBeforeAccepted[key] || 0;

      if (bestSub) {
        problemResults[label] = {
          status: bestSub.status,
          score: bestSub.score || 0,
          time_used: bestSub.time_used || 0,
          attempts,
          wrong_attempts: wrongAttempts,
        };
        if (bestSub.status === 'accepted') {
          acceptedCount++;
          totalScore += bestSub.score || score;
          // Penalty = time from contest start to first AC (minutes) + 20 * wrong attempts
          const acTime = new Date(firstAcceptedAt[key]).getTime();
          const timeFromStart = Math.floor((acTime - contestStartTime) / 60000);
          totalPenalty += timeFromStart + wrongAttempts * 20;
        } else {
          totalScore += bestSub.score || 0;
        }
      } else {
        problemResults[label] = null;
      }
    }

    rankings.push({
      user_id: userId,
      username,
      total_score: totalScore,
      accepted_count: acceptedCount,
      total_penalty: totalPenalty,
      problems: problemResults,
    });
  }

  rankings.sort((a, b) => {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    return a.total_penalty - b.total_penalty;
  });

  return c.json({ success: true, data: { rankings, problems: contestProblems.results } });
});

// Check if user is registered
contests.get('/:id/registration', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id')!);

  const registered = !!(await c.env.DB.prepare(
    'SELECT id FROM contest_participants WHERE contest_id = ? AND user_id = ?'
  ).bind(id, user.userId).first());

  return c.json({ success: true, data: { registered } });
});

// Get current user's problem status in contest
contests.get('/:id/my-status', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id')!);

  const contest = await c.env.DB.prepare('SELECT * FROM contests WHERE id = ?').bind(id).first();
  if (!contest) {
    return c.json({ success: false, error: { message: 'Contest not found', code: 'NOT_FOUND' } }, 404);
  }

  const contestProblems = await c.env.DB.prepare(
    'SELECT cp.label, cp.problem_id, cp.score FROM contest_problems cp WHERE cp.contest_id = ? ORDER BY cp.label'
  ).bind(id).all();

  if (contestProblems.results.length === 0) {
    return c.json({ success: true, data: { problems: {} } });
  }

  const problemIds = contestProblems.results.map((p: any) => p.problem_id);
  const problemPlaceholders = problemIds.map(() => '?').join(',');

  const submissions = await c.env.DB.prepare(
    `SELECT problem_id, status, score FROM submissions
     WHERE user_id = ? AND problem_id IN (${problemPlaceholders})
     AND status != 'pending' AND status != 'running'
     AND datetime(created_at) >= datetime(?) AND datetime(created_at) <= datetime(?)`
  ).bind(user.userId, ...problemIds, (contest as any).start_time, (contest as any).end_time).all();

  // Build per-problem status
  const problemStatus: Record<string, { status: string; score: number; best_score: number }> = {};
  for (const cp of contestProblems.results as any[]) {
    problemStatus[cp.label] = { status: 'unattempted', score: 0, best_score: 0 };
  }

  for (const sub of submissions.results as any[]) {
    const cp = (contestProblems.results as any[]).find((p: any) => p.problem_id === sub.problem_id);
    if (!cp) continue;
    const label = cp.label;
    const existing = problemStatus[label];
    if (sub.score > existing.best_score) {
      existing.best_score = sub.score;
      existing.status = sub.status;
      existing.score = sub.score;
    } else if (existing.status === 'unattempted') {
      existing.status = sub.status;
      existing.score = sub.score;
    }
  }

  return c.json({ success: true, data: { problems: problemStatus } });
});

export default contests;
