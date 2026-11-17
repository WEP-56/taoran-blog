"use client";
import React, { useEffect, useRef, useState } from "react";

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  value: string;
  onValue: (update: (previous: string) => string) => void;
  onImage?: (url: string) => void;
  onBusy: (busy: boolean) => void;
};

export function ImageTextarea({ value, onValue, onImage, onBusy, ...props }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const busyCallback = useRef(onBusy);
  useEffect(() => { busyCallback.current = onBusy; }, [onBusy]);
  const cancelInsertion = useRef<(() => void) | null>(null);
  useEffect(() => () => { controller.current?.abort(); cancelInsertion.current?.(); busyCallback.current(false); }, []);

  async function upload(files: File[]) {
    if (controller.current || !files.length) return;
    if (files.some(f => !/^image\/(png|jpeg|webp|gif|avif)$/.test(f.type) || f.size > 10 * 1024 * 1024)) {
      setMessage("请选择 10 MB 以内的 JPG、PNG、WebP、GIF 或 AVIF 图片"); return;
    }
    if (files.length > (onImage ? 1 : 10)) { setMessage(onImage ? "每条动态可配一张图片，请一次选择一张" : "一次最多上传 10 张图片"); return; }
    const start = textarea.current?.selectionStart ?? value.length;
    const end = textarea.current?.selectionEnd ?? start;
    // A unique placeholder follows the insertion position even if surrounding text is edited.
    const marker = `<!-- image-upload-${crypto.randomUUID()} -->`;
    if (!onImage) onValue(previous => previous.slice(0, start) + marker + previous.slice(end));
    cancelInsertion.current = !onImage ? () => onValue(previous => previous.replace(marker, value.slice(start, end))) : null;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); onBusy(true); setMessage("正在上传图片…");
    const snippets: string[] = [];
    try {
      for (const file of files) {
        const response = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": file.type }, body: file, signal: abort.signal });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "上传失败，请重新登录或稍后重试");
        if (abort.signal.aborted) return;
        if (onImage) onImage(result.url);
        else snippets.push(`![](${result.url})`);
      }
      setMessage("图片已上传，保存后会显示在正文中");
    } catch (error) {
      if (!abort.signal.aborted) setMessage(error instanceof Error ? error.message : "上传失败，请重试");
    } finally {
      if (!abort.signal.aborted) {
        if (!onImage) onValue(previous => previous.replace(marker, snippets.length ? `\n\n${snippets.join("\n\n")}\n\n` : value.slice(start, end)));
        setBusy(false); onBusy(false); controller.current = null; cancelInsertion.current = null;
      }
    }
  }

  return <div onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
    onDrop={event => { if (event.dataTransfer.files.length) { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)); } }}>
    <textarea {...props} ref={textarea} value={value} readOnly={busy || props.readOnly}
      onChange={event => { const text = event.target.value; onValue(() => text); }}
      onPaste={event => {
        const files = Array.from(event.clipboardData.items).filter(item => item.kind === "file").map(item => item.getAsFile()).filter((file): file is File => Boolean(file));
        if (files.length) { event.preventDefault(); void upload(files); }
      }} />
    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs ink-muted">
      <input ref={picker} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" multiple={!onImage} className="hidden" aria-label="选择图片"
        onChange={event => { void upload(Array.from(event.target.files || [])); event.target.value = ""; }} />
      <button type="button" disabled={busy} onClick={() => picker.current?.click()} className="rounded-lg surface-canvas px-3 py-1.5 ink-primary cursor-pointer disabled:opacity-50">{busy ? "上传中…" : "添加图片"}</button>
      <span>拖入图片或粘贴截图 · 单张 ≤ 10 MB · 动图取首帧</span>
      <span role="status" aria-live="polite">{message}</span>
    </div>
  </div>;
}
