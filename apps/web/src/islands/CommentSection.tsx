import { useEffect, useState, type FormEvent } from "react";
import { api, type CommentNode } from "../lib/api";

/** 评论区（docs/05-site-web.md §2.3）：昵称+邮箱，单层回复，提交后"晾干中" */
export function CommentSection({ slug }: { slug: string }) {
  const [comments, setComments] = useState<CommentNode[] | null>(null);
  const [replyTo, setReplyTo] = useState<CommentNode | null>(null);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    api
      .comments(slug)
      .then((r) => setComments(r.comments))
      .catch(() => setOffline(true));
  }, [slug]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setSending(true);
    setNotice("");
    try {
      const r = await api.submitComment(slug, {
        authorName: String(data.get("name") ?? ""),
        authorEmail: String(data.get("email") ?? ""),
        authorSite: String(data.get("site") ?? "") || undefined,
        body: String(data.get("body") ?? ""),
        parentId: replyTo?.id ?? null,
        notify: data.get("notify") === "on",
        website2: String(data.get("website2") ?? ""),
      });
      setNotice(r.message);
      form.reset();
      setReplyTo(null);
      if (r.state === "ok") {
        const fresh = await api.comments(slug);
        setComments(fresh.comments);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "提交失败，稍后再试。");
    } finally {
      setSending(false);
    }
  }

  if (offline) {
    return <p className="comments-offline">评论窑炉暂时没生火（接口层未启动）。</p>;
  }

  return (
    <section className="comments" aria-label="评论区">
      <h2>评论 {comments && comments.length > 0 && `· ${comments.length}`}</h2>

      {comments === null && <p className="comments-loading">评论加载中……</p>}
      {comments?.length === 0 && <p className="comments-empty">还没有人捏过这块泥，来当第一个。</p>}

      <ul className="comment-list">
        {comments?.map((c) => (
          <li key={c.id} className="clay-card comment">
            <CommentBody c={c} onReply={() => setReplyTo(c)} />
            {c.replies && c.replies.length > 0 && (
              <ul className="reply-list">
                {c.replies.map((r) => (
                  <li key={r.id} className="comment reply">
                    <CommentBody c={r} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <form className="clay-card comment-form" onSubmit={submit}>
        <h3>{replyTo ? `回复 @${replyTo.authorName}` : "留下一块泥"}</h3>
        {replyTo && (
          <button type="button" className="clay-btn cancel-reply" data-variant="ghost" onClick={() => setReplyTo(null)}>
            取消回复
          </button>
        )}
        <div className="form-row">
          <input className="clay-input" name="name" required maxLength={24} placeholder="昵称 *" aria-label="昵称" />
          <input className="clay-input" name="email" required type="email" placeholder="邮箱 *（不公开）" aria-label="邮箱" />
        </div>
        <input className="clay-input" name="site" type="url" placeholder="主页（可选）" aria-label="主页" />
        {/* 蜜罐：对人类隐藏 */}
        <input className="hp" name="website2" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <textarea
          className="clay-textarea"
          name="body"
          required
          minLength={2}
          maxLength={2000}
          placeholder="说点什么……支持 Markdown"
          aria-label="评论内容"
        />
        <label className="notify">
          <input type="checkbox" name="notify" /> 被回复时邮件通知我
        </label>
        <button className="clay-btn" data-variant="primary" type="submit" disabled={sending}>
          {sending ? "晾着……" : "提交"}
        </button>
        {notice && <p className="notice" role="status">{notice}</p>}
      </form>
    </section>
  );
}

function CommentBody({ c, onReply }: { c: CommentNode; onReply?: () => void }) {
  const date = new Date(c.createdAt).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <div>
      <p className="comment-head">
        {c.authorSite ? (
          <a href={c.authorSite} target="_blank" rel="noopener noreferrer nofollow">
            {c.authorName}
          </a>
        ) : (
          <strong>{c.authorName}</strong>
        )}
        <time>{date}</time>
      </p>
      {/* M3 暂以纯文本渲染；Markdown 安全渲染（白名单）在 M4 与 admin 一起做 */}
      <p className="comment-body">{c.bodyMd}</p>
      {onReply && (
        <button type="button" className="reply-btn" onClick={onReply}>
          回复
        </button>
      )}
    </div>
  );
}
