# 01 · 技术选型

## 1. 选型原则

1. **静态优先**：博客 95% 的流量是读文章，静态化 + CDN 永远是最快的。
2. **岛屿化交互**：动效与 3D 以"岛屿"形式按需水合，不为一个粘土球付出整站 SPA 的代价。
3. **单人可维护**：能用一个 SQLite 文件解决的不上 Postgres，能 Docker Compose 的不上 K8s。
4. **炫技有出口也有退路**：WebGPU 是亮点，但每个亮点必须有 WebGL / 静态降级（原则见 [00-overview.md](00-overview.md)）。

## 2. 选型总表

| 范畴 | 选择 | 理由 | 备选（为何不选） |
| --- | --- | --- | --- |
| Monorepo | pnpm workspaces + Turborepo | 三 app 三 package 共享代码，任务缓存 | Nx（更重，特性用不到） |
| 主站框架 | **Astro 5** | 内容站最优解：默认零 JS、Content Layer 管 MDX、岛屿水合、内建 View Transitions | Next.js（见 §3.1）、Nuxt |
| 岛屿 UI | React 19 | 生态最全（motion、TipTap、R3F 同源），admin 共享组件 | Svelte（与 admin 技术栈分裂） |
| 样式 | Tailwind CSS 4 + CSS 自定义属性 token | token 即 CSS 变量，主题切换零成本；v4 原生级联层 | vanilla-extract、UnoCSS |
| 微交互动效 | **motion**（原 Framer Motion） | spring 物理动画，"捏"的手感核心依赖 | react-spring |
| 滚动叙事 | GSAP + ScrollTrigger | 滚动驱动时间线无可替代 | 原生 scroll-timeline（兼容性补充用） |
| 平滑滚动 | Lenis | 轻、与 ScrollTrigger 配合成熟 | locomotive-scroll |
| 3D / WebGPU | **Three.js `WebGPURenderer` + TSL** | TSL 写一次着色器自动编译 WGSL/GLSL，天然双后端 = 免费降级链 | 裸 WebGPU API（炫但维护成本高，仅在实验室页留一个手写 WGSL 玩具）、Babylon |
| R3F 桥 | @react-three/fiber v9 | 岛屿内声明式管理场景 | 裸 three（hero 这类长生命周期场景可用） |
| 物理 | Rapier (`@dimforge/rapier3d-compat`) | WASM、快、可休眠，404 碎裂/贴纸拖拽用 | cannon-es |
| Admin 框架 | Vite + React 19 + TanStack Router/Query | 纯 SPA 即可，路由/请求缓存声明式 | Next.js（不需要 SSR 的后台） |
| 富文本编辑 | TipTap 3 | ProseMirror 系，Markdown 双向、图片粘贴、可定制粘土风 UI | Milkdown、CodeMirror（保留为源码模式内核） |
| 接口层 | **Hono**（Node 运行时） | 轻、快、TS 一等公民，中间件够用 | Express（老）、tRPC（admin 是唯一前端时收益有限，REST 更通用） |
| ORM / DB | Drizzle + **SQLite**（better-sqlite3，WAL 模式） | 单文件、零运维、备份即拷贝；Drizzle 迁移轻量 | Prisma（重）、Postgres（运维成本不值） |
| 鉴权 | 口令（Argon2id）+ **Passkey/WebAuthn** + session cookie | 单用户最简方案；Passkey 顺便炫技 | OAuth（引入第三方依赖） |
| 图片处理 | Sharp | 上传即转 WebP/AVIF + 多尺寸 + LQIP 占位 | squoosh-lib |
| 搜索 | Pagefind | 构建期静态索引，无服务端成本，中文分词可用 | MeiliSearch（多一个常驻服务） |
| 代码高亮 | Shiki | 构建期高亮零运行时，主题可定制成"陶土色" | prism |
| 校验 | Zod 4 | frontmatter / API / 表单三处共用 schema（`packages/content`） | valibot |
| 部署 | Docker Compose + **Caddy** | 自动 HTTPS、反代 + 静态托管一体 | Vercel + Turso（作为云端备选记录在案） |
| CI | GitHub Actions | lint + typecheck + build + Lighthouse CI | — |
| 测试 | Vitest + Playwright | 单测内容管线/API；E2E 关键路径（发文→展示→评论） | — |

## 3. 关键决策详述

### 3.1 为什么是 Astro 而不是 Next.js

- 博客页面 90% 可纯静态输出，Astro 默认零 JS，天然满足"性能底线"原则；Next 的 RSC 仍要带运行时。
- 动效丰富 ≠ 整站 SPA：粘土动效集中在卡片、按钮、hero 等局部，岛屿模型恰好匹配"大部分静、局部动"。
- Astro 内建 View Transitions（`<ClientRouter />`），跨页"粘土揉捏"过场（见 [04-motion.md](04-motion.md)）拿来即用。
- Admin 需要的"应用感"由独立 SPA 承担，主站不必为它妥协。
- 代价：主站岛屿间共享状态要靠 nanostores；接受，因为跨岛状态只有主题/播放器级别的少量全局量。

### 3.2 渲染策略

- 主站整体 **SSG**；文章发布/修改后由 server 触发增量重建（流程见 [02-architecture.md](02-architecture.md) §4）。
- 评论、点赞、浏览量等动态数据**不参与构建**，由岛屿在客户端向 `apps/server` 拉取 —— 保证静态页缓存永不脏。
- 动态（Moments）页同样静态化，新动态触发重建（发布频率低，可接受分钟级延迟）。

### 3.3 动效库分工（避免三库打架）

| 层 | 工具 | 用途 |
| --- | --- | --- |
| 0 | 纯 CSS（transition / `@starting-style` / scroll-timeline） | hover、focus、入场等能不写 JS 就不写 |
| 1 | motion | 岛屿内的 spring 微交互（捏压、弹回、拖拽） |
| 2 | GSAP + ScrollTrigger + Lenis | 首页滚动叙事、长页面编排 |
| 3 | clay-engine（Three/TSL） | 真实粘土模拟（见 [08-webgpu.md](08-webgpu.md)） |

规则：**同一个元素只归一层管**；层 2、3 只出现在首页、实验室、404 三处。

### 3.4 为什么内容不进数据库

文章 = MDX 文件进 git，动态数据 = SQLite。理由与完整 schema 见 [07-data.md](07-data.md)。一句话：写作产物是最珍贵的资产，必须以最可迁移、可 diff、可备份的形式存在。

## 4. 风险与回退

| 风险 | 概率 | 回退方案 |
| --- | --- | --- |
| WebGPU 兼容面不足 | 已知现实 | TSL 双后端自动落 WebGL；再降为预渲染视频/静态图（[08-webgpu.md](08-webgpu.md) §2） |
| View Transitions 在 Firefox 表现不一致 | 中 | 特性检测，降级为普通跳转 + 入场动画 |
| TipTap ⇄ Markdown 往返丢格式 | 中 | 以 Markdown 为唯一真源，富文本视图仅是投影；保留源码模式兜底 |
| SQLite 并发写入瓶颈 | 低（个人站流量） | WAL 模式 + 写操作串行队列；真到瓶颈迁 Turso/Postgres，Drizzle 层无痛 |
| 中文字体体积 | 高 | 构建期子集化分包（[03-design-system.md](03-design-system.md) §5），全站 woff2 分片按需加载 |
| GSAP 商用许可疑虑 | 低 | 个人博客适用免费许可；如有顾虑可替换为 scroll-timeline + motion 组合 |
