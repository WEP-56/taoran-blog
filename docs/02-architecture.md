# 02 · 系统架构与目录结构

## 1. 系统架构图

```
                        读者                                作者（你）
                          │                                    │
                          ▼                                    ▼
                ┌──────────────────┐                ┌──────────────────────┐
                │   Caddy (HTTPS)  │                │  admin.example.com   │
                │  example.com     │                │  （Caddy 同实例反代） │
                └───┬──────────┬───┘                └──────────┬───────────┘
                    │          │                               │
        静态资源     │          │ /api/*                        │ /api/admin/*
                    ▼          ▼                               ▼
        ┌─────────────┐   ┌──────────────────────────────────────────┐
        │ apps/web    │   │ apps/server (Hono, Node)                 │
        │ 构建产物     │   │  ├─ public api：评论/点赞/浏览量/动态      │
        │ dist/ 静态   │   │  ├─ admin api：内容 CRUD/上传/统计/设置    │
        └─────────────┘   │  ├─ 内容写入：content/ 下的 MDX + 图片     │
              ▲           │  ├─ 构建触发：增量重建 apps/web            │
              │  重建      │  └─ Drizzle ←→ data/taoran.db (SQLite)   │
              └───────────┴──────────────────────────────────────────┘
```

三个运行单元，职责互不越界：

| 单元 | 形态 | 职责 | 不负责 |
| --- | --- | --- | --- |
| `apps/web` | Astro 静态产物 + 少量岛屿 JS | 一切读者可见页面 | 任何写操作 |
| `apps/admin` | 纯静态 SPA | 写作与管理界面 | 直接碰文件/DB（一律走 server） |
| `apps/server` | 常驻 Node 进程 | 动态 API、内容落盘、触发重建、鉴权 | 渲染 HTML |

## 2. 仓库目录结构（规划）

```
taoran-blog/
├── README.md
├── docs/                          # 本套文档
├── package.json                   # pnpm workspace 根
├── pnpm-workspace.yaml
├── turbo.json
├── .env.example
│
├── apps/
│   ├── web/                       # 主站（Astro 5）
│   │   ├── astro.config.ts
│   │   ├── src/
│   │   │   ├── pages/             # 路由（见 05-site-web.md 站点地图）
│   │   │   │   ├── index.astro
│   │   │   │   ├── posts/[...slug].astro
│   │   │   │   ├── archive.astro
│   │   │   │   ├── tags/[tag].astro
│   │   │   │   ├── moments.astro
│   │   │   │   ├── friends.astro
│   │   │   │   ├── about.astro
│   │   │   │   ├── lab/           # 实验室 playground
│   │   │   │   ├── 404.astro
│   │   │   │   ├── rss.xml.ts
│   │   │   │   └── og/[slug].png.ts   # 自动 OG 图
│   │   │   ├── layouts/
│   │   │   ├── components/        # Astro 静态组件（页眉/页脚/文章排版）
│   │   │   ├── islands/           # React 岛屿（动效/3D/评论等交互件）
│   │   │   │   ├── ClayHero/      # 首页 WebGPU 主视觉
│   │   │   │   ├── CommentSection/
│   │   │   │   ├── LikeButton/    # "捏一下"
│   │   │   │   ├── ThemeToggle/
│   │   │   │   └── ...
│   │   │   ├── styles/            # 全局样式 + token 注入
│   │   │   └── lib/               # 客户端工具（api client、能力检测）
│   │   └── public/                # 字体分片、favicon、降级静态图
│   │
│   ├── admin/                     # 管理站（Vite + React SPA）
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── routes/            # TanStack Router 文件路由
│   │       │   ├── dashboard/
│   │       │   ├── posts/         # 列表 + 编辑器
│   │       │   ├── moments/
│   │       │   ├── comments/
│   │       │   ├── friends/
│   │       │   ├── assets/
│   │       │   └── settings/
│   │       ├── editor/            # TipTap 定制（粘土风菜单、MD 双模）
│   │       ├── components/
│   │       └── lib/               # api client、auth guard
│   │
│   └── server/                    # 接口层（Hono）
│       └── src/
│           ├── index.ts           # 入口 + 中间件（CORS/限流/session）
│           ├── routes/
│           │   ├── public/        # comments / reactions / views / moments
│           │   └── admin/         # posts / uploads / stats / settings / backup / rebuild
│           ├── auth/              # Argon2 口令 + WebAuthn + session
│           ├── content/           # MDX 读写、frontmatter 校验、slug 管理
│           ├── images/            # Sharp 管线（webp/avif/lqip）
│           ├── db/                # Drizzle schema 与迁移（表见 07-data.md）
│           └── jobs/              # 重建队列、定时发布、备份
│
├── packages/
│   ├── ui/                        # 粘土组件库（web 岛屿与 admin 共用）
│   │   └── src/                   #   Clay* 组件 + tokens.css（见 03-design-system.md）
│   ├── clay-engine/               # WebGPU 粘土引擎（见 08-webgpu.md）
│   │   └── src/
│   │       ├── materials/         # TSL 粘土材质（SSS 近似、指纹法线）
│   │       ├── deform/            # 按压/雕刻形变（compute + CPU 回退）
│   │       ├── scenes/            # hero / 404 / playground 场景
│   │       └── capability.ts     # WebGPU→WebGL→静态 检测分级
│   ├── content/                   # Zod schema：frontmatter / API DTO 共享
│   └── config/                    # 共享 tsconfig / eslint / prettier
│
├── content/                       # ★ 内容资产（git 管理，server 可写）
│   ├── posts/
│   │   └── 2026/
│   │       └── hello-clay/
│   │           ├── index.mdx
│   │           └── cover.jpg      # 原图；派生图在 data/cache
│   ├── moments/                   # 动态，按月 jsonl 或 mdx
│   ├── pages/                     # about / friends 等单页内容
│   └── site.json                  # 站点级设置的文件快照
│
├── data/                          # ★ 运行时数据（不进 git，进备份）
│   ├── taoran.db                  # SQLite
│   ├── uploads/                   # 上传原图
│   └── cache/                     # Sharp 派生图、OG 图缓存
│
└── deploy/
    ├── docker-compose.yml         # caddy + server（web 产物挂卷）
    ├── Caddyfile
    └── backup.sh                  # cron：content/ + data/ 打包异地
```

