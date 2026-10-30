export type Role = { code: string; scope_department_id: string | null };
export type User = {
  id: string;
  username: string;
  full_name: string;
  department_id: string | null;
  must_change_password: boolean;
  roles: Role[];
  csrf_token: string;
};
export type Content = {
  id: string;
  code: string;
  kind: string;
  title: string;
  department_name: string | null;
  version_number: number;
  version_id: string;
  body: Record<string, string>;
  status: string;
  created_at: string;
};
export type ContentPage = {
  items: Content[];
  total: number;
  page: number;
  pageSize: number;
};
export type Dashboard = {
  documents: number;
  articles: number;
  incidents: number;
  learning: number;
  pending_approvals: number;
  processes: { id: string; code: string; name: string }[];
  featured: Content[];
};
export type Learning = {
  id: string;
  title: string;
  version_number: number;
  due_at: string | null;
  completed_at: string | null;
  completed_lessons: number;
  total_lessons: number;
};
export type Approval = {
  id: string;
  title: string;
  author: string;
  version_number: number;
  status: string;
  requested_at: string;
  body: Record<string, string>;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  csrf?: string,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      response.status,
      data.error?.message || "Không thể kết nối hệ thống. Vui lòng thử lại.",
    );
  return data as T;
}
