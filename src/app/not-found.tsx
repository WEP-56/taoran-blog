import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="rounded-3xl surface-block px-10 py-12 max-w-md space-y-4">
        <div className="font-mono-num text-xs tracking-widest ink-muted">
          404 · EMPTY SPACE
        </div>
        <h1 className="font-editorial text-2xl font-semibold ink-primary">
          这片留白尚未落笔
        </h1>
        <p className="text-xs leading-relaxed ink-secondary">
          你寻访的页面可能已被归档或迁移至新的路径。
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="surface-invert inline-block rounded-xl px-5 py-2.5 text-xs font-medium"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