## 3. 包依赖关系

```
apps/web ──────┬──▶ packages/ui ──▶ packages/config
apps/admin ────┤        │
               ├──▶ packages/content（schema 共享）◀── apps/server
apps/web ──────┴──▶ packages/clay-engine
```

规则：`apps/*` 互不引用；跨端共享一律下沉到 `packages/*`；`packages/*` 不依赖任何 app。

## 4. 内容流（发布一篇文章会发生什么）

```
admin 编辑器保存
  → POST /api/admin/posts/:slug          （Markdown + frontmatter + 图片引用）
  → server: Zod 校验 → 写 content/posts/.../index.mdx → 图片入 Sharp 管线
  → server: upsert SQLite posts 行（slug/状态/统计占位）
  → 状态为 published 时：jobs/rebuild 入队（防抖 30s，合并连续保存）
  → 执行 `turbo build --filter=web`（增量），产物原子切换软链 → Caddy 即刻生效
  → 重建完成后预热：请求新页面、刷新 Pagefind 索引、生成 OG 图
```

草稿不触发重建；admin 内预览由 server 端用同一条 MDX 管线即时渲染（不依赖主站构建）。

## 5. 环境变量清单（`.env.example`）

| 变量 | 用途 |
| --- | --- |
| `SITE_URL` / `ADMIN_URL` | 站点与管理站对外地址（CORS、RSS、OG 用） |
| `SERVER_PORT` | Hono 监听端口 |
| `DATABASE_PATH` | SQLite 文件路径（默认 `data/taoran.db`） |
| `CONTENT_DIR` / `DATA_DIR` | 内容与数据目录根 |
| `SESSION_SECRET` | session cookie 签名密钥 |
| `ADMIN_PASSWORD_HASH` | Argon2id 口令哈希（首次由 CLI 生成） |
| `RP_ID` / `RP_ORIGIN` | WebAuthn Relying Party 配置 |
| `REBUILD_CMD` | 重建命令（默认 turbo，留口子便于换 CI webhook） |

## 6. 部署拓扑

- **单 VPS + Docker Compose**：`caddy`（443，托管 web 静态产物 + 反代 `/api/*` 与 admin 子域）+ `server`（Node）。`content/`、`data/` 挂载为卷。
- 备份：`deploy/backup.sh` 每日 cron 打包 `content/ + data/` 上传对象存储；SQLite 用 `VACUUM INTO` 热备。
- 云端备选（记录在案不实施）：web → Vercel，server → Fly.io，SQLite → Turso。Drizzle 与静态产物均无锁定。
