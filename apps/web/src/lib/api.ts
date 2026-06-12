/** 主站 → server 的 API 客户端（公开接口，docs/07-data.md §5） */
const BASE = import.meta.env.PUBLIC_API_BASE ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `请求失败（${res.status}）`);
  }
  return res.json() as Promise<T>;
}

export interface PostMeta {
  views: number;
  likes: number;
  comments: number;
}

export interface CommentNode {
  id: number;
  parentId: number | null;
  authorName: string;
  authorEmailHash: string;
  authorSite: string | null;
  bodyMd: string;
  createdAt: string;
  replies?: CommentNode[];
}

export const api = {
  meta: (slug: string) => request<PostMeta>(`/posts/${slug}/meta`),
  reportView: (slug: string) => request<{ counted: boolean }>(`/posts/${slug}/view`, { method: "POST" }),
  like: (slug: string) =>
    request<{ likes: number; mine: number; maxed: boolean }>(`/posts/${slug}/like`, { method: "POST" }),
  comments: (slug: string) => request<{ comments: CommentNode[] }>(`/posts/${slug}/comments`),
  submitComment: (
    slug: string,
    input: {
      authorName: string;
      authorEmail: string;
      authorSite?: string;
      body: string;
      parentId: number | null;
      notify: boolean;
      website2?: string;
    },
  ) =>
    request<{ id: number; state: string; message: string }>(`/posts/${slug}/comments`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
