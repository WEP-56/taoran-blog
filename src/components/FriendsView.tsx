"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { useSite } from "./SiteProvider";
import type { FriendLink } from "@/db/schema";

function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function FriendsView({ friends }: { friends: FriendLink[] }) {
  const { t } = useSite();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight ink-primary">
          {t("友好链接", "Friend Links")}
        </h1>
        <p className="mt-1.5 text-xs leading-relaxed ink-muted">
          {t(
            "有趣的人与站点，常来常往。若你的角落同样崇尚安静的写作，欢迎来信互换友链。",
            "Interesting minds and quiet corners of the web. If your site also values slow writing, we would love to exchange links."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {friends.map((friend) => (
          <a
            key={friend.id}
            href={friend.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-2xl surface-block p-5 transition-colors hover:surface-block-strong"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold ink-primary">
                {friend.name}
              </span>
              <ExternalLink className="h-3.5 w-3.5 ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            {friend.description && (
              <p className="mt-2 text-xs leading-relaxed ink-secondary">
                {friend.description}
              </p>
            )}

            <div className="mt-3 truncate font-mono-num text-[11px] ink-muted">
              {extractHost(friend.url)}
            </div>
          </a>
        ))}
      </div>

      {friends.length === 0 && (
        <div className="rounded-2xl surface-block p-8 text-center text-sm ink-muted">
          {t("暂无友链记录，可前往 Studio 后台添加。", "No friend links yet. Add some from the Studio.")}
        </div>
      )}
    </div>
  );
}
