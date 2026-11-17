"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-2xl px-6 py-24 ink-primary"><h1 className="text-xl font-semibold">暂时无法加载</h1><p className="my-5 ink-secondary">请稍后重试。</p><button className="rounded-xl surface-block px-4 py-2 cursor-pointer" onClick={reset}>重新加载</button></main>;
}
