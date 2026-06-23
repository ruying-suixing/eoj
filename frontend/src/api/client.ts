const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private async request<T>(path: string, options: RequestInit = {}, skipJsonBody?: boolean): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!skipJsonBody) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
      });
    } catch {
      throw new Error('Network error. Please check your connection and try again.');
    }

    // Auto-logout on 401
    if (response.status === 401 && token) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('auth:expired'));
      throw new Error('Session expired. Please login again.');
    }

    const result: ApiResponse<T> = await response.json().catch(() => ({
      success: false,
      error: {
        message: 'Failed to parse response',
        code: 'PARSE_ERROR'
      }
    }));

    if (!result.success || !response.ok) {
      const message = result.error?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    if (result.data === undefined) {
      throw new Error('No data in response');
    }

    return result.data;
  }

  async getProblems(params?: { page?: number; pageSize?: number; search?: string; tag?: string; difficulty?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.search) query.set('search', params.search);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.difficulty) query.set('difficulty', params.difficulty);
    return this.request<{ problems: any[]; pagination: any }>(`/problems?${query.toString()}`);
  }

  async getProblem(slug: string) {
    return this.request<{ problem: any; sampleTestcases: any[]; stats: any }>(`/problems/${slug}`);
  }

  async createProblem(data: any) {
    return this.request<{ id: number; message: string }>('/problems', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProblem(id: number, data: any) {
    return this.request<{ message: string }>(`/problems/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async addTestcases(problemId: number, testcases: any[]) {
    return this.request<{ message: string; count: number }>(`/problems/${problemId}/testcases`, {
      method: 'POST',
      body: JSON.stringify(testcases),
    });
  }

  async submitCode(data: { problem_id: number; language: string; source_code: string }) {
    return this.request<{ submission_id: number; status: string }>('/submissions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSubmissions(params?: { page?: number; pageSize?: number; problem_id?: string; status?: string; language?: string; user_id?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.problem_id) query.set('problem_id', params.problem_id);
    if (params?.status) query.set('status', params.status);
    if (params?.language) query.set('language', params.language);
    if (params?.user_id) query.set('user_id', params.user_id);
    return this.request<{ submissions: any[]; pagination: any }>(`/submissions?${query.toString()}`);
  }

  async getSubmission(id: number) {
    return this.request<{ submission: any }>(`/submissions/${id}`);
  }

  async getMe() {
    return this.request<{ user: any }>('/auth/me');
  }

  async register(username: string, password: string, email?: string) {
    return this.request<{ token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    });
  }

  async login(username: string, password: string) {
    return this.request<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async getRankings(limit?: number, timeRange?: string) {
    const query = new URLSearchParams();
    if (limit) query.set('limit', String(limit));
    if (timeRange) query.set('timeRange', timeRange);
    return this.request<{ rankings: any[] }>(`/rankings?${query.toString()}`);
  }

  async getUserProfile() {
    return this.request<{ user: any; stats: any; recent_submissions: any[] }>('/users/profile');
  }

  async getUserSubmissions(params?: { page?: number; pageSize?: number; status?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.status) query.set('status', params.status);
    return this.request<{ submissions: any[]; pagination: any }>(`/users/submissions?${query.toString()}`);
  }

  async getUserSolved() {
    return this.request<{ problems: any[] }>('/users/solved');
  }

  async getUserContests() {
    return this.request<{ contests: any[] }>('/users/contests');
  }

  async getUserByUsername(username: string) {
    return this.request<{ user: any; stats: any; solved_problems: any[]; recent_submissions: any[] }>(`/users/${username}`);
  }

  async getProblemStatus(problemId: number) {
    return this.request<{ solved: boolean; attempted: boolean }>(`/problems/${problemId}/status`);
  }

  async checkFavorite(problemId: number) {
    return this.request<{ is_favorited: boolean }>(`/problems/${problemId}/favorite`);
  }

  async addFavorite(problemId: number) {
    return this.request<{ message: string }>(`/problems/${problemId}/favorite`, {
      method: 'POST',
    });
  }

  async removeFavorite(problemId: number) {
    return this.request<{ message: string }>(`/problems/${problemId}/favorite`, {
      method: 'DELETE',
    });
  }

  async getFavorites(params?: { page?: number; pageSize?: number }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return this.request<{ problems: any[]; pagination: any }>(`/problems/user/favorites${qs ? `?${qs}` : ''}`);
  }

  async getUserList(params?: { page?: number; pageSize?: number; search?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return this.request<{ users: any[]; pagination: any }>(`/users/list${qs ? `?${qs}` : ''}`);
  }

  async updateUserRole(userId: number, role: string) {
    return this.request<{ message: string }>(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async updateUserPermissions(userId: number, permissions: string[]) {
    return this.request<{ message: string }>(`/users/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  }

  async getAdminStats() {
    return this.request<{ users: number; problems: number; submissions: number; today_submissions: number }>('/admin/stats');
  }

  async getAdminProblems(params?: { page?: number; pageSize?: number; search?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.search) query.set('search', params.search);
    return this.request<{ problems: any[]; pagination: any }>(`/admin/problems?${query.toString()}`);
  }

  async deleteProblem(id: number) {
    return this.request<{ message: string }>(`/problems/${id}`, {
      method: 'DELETE',
    });
  }

  async getProblemTestcases(problemId: number) {
    return this.request<{ testcases: any[] }>(`/problems/${problemId}/testcases`);
  }

  async deleteTestcase(problemId: number, index: number) {
    return this.request<{ message: string }>(`/problems/${problemId}/testcases/${index}`, {
      method: 'DELETE',
    });
  }

  async getProblemSpj(problemId: number) {
    return this.request<{ spj_code: string; spj_language: string }>(`/problems/${problemId}/spj`);
  }

  async updateProblemSpj(problemId: number, language: string, code: string) {
    return this.request<{ message: string }>(`/problems/${problemId}/spj`, {
      method: 'PUT',
      body: JSON.stringify({ language, code }),
    });
  }

  async deleteProblemSpj(problemId: number) {
    return this.request<{ message: string }>(`/problems/${problemId}/spj`, {
      method: 'DELETE',
    });
  }

  getGithubAuthUrl() {
    return `${this.baseUrl}/auth/github`;
  }

  // Contests
  async getContests(params?: { page?: number; pageSize?: number; status?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.status) query.set('status', params.status);
    return this.request<{ contests: any[]; pagination: any }>(`/contests?${query.toString()}`);
  }

  async getContest(id: number) {
    return this.request<{ contest: any }>(`/contests/${id}`);
  }

  async createContest(data: any) {
    return this.request<{ id: number; message: string }>('/contests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateContest(id: number, data: any) {
    return this.request<{ message: string }>(`/contests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteContest(id: number) {
    return this.request<{ message: string }>(`/contests/${id}`, {
      method: 'DELETE',
    });
  }

  async getContestProblems(id: number) {
    return this.request<{ problems: any[] }>(`/contests/${id}/problems`);
  }

  async registerContest(id: number) {
    return this.request<{ message: string }>(`/contests/${id}/register`, {
      method: 'POST',
    });
  }

  async getContestRankings(id: number) {
    return this.request<{ rankings: any[]; problems: any[] }>(`/contests/${id}/rankings`);
  }

  async checkContestRegistration(id: number) {
    return this.request<{ registered: boolean }>(`/contests/${id}/registration`);
  }

  async getContestMyStatus(id: number) {
    return this.request<{ problems: Record<string, { status: string; score: number; best_score: number }> }>(`/contests/${id}/my-status`);
  }

  // Tickets
  async getTickets(params?: { page?: number; pageSize?: number; status?: string; category?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.status) query.set('status', params.status);
    if (params?.category) query.set('category', params.category);
    return this.request<{ tickets: any[]; pagination: any }>(`/tickets?${query.toString()}`);
  }

  async getTicket(id: number) {
    return this.request<{ ticket: any; replies: any[] }>(`/tickets/${id}`);
  }

  async createTicket(data: { title: string; content: string; category?: string; priority?: string }) {
    return this.request<{ id: number; message: string }>('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async replyTicket(id: number, content: string) {
    return this.request<{ message: string }>(`/tickets/${id}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async updateTicketStatus(id: number, data: { status?: string; priority?: string }) {
    return this.request<{ message: string }>(`/tickets/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Problem Lists
  async getProblemLists(params?: { page?: number; pageSize?: number; search?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.search) query.set('search', params.search);
    return this.request<{ lists: any[]; pagination: any }>(`/lists?${query.toString()}`);
  }

  async getProblemList(id: number) {
    return this.request<{ list: any; items: any[] }>(`/lists/${id}`);
  }

  async createProblemList(data: any) {
    return this.request<{ id: number; message: string }>('/lists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProblemList(id: number, data: any) {
    return this.request<{ message: string }>(`/lists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProblemList(id: number) {
    return this.request<{ message: string }>(`/lists/${id}`, {
      method: 'DELETE',
    });
  }

  // Admin - Contests
  async getAdminContests(params?: { page?: number; pageSize?: number }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    return this.request<{ contests: any[]; pagination: any }>(`/admin/contests?${query.toString()}`);
  }

  // Admin - Tickets
  async getAdminTickets(params?: { page?: number; pageSize?: number; status?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.status) query.set('status', params.status);
    return this.request<{ tickets: any[]; pagination: any }>(`/admin/tickets?${query.toString()}`);
  }

  // Admin - Problem Lists
  async getAdminLists(params?: { page?: number; pageSize?: number }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    return this.request<{ lists: any[]; pagination: any }>(`/admin/lists?${query.toString()}`);
  }

  // Admin - SQL Execute (super admin only)
  async executeSql(query: string, password?: string) {
    return this.request<{ results?: any[]; meta?: any }>(`/admin/sql`, {
      method: 'POST',
      body: JSON.stringify({ query, password }),
    });
  }

  // SQL Visual Editor APIs
  async getSqlTables() {
    return this.request<{ tables: string[] }>('/admin/sql/tables');
  }

  async getTableSchema(tableName: string) {
    return this.request<{ schema: any[] }>(`/admin/sql/table/${tableName}/schema`);
  }

  async getTableData(tableName: string, params?: { page?: number; pageSize?: number }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    return this.request<{ rows: any[]; pagination: any }>(`/admin/sql/table/${tableName}/data?${query.toString()}`);
  }

  async insertTableRow(tableName: string, data: Record<string, any>) {
    return this.request<{ meta: any }>(`/admin/sql/table/${tableName}/row`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }

  async updateTableRow(tableName: string, data: Record<string, any>, where: Record<string, any>) {
    return this.request<{ meta: any }>(`/admin/sql/table/${tableName}/row`, {
      method: 'PUT',
      body: JSON.stringify({ data, where }),
    });
  }

  async deleteTableRow(tableName: string, where: Record<string, any>, password: string) {
    return this.request<{ meta: any }>(`/admin/sql/table/${tableName}/row`, {
      method: 'DELETE',
      body: JSON.stringify({ where, password }),
    });
  }

  // Solutions
  async getSolutions(params?: { problem_id?: number; page?: number; pageSize?: number; sort?: string }) {
    const query = new URLSearchParams();
    if (params?.problem_id) query.set('problem_id', String(params.problem_id));
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.sort) query.set('sort', params.sort);
    return this.request<{ solutions: any[]; pagination: any }>(`/solutions?${query.toString()}`);
  }

  async getSolution(id: number) {
    return this.request<{ solution: any; is_voted: boolean }>(`/solutions/${id}`);
  }

  async createSolution(data: { problem_id: number; title: string; content: string; language?: string }) {
    return this.request<{ id: number; message: string }>('/solutions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSolution(id: number, data: { title?: string; content?: string; language?: string }) {
    return this.request<{ message: string }>(`/solutions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSolution(id: number) {
    return this.request<{ message: string }>(`/solutions/${id}`, {
      method: 'DELETE',
    });
  }

  async voteSolution(id: number) {
    return this.request<{ vote_count: number; is_voted: boolean }>(`/solutions/${id}/vote`, {
      method: 'POST',
    });
  }

  // Discussions
  async getDiscussions(params?: { problem_id?: number; page?: number; pageSize?: number; category?: string; sort?: string }) {
    const query = new URLSearchParams();
    if (params?.problem_id) query.set('problem_id', String(params.problem_id));
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.category) query.set('category', params.category);
    if (params?.sort) query.set('sort', params.sort);
    return this.request<{ discussions: any[]; pagination: any }>(`/discussions?${query.toString()}`);
  }

  async getDiscussion(id: number) {
    return this.request<{ discussion: any; replies: any[] }>(`/discussions/${id}`);
  }

  async createDiscussion(data: { problem_id?: number; title: string; content: string; category?: string }) {
    return this.request<{ id: number; message: string }>('/discussions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDiscussion(id: number, data: { title?: string; content?: string; category?: string }) {
    return this.request<{ message: string }>(`/discussions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDiscussion(id: number) {
    return this.request<{ message: string }>(`/discussions/${id}`, {
      method: 'DELETE',
    });
  }

  async createDiscussionReply(discussionId: number, content: string) {
    return this.request<{ message: string }>(`/discussions/${discussionId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deleteDiscussionReply(discussionId: number, replyId: number) {
    return this.request<{ message: string }>(`/discussions/${discussionId}/replies/${replyId}`, {
      method: 'DELETE',
    });
  }

  async updateProfile(data: { avatar_url?: string; bio?: string }) {
    return this.request<{ user: any }>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(oldPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/users/change-password', {
      method: 'PUT',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
  }

  // Settings
  async getSettings() {
    return this.request<Record<string, string>>('/settings');
  }

  async getSetting(key: string) {
    return this.request<{ value: string }>(`/settings/${key}`);
  }

  async updateSettings(data: Record<string, string>) {
    return this.request<{ message: string }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<{ id: number; url: string; filename: string; original_name: string; file_type: string; size_bytes: number }>('/uploads/image', {
      method: 'POST',
      body: formData,
    }, true);
  }

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<{ id: number; url: string; filename: string; original_name: string; file_type: string; size_bytes: number }>('/uploads/file', {
      method: 'POST',
      body: formData,
    }, true);
  }

  async getUploads(params?: { page?: number; pageSize?: number; type?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.type) query.set('type', params.type);
    return this.request<{ uploads: any[]; pagination: any }>(`/uploads?${query.toString()}`);
  }

  async deleteUpload(id: number) {
    return this.request<{ message: string }>(`/uploads/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient(API_BASE);
