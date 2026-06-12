import { useEffect, useState, type FormEvent } from "react";
import { api, type MomentItem } from "../lib/api";

const localDateTime = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function Moments() {
  const [moments, setMoments] = useState<MomentItem[] | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = () => api.moments().then((r) => setMoments(r.moments)).catch((e) => setError(e.message));
  useEffect(() => void load(), []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice("");
    const form = new FormData(e.currentTarget);
    await api.addMoment({
      text: String(form.get("text") ?? ""),
      mood: String(form.get("mood") ?? ""),
      location: String(form.get("location") ?? ""),
      createdAt: new Date(String(form.get("createdAt") ?? "")).toISOString(),
    });
    e.currentTarget.reset();
    (e.currentTarget.elements.namedItem("createdAt") as HTMLInputElement).value = localDateTime();
    setNotice("动态已保存，主站重建已排队。");
    load();
  }

  async function remove(id: string) {
    if (!confirm("删除这条动态？")) return;
    await api.deleteMoment(id);
    setNotice("动态已删除，主站重建已排队。");
    load();
  }

  if (error) return <p className="error">{error}</p>;

  return (
    <>
      <h1>动态</h1>
      <form className="clay-card form-card" onSubmit={submit}>
        <label>
          内容
          <textarea className="clay-textarea" name="text" maxLength={2000} required />
        </label>
        <div className="form-grid">
          <label>
            心情
            <input className="clay-input" name="mood" maxLength={8} placeholder="🧱" />
          </label>
          <label>
            位置
            <input className="clay-input" name="location" maxLength={60} placeholder="书桌前" />
          </label>
          <label>
            时间
            <input className="clay-input" name="createdAt" type="datetime-local" defaultValue={localDateTime()} required />
          </label>
        </div>
        <button className="clay-btn" data-variant="primary" type="submit">发布动态</button>
        {notice && <p className="notice">{notice}</p>}
      </form>

      <div className="item-list">
        {!moments && <p>加载中……</p>}
        {moments?.map((m) => (
          <article className="clay-card list-item" key={m.id}>
            <p>{m.mood && <b>{m.mood} </b>}{m.text}</p>
            <p className="muted">{new Date(m.createdAt).toLocaleString("zh-CN")}{m.location ? ` · ${m.location}` : ""}</p>
            <button className="clay-btn danger-btn" data-variant="ghost" onClick={() => remove(m.id)}>删除</button>
          </article>
        ))}
      </div>
    </>
  );
}
