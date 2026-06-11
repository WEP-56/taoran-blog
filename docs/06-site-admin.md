# 06 · Admin 站规格

## 1. 定位

**单用户**写作与运营后台（`apps/admin`，独立 SPA，部署在 `admin.example.com` 或主域 `/admin` 路径）。一切操作通过 `apps/server` 的 `/api/admin/*` 完成，admin 自身无任何持久化。

界面同样采用粘土设计系统（[03-design-system.md](03-design-system.md)），但取**紧凑密度档**：圆角降一级、间距收紧、动效只保留 P0 微交互 —— 后台是干活的地方。

布局：左侧固定窄边栏（图标导航 + 折叠），顶部面包屑 + 全局保存状态指示（"未保存的泥还湿着"），主区内容。

## 2. 鉴权与安全

| 项 | 方案 |
| --- | --- |
| 登录 | 口令（Argon2id 哈希存环境变量）；登录成功后引导注册 **Passkey**，之后可纯 Passkey 免密登录 |
| 会话 | 服务端 session（SQLite `sessions` 表）+ `HttpOnly; Secure; SameSite=Strict` cookie，7 天滑动过期 |
| CSRF | SameSite=Strict + 自定义头双保险；admin API 拒绝无 `X-Requested-With` 的写请求 |
| 限流 | 登录接口 5 次/分钟/IP，失败指数退避；全局写接口限流 |
| 传输 | 仅 HTTPS（Caddy 强制）；admin 站 `noindex` |
| 审计 | 关键操作（删除、设置变更、登录）写 `audit_log` 表 |

## 3. 功能模块

### 3.1 仪表盘 `/dashboard`

- 数据卡：今日/7日/30日 PV、文章总数、待审评论数、最近点赞。
- 趋势图：30 天 PV 面积图（图表线条用手绘风格滤镜）。
- 快捷入口：新建文章、发动态；待办：待审评论、草稿箱。

### 3.2 文章管理 `/posts`

**列表**：状态筛选（已发布/草稿/定时）、标签筛选、搜索；行内显示 PV/点赞/评论数；操作：编辑、置顶、下线、删除（删除 = 移入 `content/.trash/`，可恢复，二次确认）。

**编辑器**（核心模块）：

- **双模**：TipTap 富文本视图 ⇄ CodeMirror Markdown 源码视图，**Markdown 为唯一真源**（[01-tech-stack.md](01-tech-stack.md) §4 风险表），切换无损。
- 图片：粘贴/拖拽即上传 → server Sharp 管线 → 插入相对引用；上传中显示 LQIP 占位。
- MDX 组件插入面板：提示框、折叠块、视频卡等白名单组件（防任意 JSX）。
- 侧栏元信息面板：slug（自动生成可改，改动校验冲突）、摘要（可一键由正文首段生成）、标签（可输入新建）、封面（裁剪到约定比例）、置顶、`draft / published / scheduled` + 定时时间。
- SEO 面板：自定义 description、OG 图预览（实时调 satori 模板渲染）。
- 自动保存：本地 IndexedDB 每 10s + 远端草稿每 60s；离开未保存有拦截。
- 预览：server 用与主站相同的 MDX 管线渲染（[02-architecture.md](02-architecture.md) §4），分屏或新窗口，含移动端宽度切换。

### 3.3 动态管理 `/moments`

发布框（文字 + 多图上传 + 心情）置顶，下方时间线列表可编辑/删除。发布即触发重建（与文章共用防抖队列）。

### 3.4 评论审核 `/comments`

- 队列视图：待审 / 已通过 / 垃圾箱；显示评论上下文（所属文章 + 父评论）。
- 自动过滤：关键词黑名单 + 链接数 > 2 进待审 + 同 IP 频率限制；命中白名单邮箱（既往通过 ≥ 2 条）自动通过。
- 操作：通过 / 拒绝 / 标记垃圾 / 回复（以作者身份，样式特殊标识）。
- 邮件通知（可选开关）：新评论待审时发提醒；评论被回复时通知评论者（需其勾选同意）。

### 3.5 友链管理 `/friends`

CRUD + 拖拽排序 + 状态标记（正常/失联）；定时任务每周探活（HTTP 200 检查），失联自动标记待处理。

### 3.6 资源库 `/assets`

- 网格视图浏览 `data/uploads`：尺寸、格式、引用计数（扫描 content 引用）。
- 操作：重命名、删除（被引用时警告）、复制引用链接、手动触发重新压缩。

### 3.7 站点设置 `/settings`

站名/简介/头像、导航项、页脚文案、评论开关与黑名单词库、统计开关、邮件 SMTP 配置、主题预览。设置写入 `site` 表并同步快照到 `content/site.json`（重建时主站读取）。

### 3.8 运维 `/ops`

- **重建**：手动触发 + 查看重建队列与最近构建日志（成功/失败/耗时）。
- **备份**：一键导出 zip（content/ + SQLite `VACUUM INTO` 副本）；显示最近自动备份时间。
- 健康面板：磁盘占用、DB 大小、server 版本。

## 4. 接口约定（摘要）

REST，统一前缀 `/api/admin`，JSON，错误格式 `{ error: { code, message } }`。完整字段随 `packages/content` 的 Zod schema 演进，此处定关键端点：

```
POST   /auth/login            口令登录
POST   /auth/webauthn/*       Passkey 注册/认证
GET    /posts?status=&tag=&q= 列表（分页）
GET    /posts/:slug           读取（含 Markdown 源）
PUT    /posts/:slug           保存（写 MDX + upsert DB 行）
POST   /posts/:slug/publish   发布/定时
DELETE /posts/:slug           软删除
POST   /uploads               图片上传（multipart，返回多尺寸 URL + LQIP）
GET    /comments?state=       审核队列
PATCH  /comments/:id          通过/拒绝/垃圾
GET    /stats/overview        仪表盘数据
POST   /ops/rebuild           触发重建
POST   /ops/backup            生成并下载备份
GET/PUT /settings             站点设置
```

公开接口（`/api/v1/*`，主站岛屿用）见 [07-data.md](07-data.md) §4。
