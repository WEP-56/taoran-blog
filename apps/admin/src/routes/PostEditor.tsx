import { useEffect, useRef, useState } from "react";
import { api, type PostDetail } from "../lib/api";
import { navigate } from "../lib/router";
import { MarkdownEditor } from "../editor/MarkdownEditor";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function emptyPost(): PostDetail {
  return {
    frontmatter: {
      title: "",
      slug: "",
      date: new Date().toISOString(),
      tags: [],
      status: "draft",
      publishAt: null,
      pinned: false,
      toc: true,
      comments: true,
      aliases: [],
    },
    body: "",
  };
}

export function PostEditor({ slug }: { slug: string | null }) {
  const [post, setPost] = useState<PostDetail | null>(slug ? null : emptyPost());
  const [tagText, setTagText] = useState("");
  const [saved, setSaved] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const isNew = useRef(slug === null);

  useEffect(() => {
    if (!slug) {
      setTagText("");
      return;
    }
    api
      .post(slug)
      .then((next) => {
        setPost(next);
        setTagText(next.frontmatter.tags.join(", "));
      })
      .catch((e) => setError(e.message));
  }, [slug]);

  // 离开未保存拦截（docs/06-site-admin.md §3.2）
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (!saved) e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [saved]);

  if (error) return <p className="error">{error}</p>;
  if (!post) return <p>加载中……</p>;

  const fm = post.frontmatter;
  const patch = (p: Partial<PostDetail["frontmatter"]>) => {
    setPost((current) =>
      current ? { ...current, frontmatter: { ...current.frontmatter, ...p } } : current,
    );
    setSaved(false);
  };

  async function save(statusOverride?: "draft" | "published") {
    if (!post) return;
    const finalFm = { ...fm, ...(statusOverride ? { status: statusOverride } : {}) };
    if (!finalFm.title.trim()) return setNotice("先起个标题");
    if (!SLUG_RE.test(finalFm.slug)) return setNotice("slug 只能是小写字母、数字和连字符");
    try {
      const r = await api.savePost(finalFm.slug, { frontmatter: finalFm, body: post.body });
      setPost({ ...post, frontmatter: finalFm });
      setSaved(true);
      isNew.current = false;
      setNotice(r.rebuild ? "已保存，主站重建已排队（约 10s 后开始）" : "已保存（草稿不触发重建）");
      if (slug === null) navigate(`/posts/edit/${finalFm.slug}`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "保存失败");
    }
  }

  return (
    <div className="editor-page">
      <div className="editor-main">
        <input
          className="clay-input title-input"
          value={fm.title}
          placeholder="文章标题"
          onChange={(e) => {
            patch({ title: e.target.value });
          }}
        />
        <MarkdownEditor
          value={post.body}
          onChange={(body) => {
            setPost((p) => (p ? { ...p, body } : p));
            setSaved(false);
          }}
          onUploadImage={
            isNew.current
              ? undefined // 新文章先保存一次才有落图目录
              : async (file) => (await api.upload(fm.slug, file)).markdown
          }
        />
        {isNew.current && <p className="muted">提示：先保存一次草稿，才能上传图片（图片落在文章目录里）。</p>}
      </div>

      <aside className="editor-side">
        <div className="clay-card side-card">
          <label>
            slug（发布后不可改）
            <input
              className="clay-input"
              value={fm.slug}
              disabled={!isNew.current && fm.status === "published"}
              onChange={(e) =>
                patch({
                  slug: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]+/g, "-")
                    .replace(/^-+/, "")
                    .replace(/-{2,}/g, "-"),
                })
              }
              placeholder="my-first-post"
            />
          </label>
          <label>
            摘要
            <textarea
              className="clay-textarea"
              value={fm.summary ?? ""}
              maxLength={300}
              onChange={(e) => patch({ summary: e.target.value })}
            />
          </label>
          <label>
            标签（逗号分隔）
            <input
              className="clay-input"
              value={tagText}
              onChange={(e) => {
                const next = e.target.value;
                setTagText(next);
                patch({ tags: next.split(/[,，]/).map((t) => t.trim()).filter(Boolean).slice(0, 8) });
              }}
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={fm.pinned} onChange={(e) => patch({ pinned: e.target.checked })} /> 置顶
          </label>
          <label className="check">
            <input type="checkbox" checked={fm.comments} onChange={(e) => patch({ comments: e.target.checked })} /> 开放评论
          </label>
        </div>

        <div className="clay-card side-card actions">
          <p className="muted">
            状态：<b>{fm.status === "published" ? "已发布" : "草稿"}</b>
            {saved ? " · 已保存" : " · 泥还湿着（未保存）"}
          </p>
          <button className="clay-btn" data-variant="soft" onClick={() => save("draft")}>
            存草稿
          </button>
          <button className="clay-btn" data-variant="primary" onClick={() => save("published")}>
            {fm.status === "published" ? "保存并重建" : "发布"}
          </button>
          {fm.status === "published" && (
            <button className="clay-btn" data-variant="ghost" onClick={() => save("draft")}>
              转回草稿（下线）
            </button>
          )}
          {notice && <p className="notice" role="status">{notice}</p>}
        </div>
      </aside>
    </div>
  );
}
