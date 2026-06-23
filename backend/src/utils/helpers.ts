export const LANGUAGE_EXT: Record<string, string> = {
  python: 'py',
  cpp: 'cpp',
  java: 'java',
  javascript: 'js',
  c: 'c',
  go: 'go',
  rust: 'rs',
};

export function getLanguageExt(language: string): string {
  return LANGUAGE_EXT[language] || 'txt';
}

export function jsonResponse<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

export function paginate(page: number, pageSize: number, total: number) {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
  };
}
