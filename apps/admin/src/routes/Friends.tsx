import { useEffect, useState, type FormEvent } from "react";
import { api, type FriendItem } from "../lib/api";

export function Friends() {
  const [friends, setFriends] = useState<FriendItem[] | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = () => api.friends().then((r) => setFriends(r.friends)).catch((e) => setError(e.message));
  useEffect(() => void load(), []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice("");
    const form = new FormData(e.currentTarget);
    await api.addFriend({
      name: String(form.get("name") ?? ""),
      url: String(form.get("url") ?? ""),
      avatar: String(form.get("avatar") ?? ""),
      desc: String(form.get("desc") ?? ""),
    });
    e.currentTarget.reset();
    setNotice("友链已保存，主站重建已排队。");
    load();
  }

  async function remove(url: string) {
    if (!confirm("删除这个友链？")) return;
    await api.deleteFriend(url);
    setNotice("友链已删除，主站重建已排队。");
    load();
  }

  if (error) return <p className="error">{error}</p>;

  return (
    <>
      <h1>友链</h1>
      <form className="clay-card form-card" onSubmit={submit}>
        <div className="form-grid">
          <label>
            名称
            <input className="clay-input" name="name" maxLength={40} required />
          </label>
          <label>
            地址
            <input className="clay-input" name="url" type="url" maxLength={200} required />
          </label>
        </div>
        <label>
          头像
          <input className="clay-input" name="avatar" type="url" maxLength={300} placeholder="https://example.com/avatar.png" />
        </label>
        <label>
          描述
          <input className="clay-input" name="desc" maxLength={120} required />
        </label>
        <button className="clay-btn" data-variant="primary" type="submit">添加友链</button>
        {notice && <p className="notice">{notice}</p>}
      </form>

      <div className="item-list">
        {!friends && <p>加载中……</p>}
        {friends?.map((f) => (
          <article className="clay-card list-item" key={f.url}>
            <p><b>{f.name}</b> <a href={f.url} target="_blank" rel="noopener noreferrer">打开</a></p>
            <p className="muted">{f.desc}</p>
            {f.avatar && <p className="muted">{f.avatar}</p>}
            <button className="clay-btn danger-btn" data-variant="ghost" onClick={() => remove(f.url)}>删除</button>
          </article>
        ))}
      </div>
    </>
  );
}
