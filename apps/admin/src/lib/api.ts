/** admin → server API 客户端：同源 /api（dev 由 vite 代理），写请求带防伪标头 */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "taoran-admin",
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event("taoran:unauthorized"));
    throw new Error("请先登录");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `请求失败（${res.status}）`);
  }
  return res.json() as Promise<T>;
}

export interface PostListItem {
  slug: string;
  title: string;
  date: string;
  status: "draft" | "published" | "scheduled";
  pinned: boolean;
  tags: string[];
  views: number;
  likes: number;
  comments: number;
}

export interface PostDetail {
  frontmatter: {
    title: string;
    slug: string;
    date: string;
    updated?: string;
    summary?: string;
    tags: string[];
    cover?: string;
    status: "draft" | "published" | "scheduled";
    publishAt: string | null;
    pinned: boolean;
    toc: boolean;
    comments: boolean;
    aliases: string[];
  };
  body: string;
}

export interface AdminComment {
  id: number;
  postSlug: string;
  parentId: number | null;
  authorName: string;
  authorSite: string | null;
  bodyMd: string;
  state: "pending" | "ok" | "spam" | "trash";
  createdAt: number;
}

export interface Overview {
  pv: { today: number; week: number; month: number };
  posts: { published: number; draft: number };
  likes: number;
  pendingComments: number;
  trend: Array<{ date: string; n: number }>;
}

export interface RebuildStatus {
  state: "idle" | "queued" | "building" | "ok" | "fail";
  queuedAt?: string;
  finishedAt?: string;
  log: string[];
}

export const api = {
  login: (password: string) => request<{ ok: true }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ ok: true }>("/auth/me"),

  posts: () => request<{ posts: PostListItem[] }>("/posts"),
  post: (slug: string) => request<PostDetail>(`/posts/${slug}`),
  savePost: (slug: string, data: PostDetail) =>
    request<{ ok: true; rebuild: boolean }>(`/posts/${slug}`, { method: "PUT", body: JSON.stringify(data) }),
  trashPost: (slug: string) => request<{ ok: true }>(`/posts/${slug}`, { method: "DELETE" }),

  upload: async (slug: string, file: File): Promise<{ file: string; markdown: string }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/admin/uploads/${slug}`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Requested-With": "taoran-admin" },
      body: form,
    });
    if (!res.ok) throw new Error("上传失败");
    return res.json();
  },

  comments: (state: string) => request<{ comments: AdminComment[]; counts: Record<string, number> }>(`/comments?state=${state}`),
  moderate: (id: number, state: string) =>
    request<{ ok: true }>(`/comments/${id}`, { method: "PATCH", body: JSON.stringify({ state }) }),

  overview: () => request<Overview>("/stats/overview"),
  rebuild: () => request<{ ok: true }>("/ops/rebuild", { method: "POST" }),
  rebuildStatus: () => request<RebuildStatus>("/ops/rebuild"),
};
