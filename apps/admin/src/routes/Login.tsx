import { useState, type FormEvent } from "react";
import { api } from "../lib/api";

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="panel login" onSubmit={submit}>
        <img src="/favicon.svg" alt="" width="56" height="56" />
        <h1>陶然 · 后台</h1>
        <input
          className="clay-input"
          type="password"
          name="password"
          placeholder="口令"
          autoFocus
          required
          aria-label="口令"
        />
        <button className="clay-btn" data-variant="primary" type="submit" disabled={busy}>
          {busy ? "开窑中……" : "进窑"}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="hint">未配置口令时，开发默认 taoran-dev</p>
      </form>
    </div>
  );
}
