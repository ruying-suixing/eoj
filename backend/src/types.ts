export interface Env {
  DB: D1Database;
  ASSETS: any;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  CPOAUTH_CLIENT_ID: string;
  CPOAUTH_CLIENT_SECRET: string;
  JWT_SECRET: string;
  GITHUB_TOKEN: string;
  CALLBACK_SECRET: string;
  JUDGE_REPO: string;
  FRONTEND_URL: string;
  REGISTRATION_OPEN: string;
}

export interface UserPayload {
  id: number;
  userId: number;
  username: string;
  role: string;
  permissions?: string[];
  avatar_url?: string;
  created_at?: string;
}

export type AppType = {
  Bindings: Env;
  Variables: {
    user: UserPayload;
  };
};
