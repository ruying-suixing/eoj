import * as bcrypt from 'bcryptjs';
import { saveTestcases } from './utils/github-testcases';

interface SeedTestcase {
  input: string;
  expected_output: string;
  is_sample: boolean;
  score: number;
}

interface SeedProblem {
  title: string;
  slug: string;
  description: string;
  input_format: string;
  output_format: string;
  time_limit: number;
  memory_limit: number;
  tags: string[];
  difficulty: string;
  is_public: number;
  testcases: SeedTestcase[];
}

const SEED_PROBLEMS = [
  {
    title: 'A + B Problem',
    slug: 'a-plus-b',
    description: `Given two integers A and B, calculate A + B.

This is the easiest problem to get started with the OJ system.`,
    input_format: 'Two integers A and B, separated by a space. (-1000 ≤ A, B ≤ 1000)',
    output_format: 'Output the sum of A and B.',
    time_limit: 1000,
    memory_limit: 256,
    tags: ['math'],
    difficulty: 'Easy',
    is_public: 1,
    testcases: [
      { input: '1 2', expected_output: '3', is_sample: true, score: 20 },
      { input: '0 0', expected_output: '0', is_sample: false, score: 20 },
      { input: '-1 1', expected_output: '0', is_sample: false, score: 20 },
      { input: '100 200', expected_output: '300', is_sample: false, score: 20 },
      { input: '-500 500', expected_output: '0', is_sample: false, score: 20 },
    ],
  },
  {
    title: 'Hello World',
    slug: 'hello-world',
    description: `Print "Hello, World!" to the standard output.

This is the classic first program everyone writes.`,
    input_format: 'No input.',
    output_format: 'Output the string "Hello, World!" (without quotes).',
    time_limit: 1000,
    memory_limit: 256,
    tags: ['io'],
    difficulty: 'Easy',
    is_public: 1,
    testcases: [
      { input: '', expected_output: 'Hello, World!', is_sample: true, score: 50 },
      { input: '', expected_output: 'Hello, World!', is_sample: false, score: 50 },
    ],
  },
  {
    title: 'Fibonacci Sequence',
    slug: 'fibonacci',
    description: `Given an integer n (1 ≤ n ≤ 30), output the n-th number in the Fibonacci sequence.

The Fibonacci sequence is defined as:
- F(1) = 1
- F(2) = 1
- F(n) = F(n-1) + F(n-2) for n > 2`,
    input_format: 'A single integer n (1 ≤ n ≤ 30).',
    output_format: 'Output the n-th Fibonacci number.',
    time_limit: 1000,
    memory_limit: 256,
    tags: ['dp', 'math'],
    difficulty: 'Medium',
    is_public: 1,
    testcases: [
      { input: '1', expected_output: '1', is_sample: false, score: 10 },
      { input: '2', expected_output: '1', is_sample: false, score: 10 },
      { input: '6', expected_output: '8', is_sample: true, score: 10 },
      { input: '10', expected_output: '55', is_sample: false, score: 10 },
      { input: '20', expected_output: '6765', is_sample: false, score: 20 },
      { input: '30', expected_output: '832040', is_sample: false, score: 20 },
      { input: '5', expected_output: '5', is_sample: false, score: 10 },
      { input: '15', expected_output: '610', is_sample: false, score: 10 },
    ],
  },
];

export async function seedDatabase(db: D1Database, env: { GITHUB_TOKEN: string; JUDGE_REPO: string }) {
  // Check if seed has already been executed
  const seedDone = await db.prepare("SELECT value FROM settings WHERE key = 'seed_done'").first();
  if (seedDone) {
    throw new Error('Seed has already been executed. Cannot run again.');
  }

  // Seed admin user if not exists
  const existingAdmin = await db.prepare('SELECT id FROM users WHERE username = ?').bind('admin').first();
  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync('admin123456', 10);
    await db.prepare(
      'INSERT INTO users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)'
    ).bind('admin', passwordHash, 'admin', '["contest_admin","problem_admin","list_admin","ticket_admin","upload_admin"]').run();
    console.log('Seeded admin user (username: admin, password: admin123456)');
  }

  for (const problem of SEED_PROBLEMS) {
    const { testcases, ...problemData } = problem;

    const existing = await db.prepare('SELECT id FROM problems WHERE slug = ?')
      .bind(problemData.slug)
      .first();

    if (existing) continue;

    const result = await db.prepare(
      `INSERT INTO problems (title, slug, description, input_format, output_format, time_limit, memory_limit, tags, difficulty, is_public)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        problemData.title,
        problemData.slug,
        problemData.description,
        problemData.input_format,
        problemData.output_format,
        problemData.time_limit,
        problemData.memory_limit,
        JSON.stringify(problemData.tags),
        problemData.difficulty,
        problemData.is_public
      )
      .run();

    // Save testcases to GitHub
    if (testcases && testcases.length > 0) {
      await saveTestcases(env, problemData.slug, testcases);
    }
  }

  // Mark seed as done
  await db.prepare("INSERT INTO settings (key, value) VALUES ('seed_done', 'true')").run();
}
