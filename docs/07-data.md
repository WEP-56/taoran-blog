# 07 · 数据模型与内容管线

## 1. 双层数据原则

| 层 | 载体 | 存什么 | 为什么 |
| --- | --- | --- | --- |
| 内容层 | `content/` 下的 MDX/JSON 文件，**进 git** | 文章、动态、单页、站点设置快照 | 可 diff、可迁移、编辑器友好，写作资产不被任何系统锁定 |
| 动态层 | `data/taoran.db`（SQLite，WAL），**不进 git、进备份** | 评论、点赞、浏览量、会话、审计 | 高频小写入，天然属于数据库 |

连接两层的键是 **slug**（目录名即 slug，全站唯一，发布后不可改；确需改用 `aliases` 字段做 301）。

## 2. 内容层

### 2.1 文章 frontmatter schema（Zod 定义于 `packages/content`）

```yaml
# content/posts/2026/hello-clay/index.mdx
---
title: 把博客捏成一团泥
slug: hello-clay            # 与目录名一致，server 写入时校验
date: 2026-06-11T10:00:00+08:00
updated: 2026-06-12T09:30:00+08:00   # 可选
summary: 为什么我用 WebGPU 给博客捏了个球。   # 空则取正文首段
tags: [设计, webgpu]
cover: ./cover.jpg          # 相对引用，构建期走图片管线
status: published           # draft | published | scheduled
publishAt: null             # scheduled 时生效
pinned: false
toc: true
comments: true
aliases: []                 # 旧 slug 列表 → 构建期生成 301/meta refresh
---
```

校验失败的文件**构建期硬报错**（宁可不构建，不可静默吞掉一篇文章）。

### 2.2 其他内容

- `content/moments/2026-06.jsonl`：每行一条 `{ id, text, images[], mood, location?, createdAt }`，按月分文件。
- `content/pages/*.mdx`：about、friends 页说明等单页。
- `content/site.json`：站点设置快照（真源在 DB `site` 表，server 保存设置时同步写出，构建只读文件 —— 构建过程不依赖 server 存活）。

## 3. MDX 内容管线（构建期，`packages/content` 提供，web 与 server 预览共用）

```
MDX 源
 → remark: gfm / 数学(可选) / 阅读时长 / 目录提取 / 中文排版修正(盘古之白)
 → 自定义容器: :::note / :::tip / :::warn → ClayCard 变体
 → rehype: 标题锚点 / 外链 target+rel / 图片处理(↓) / Shiki 陶土主题高亮
 → 图片: 原图 → Sharp → avif+webp+原格式 × [480,960,1600] + LQIP base64 → <picture>
 → 产物: HTML + { toc, readingMinutes, summary, plainText(给 Pagefind/OG) }
```

允许的 MDX 组件白名单：提示容器、折叠块、视频卡、对比滑块。**禁止任意 import**（admin 编辑器只暴露白名单，构建期再校验一次）。

## 4. 动态层（SQLite，Drizzle schema）

```
posts          slug PK · status · published_at · pinned
               likes_count · views_count · comments_count   ← 反范式计数，触发器/事务内维护
               （标题等展示字段不存：真源在 MDX）

comments       id PK · post_slug FK · parent_id? · author_name · author_email_hash
               author_site? · body_md · state(pending|ok|spam|trash)
               ip_hash · ua · notify(bool) · created_at
               索引: (post_slug, state, created_at)

reactions      id PK · post_slug FK · visitor_hash · created_at
               UNIQUE(post_slug, visitor_hash)              ← 一人一捏（可重复捏到上限 9 次：存 count）

views_daily    post_slug · date · count   PK(post_slug, date)   ← 只存日聚合，不存明细

moments_meta   id PK · likes_count                           ← 动态正文在文件层

friends        id PK · name · url · avatar · desc · sort · state(ok|lost) · checked_at

assets         id PK · path · width · height · bytes · format · lqip · created_at

site           key PK · value(json)                          ← 站点设置

sessions       id PK · expires_at · created_at · last_seen_at
webauthn_credentials  id PK · public_key · counter · transports
audit_log      id PK · action · detail(json) · ip_hash · created_at
```

**隐私约定**：不存明文 IP/邮箱 —— `ip_hash = sha256(ip + 日轮换盐)` 仅用于限流去重；邮箱存 sha256（Gravatar 需要 md5 时另算不落库明文）。访客标识 `visitor_hash` 由"匿名 cookie + ip_hash"组成，无指纹采集。

## 5. 公开 API（`/api/v1/*`，供主站岛屿）

```
GET  /posts/:slug/meta            { views, likes, commentsCount }
POST /posts/:slug/view            浏览上报（5s 停留后调用；同 visitor 当日去重）
POST /posts/:slug/like            捏一下（返回新计数；上限 9）
GET  /posts/:slug/comments        已通过评论树（分页）
POST /posts/:slug/comments        提交评论 → 进审核队列，返回"晾干中"状态
GET  /moments?cursor=             动态流（静态页兜底，此接口供加载更多）
```

写接口一律限流（评论 3 条/小时/visitor），蜜罐字段 + 提交耗时检测防 spam 机器人。

## 6. 备份与迁移

- **备份面 = `content/` + `data/`**，再无其他状态。`deploy/backup.sh` 每日打包上传对象存储，保留 30 份；SQLite 用 `VACUUM INTO` 产出一致性副本。
- **导出**：admin 一键 zip（[06-site-admin.md](06-site-admin.md) §3.8）。
- **迁移演练**：文档化"裸机 → docker compose up → 恢复两目录 → 重建"流程，目标 30 分钟内完整复活，写进 [09-roadmap.md](09-roadmap.md) M6 验收。
- **导入**：提供脚本把常见 Hexo/Hugo front-matter 转为本 schema（个人历史文章迁入用，一次性工具放 `scripts/`）。
