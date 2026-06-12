# 陶然 · Taoran

> 陶者，黏土也；陶然，乐也。

一个**粘土风格（Claymorphism）**的个人博客站：温暖、美观、实用，动效丰富，并以 WebGPU 模拟真实粘土物件作为技术展示。博客内容为主，炫技为辅。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [00-overview.md](docs/00-overview.md) | 愿景、设计关键词、功能总览、非目标 |
| [01-tech-stack.md](docs/01-tech-stack.md) | 技术选型与理由、备选方案、风险回退 |
| [02-architecture.md](docs/02-architecture.md) | 系统架构、目录结构、内容流、部署拓扑 |
| [03-design-system.md](docs/03-design-system.md) | 粘土风设计系统：色板、阴影、字体、组件 |
| [04-motion.md](docs/04-motion.md) | 动效设计：原则、令牌、动效清单、性能预算 |
| [05-site-web.md](docs/05-site-web.md) | 主站功能规格：信息架构与逐页规格 |
| [06-site-admin.md](docs/06-site-admin.md) | Admin 站规格：模块、编辑器、安全 |
| [07-data.md](docs/07-data.md) | 数据模型：MDX 内容层 + SQLite 动态层、内容管线 |
| [08-webgpu.md](docs/08-webgpu.md) | WebGPU 炫技模块：粘土渲染、交互、降级策略 |
| [09-roadmap.md](docs/09-roadmap.md) | 里程碑路线图、验收标准、风险表 |
| [10-ops-vps.md](docs/10-ops-vps.md) | VPS 运维：部署更新、Caddy/systemd、备份恢复、排障 |
| [11-admin-user-guide.md](docs/11-admin-user-guide.md) | 后台使用：登录、写作发布、评论审核、运维页 |

## 一图速览

```
┌────────────────────────── 陶然 Taoran (monorepo) ──────────────────────────┐
│                                                                            │
│  apps/web      Astro 5 + React 岛屿     主站：静态优先，动效丰富             │
│  apps/admin    Vite + React SPA         管理站：写作、审核、统计             │
│  apps/server   Hono + Drizzle/SQLite    接口层：动态数据 + 内容写入          │
│                                                                            │
│  packages/ui            粘土风组件库（web/admin 共用）                       │
│  packages/clay-engine   WebGPU 粘土渲染引擎（Three.js + TSL）                │
│  packages/content       内容 schema 与 MDX 管线                             │
│                                                                            │
│  content/      文章 MDX + 图片（git 管理，随时可迁移）                       │
│  data/         SQLite（评论/点赞/浏览量等动态数据）                          │
└────────────────────────────────────────────────────────────────────────────┘
```

## 状态

🧱 M0 地基完成：monorepo 可 `pnpm i && pnpm dev` 一键起三端，数据库迁移就绪。进度见 [09-roadmap.md](docs/09-roadmap.md)。

## 本地开发

```bash
pnpm install
pnpm dev          # 同时启动 web(4321) / admin(5173) / server(8787)
```

| 地址 | 说明 |
| --- | --- |
| http://localhost:4321 | 主站（M0 为设计令牌验证页） |
| http://localhost:5173 | Admin（M0 为骨架 + server 健康探测） |
| http://localhost:8787/api/health | 接口层健康检查 |

## 许可

内容 CC BY-NC-SA 4.0，代码 MIT（建库时落实）。
