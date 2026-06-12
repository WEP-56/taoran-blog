import { useEffect, useState } from "react";
import { api } from "./lib/api";
import { useHashRoute } from "./lib/router";
import { Comments } from "./routes/Comments";
import { Dashboard } from "./routes/Dashboard";
import { Friends } from "./routes/Friends";
import { Login } from "./routes/Login";
import { Moments } from "./routes/Moments";
import { Ops } from "./routes/Ops";
import { PostEditor } from "./routes/PostEditor";
import { PostsList } from "./routes/PostsList";

const NAV = [
  { href: "/dashboard", label: "仪表盘", icon: "📊" },
  { href: "/posts", label: "文章", icon: "📝" },
  { href: "/moments", label: "动态", icon: "◦" },
  { href: "/friends", label: "友链", icon: "↗" },
  { href: "/comments", label: "评论", icon: "💬" },
  { href: "/ops", label: "运维", icon: "🔧" },
];

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const route = useHashRoute();

  useEffect(() => {
    api.me().then(() => setAuthed(true)).catch(() => setAuthed(false));
    const onUnauthorized = () => setAuthed(false);
    window.addEventListener("taoran:unauthorized", onUnauthorized);
    return () => window.removeEventListener("taoran:unauthorized", onUnauthorized);
  }, []);

  if (authed === null) return <p className="boot">窑炉预热中……</p>;
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  const editorMatch = route.match(/^\/posts\/edit\/(.+)$/);

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#/dashboard">
          <img src="/favicon.svg" alt="" width="28" height="28" />
          陶然·后台
        </a>
        <nav>
          {NAV.map((item) => (
            <a key={item.href} href={`#${item.href}`} aria-current={route.startsWith(item.href) ? "page" : undefined}>
              <span aria-hidden="true">{item.icon}</span> {item.label}
            </a>
          ))}
        </nav>
        <button
          className="clay-btn logout"
          data-variant="ghost"
          type="button"
          onClick={() => api.logout().then(() => setAuthed(false))}
        >
          退出
        </button>
      </aside>

      <main className="content">
        {route.startsWith("/dashboard") && <Dashboard />}
        {route === "/posts" && <PostsList />}
        {route === "/posts/new" && <PostEditor slug={null} />}
        {editorMatch?.[1] && <PostEditor slug={editorMatch[1]} />}
        {route.startsWith("/moments") && <Moments />}
        {route.startsWith("/friends") && <Friends />}
        {route.startsWith("/comments") && <Comments />}
        {route.startsWith("/ops") && <Ops />}
      </main>
    </div>
  );
}
