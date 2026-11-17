"use client";

import { useEffect, useRef, useState } from "react";

export function QrUpload({ value, onChange, onBusy, disabled }: { value: string; onChange: (url: string) => void; onBusy: (busy: boolean) => void; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const busyCallback = useRef(onBusy);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { busyCallback.current = onBusy; }, [onBusy]);
  useEffect(() => () => { if (request.current) { request.current.abort(); busyCallback.current(false); } }, []);

  async function upload(files: File[]) {
    if (disabled || request.current || !files.length) return;
    if (files.length !== 1 || !/^image\/(png|jpeg|webp|gif|avif)$/.test(files[0].type) || files[0].size > 10 * 1024 * 1024) {
      setMessage("请一次选择一张 10 MB 以内的 JPG、PNG、WebP、GIF 或 AVIF 图片"); return;
    }
    const controller = new AbortController(); request.current = controller;
    setBusy(true); onBusy(true); setMessage("正在上传二维码…");
    try {
      const response = await fetch("/api/uploads?purpose=qr", { method: "POST", headers: { "Content-Type": files[0].type }, body: files[0], signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "上传失败，请重试");
      if (!controller.signal.aborted) { onChange(result.url); setMessage("二维码已上传，保存打赏页后公开显示"); }
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "上传失败，请重试");
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false); onBusy(false); }
    }
  }

  return <div role="group" aria-label="二维码上传" tabIndex={0} className="space-y-3 rounded-xl surface-canvas p-4 focus-visible:outline-2 focus-visible:outline-offset-2"
    onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
    onDrop={event => { if (event.dataTransfer.files.length) { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)); } }}
    onPaste={event => {
      const files = Array.from(event.clipboardData.items).filter(item => item.kind === "file").map(item => item.getAsFile()).filter((file): file is File => Boolean(file));
      if (files.length) { event.preventDefault(); void upload(files); }
    }}>
    {value && <div className="flex flex-wrap items-start gap-3">
      <a href={value} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white p-2" aria-label="查看二维码原图">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="二维码预览" className="h-32 w-32 object-contain" />
      </a>
      <button type="button" disabled={busy} onClick={() => { onChange(""); setMessage(""); }} className="text-xs ink-secondary hover:ink-primary cursor-pointer">移除二维码</button>
    </div>}
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="hidden" aria-label="选择二维码图片" onChange={event => { void upload(Array.from(event.target.files || [])); event.target.value = ""; }} />
    <button type="button" disabled={busy} onClick={() => input.current?.click()} className="rounded-lg surface-block px-3 py-2 text-xs ink-primary cursor-pointer disabled:opacity-50">{busy ? "上传中…" : value ? "更换二维码" : "上传二维码"}</button>
    <p className="text-xs leading-relaxed ink-muted">可拖入图片，或点击此区域后粘贴截图 · 最大 10 MB · 保留清晰度</p>
    <p role="status" className="text-xs ink-secondary">{message}</p>
  </div>;
}
