"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { SupportView } from "@/components/SupportView";
import type { SupportChannel, Supporter, SupportSettings } from "@/lib/support";
import { QrUpload } from "./QrUpload";

const inputClass = "mt-1.5 w-full rounded-xl surface-canvas px-3 py-2.5 text-sm ink-primary";
const buttonClass = "rounded-lg surface-canvas px-3 py-2 text-xs ink-primary cursor-pointer disabled:opacity-40";

function RowActions({ label, first, last, move, remove }: { label: string; first: boolean; last: boolean; move: (direction: number) => void; remove: () => void }) {
  return <div className="flex shrink-0 gap-1">
    <button type="button" className={buttonClass} disabled={first} onClick={() => move(-1)} aria-label={`上移${label}`}><ArrowUp className="h-3.5 w-3.5" /></button>
    <button type="button" className={buttonClass} disabled={last} onClick={() => move(1)} aria-label={`下移${label}`}><ArrowDown className="h-3.5 w-3.5" /></button>
    <button type="button" className={buttonClass} onClick={remove} aria-label={`删除${label}`}><Trash2 className="h-3.5 w-3.5" /></button>
  </div>;
}

export function SupportPanel() {
  const [form, setForm] = useState<SupportSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = saving || uploading || loading;

  const load = useCallback((signal?: AbortSignal) => fetch("/api/support?all=1", { signal })
    .then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "加载失败，请重试");
      return result as SupportSettings;
    }).then(result => {
      if (!signal?.aborted) { setForm(result); setDirty(false); setMessage(""); }
    }).catch(failure => {
      if (!signal?.aborted) setError(failure instanceof Error ? failure.message : "加载失败，请重试");
    }).finally(() => { if (!signal?.aborted) setLoading(false); }), []);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  useEffect(() => {
    if (!dirty && !uploading) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, uploading]);

  function change(update: (current: SupportSettings) => SupportSettings) {
    setForm(current => current ? update(current) : current); setDirty(true); setMessage(""); setError("");
  }
  function updateChannel(id: string, patch: Partial<SupportChannel>) {
    change(current => ({ ...current, channels: current.channels.map(channel => channel.id === id ? { ...channel, ...patch } : channel) }));
  }
  function updateSupporter(id: string, patch: Partial<Supporter>) {
    change(current => ({ ...current, supporters: current.supporters.map(supporter => supporter.id === id ? { ...supporter, ...patch } : supporter) }));
  }
  function move(key: "channels" | "supporters", index: number, direction: number) {
    change(current => {
      const items = [...current[key]];
      const target = index + direction;
      if (target < 0 || target >= items.length) return current;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...current, [key]: items };
    });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!form || busy) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/support", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败，请重试");
      setForm(result); setDirty(false); setMessage("打赏页已保存并公开生效");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "网络异常，修改已保留，请重试"); }
    finally { setSaving(false); }
  }

  return <section className="space-y-6" aria-label="打赏管理">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold ink-primary">打赏与鸣谢</h2><p className="mt-1 text-xs ink-muted">Buy me a coffee · 保存后公开显示在打赏页</p></div>
      <div className="flex flex-wrap gap-2">
        <a href="/support" target="_blank" rel="noopener noreferrer" className={buttonClass}>查看已发布页面 ↗</a>
        <button type="button" disabled={busy} className={buttonClass} onClick={() => { if (!dirty || window.confirm("放弃尚未保存的修改，重新加载已发布内容？")) { setLoading(true); setError(""); void load(); } }}>重新加载</button>
        <button type="button" disabled={busy || !form} className={buttonClass} onClick={() => setPreview(value => !value)}>{preview ? "继续编辑" : "预览修改"}</button>
      </div>
    </div>
    {error && <p role="alert" className="rounded-xl surface-block p-4 text-sm ink-primary">{error}</p>}
    {loading && <p role="status" className="text-sm ink-muted">正在加载打赏配置…</p>}
    {form && <form onSubmit={save}>
      <div hidden={!preview} className="mx-auto mb-8 max-w-[652px] rounded-2xl surface-canvas p-6"><SupportView content={form} /></div>
      <fieldset disabled={busy || preview} hidden={preview} className="space-y-6 disabled:opacity-70">
        <section className="space-y-5 rounded-2xl surface-block p-5 sm:p-6">
          <h3 className="text-sm font-semibold ink-primary">缘由与宣言</h3>
          {([
            ["reason", "赞助缘由", "为什么想接受赞助？这些支持将帮助你做些什么？"],
            ["declaration", "赞助宣言", "说明你的创作理念、赞助原则或对读者的承诺。"],
            ["thanks", "感谢语", "写给所有支持者的话，将显示在赞助者名单上方。"],
          ] as const).map(([key, label, placeholder]) => <label key={key} className="block text-xs ink-secondary">{label} <span className="ink-muted">· 支持 Markdown · 可留空</span>
            <textarea value={form[key]} onChange={event => change(current => ({ ...current, [key]: event.target.value }))} rows={key === "reason" ? 5 : 3} maxLength={20000} placeholder={placeholder} className={inputClass + " resize-y leading-relaxed"} />
          </label>)}
        </section>

        <section className="space-y-4 rounded-2xl surface-block p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold ink-primary">赞助方式 <span className="ink-muted">({form.channels.length}/12)</span></h3>
            <button type="button" disabled={form.channels.length >= 12} className={buttonClass} onClick={() => change(current => ({ ...current, channels: [...current.channels, { id: crypto.randomUUID(), name: "", url: "", qrUrl: "", description: "" }] }))}>添加赞助方式</button>
          </div>
          <p className="text-xs leading-relaxed ink-muted">爱发电、Ko-fi 或其他平台均可。每项需填写链接或上传二维码，按列表顺序展示。</p>
          {form.channels.map((channel, index) => <div key={channel.id} className="space-y-4 rounded-xl surface-block-strong p-4">
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium ink-primary">方式 {index + 1}</span><RowActions label={`赞助方式 ${index + 1}`} first={index === 0} last={index === form.channels.length - 1} move={direction => move("channels", index, direction)} remove={() => change(current => ({ ...current, channels: current.channels.filter(item => item.id !== channel.id) }))} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs ink-secondary">平台名称<input required maxLength={80} value={channel.name} placeholder="例如：爱发电 / Ko-fi" onChange={event => updateChannel(channel.id, { name: event.target.value })} className={inputClass} /></label>
              <label className="text-xs ink-secondary">平台链接（可选）<input type="url" maxLength={2048} value={channel.url} placeholder="https://…" onChange={event => updateChannel(channel.id, { url: event.target.value })} className={inputClass} /></label>
            </div>
            <label className="block text-xs ink-secondary">简短说明（可选）<input value={channel.description} maxLength={500} onChange={event => updateChannel(channel.id, { description: event.target.value })} className={inputClass} placeholder="例如：请我喝杯咖啡，支持持续创作。" /></label>
            <QrUpload value={channel.qrUrl} onChange={url => updateChannel(channel.id, { qrUrl: url })} onBusy={setUploading} disabled={busy} />
          </div>)}
        </section>

        <section className="space-y-4 rounded-2xl surface-block p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold ink-primary">赞助者名单 <span className="ink-muted">({form.supporters.length})</span></h3>
            <button type="button" disabled={form.supporters.length >= 500} className={buttonClass} onClick={() => change(current => ({ ...current, supporters: [...current.supporters, { id: crypto.randomUUID(), name: "", url: "", date: "", amount: "", message: "" }] }))}>添加赞助者</button>
          </div>
          <p className="text-xs leading-relaxed ink-muted">手动记录并排序。以下内容会公开展示；仅昵称必填，匿名支持可填写「匿名读者」。</p>
          {form.supporters.map((supporter, index) => <div key={supporter.id} className="space-y-4 rounded-xl surface-block-strong p-4">
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium ink-primary">赞助者 {index + 1}</span><RowActions label={`赞助者 ${index + 1}`} first={index === 0} last={index === form.supporters.length - 1} move={direction => move("supporters", index, direction)} remove={() => change(current => ({ ...current, supporters: current.supporters.filter(item => item.id !== supporter.id) }))} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs ink-secondary">昵称<input required maxLength={100} value={supporter.name} onChange={event => updateSupporter(supporter.id, { name: event.target.value })} className={inputClass} /></label>
              <label className="text-xs ink-secondary">主页（可选）<input type="url" maxLength={2048} value={supporter.url} placeholder="https://…" onChange={event => updateSupporter(supporter.id, { url: event.target.value })} className={inputClass} /></label>
              <label className="text-xs ink-secondary">赞助日期（可选）<input type="date" value={supporter.date} onChange={event => updateSupporter(supporter.id, { date: event.target.value })} className={inputClass} /></label>
              <label className="text-xs ink-secondary">金额或礼物（可选）<input maxLength={80} value={supporter.amount} placeholder="例如：¥20 / 一杯咖啡" onChange={event => updateSupporter(supporter.id, { amount: event.target.value })} className={inputClass} /></label>
            </div>
            <label className="block text-xs ink-secondary">单独致谢（可选）<textarea rows={2} maxLength={1000} value={supporter.message} onChange={event => updateSupporter(supporter.id, { message: event.target.value })} className={inputClass} /></label>
          </div>)}
        </section>
      </fieldset>
      <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl surface-elevated p-4 shadow-sm">
        <p role="status" className="text-xs ink-secondary">{uploading ? "正在上传二维码，请稍候…" : message || (dirty ? "有未保存的修改" : "所有修改已保存")}</p>
        <button type="submit" disabled={busy || !dirty} className="rounded-xl surface-invert px-5 py-2.5 text-sm font-medium cursor-pointer disabled:opacity-50">{saving ? "正在保存…" : "保存打赏页"}</button>
      </div>
    </form>}
  </section>;
}
