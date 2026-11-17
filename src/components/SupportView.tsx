"use client";

import { Coffee, ExternalLink } from "lucide-react";
import { useSite } from "./SiteProvider";
import { MarkdownBody } from "./MarkdownBody";
import type { SupportContent } from "@/lib/support";

export function SupportView({ content }: { content: SupportContent }) {
  const { t } = useSite();
  return <div className="space-y-10 break-words">
    <header>
      <div className="mb-4 inline-flex rounded-xl surface-block p-3 ink-secondary"><Coffee className="h-5 w-5" aria-hidden="true" /></div>
      <h1 className="text-xl font-semibold tracking-tight ink-primary">{t("请我喝杯咖啡", "Buy me a coffee")}</h1>
      <p className="mt-2 text-xs leading-relaxed ink-muted">{t("谢谢你，让这里的文字继续生长。", "Thank you for helping this little corner of the web grow.")}</p>
    </header>

    {content.reason && <section aria-label={t("赞助缘由", "Why support")}><MarkdownBody content={content.reason} /></section>}

    {content.channels.length > 0 ? <section aria-label={t("赞助方式", "Ways to support")} className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
      {content.channels.map(channel => <article key={channel.id} className="min-w-0 rounded-2xl surface-block p-5">
        <h2 className="text-sm font-semibold ink-primary">{channel.name}</h2>
        {channel.description && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed ink-secondary">{channel.description}</p>}
        {channel.qrUrl && <a href={channel.qrUrl} target="_blank" rel="noopener noreferrer" className="mx-auto mt-5 block w-fit max-w-full rounded-xl bg-white p-3" aria-label={t(`查看 ${channel.name} 二维码原图`, `Open ${channel.name} QR code`)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={channel.qrUrl} alt={`${channel.name} ${t("赞助二维码", "support QR code")}`} className="h-44 w-44 object-contain" loading="lazy" />
        </a>}
        {channel.url && <a href={channel.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex max-w-full items-center gap-2 rounded-lg surface-canvas px-3 py-2 text-xs font-medium ink-primary transition-opacity hover:opacity-70">
          <span className="break-all">{t("前往", "Visit")} {channel.name}</span><ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
        </a>}
      </article>)}
    </section> : <p className="rounded-2xl surface-block px-6 py-5 text-sm leading-relaxed ink-secondary">{t("赞助方式正在准备中。感谢你的阅读与陪伴。", "Support options are coming soon. Thank you for reading and being here.")}</p>}

    {content.declaration && <section className="rounded-2xl surface-block px-6 py-5">
      <h2 className="mb-3 text-sm font-semibold ink-primary">{t("关于赞助", "A note on support")}</h2>
      <MarkdownBody content={content.declaration} />
    </section>}

    <section className="space-y-5">
      <h2 className="text-base font-semibold ink-primary">{t("感谢每一份支持", "With gratitude")}</h2>
      {content.thanks && <MarkdownBody content={content.thanks} />}
      {content.supporters.length > 0 ? <ul className="space-y-2">
        {content.supporters.map(supporter => <li key={supporter.id} className="rounded-xl surface-block px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {supporter.url ? <a href={supporter.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium ink-primary hover:opacity-70">{supporter.name}<ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" /></a> : <span className="text-sm font-medium ink-primary">{supporter.name}</span>}
            {(supporter.date || supporter.amount) && <div className="flex flex-wrap items-center gap-3 text-xs ink-muted">
              {supporter.amount && <span>{supporter.amount}</span>}
              {supporter.date && <time dateTime={supporter.date} className="font-mono-num">{supporter.date}</time>}
            </div>}
          </div>
          {supporter.message && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed ink-secondary">{supporter.message}</p>}
        </li>)}
      </ul> : !content.thanks && <p className="text-sm leading-relaxed ink-secondary">{t("每一次阅读、分享与鼓励，都值得感谢。", "Every read, share, and word of encouragement means a lot.")}</p>}
    </section>
  </div>;
}
