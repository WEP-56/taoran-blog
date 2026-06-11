# 09 · 路线图

里程碑按"每个阶段结束都有可看/可用的东西"切分。单人开发，估时按业余时间（每周 ~10h）粗估，仅供节奏参考。

## M0 · 地基（~1 周）

脚手架：monorepo（pnpm + turbo）、四 packages 占位、CI（lint/typecheck/build）、`.env.example`、Drizzle 初始迁移。

**验收**：`pnpm i && pnpm dev` 三个 app 同时起；CI 绿。

## M1 · 设计系统 + 内容管线（~2 周）

- `packages/ui`：tokens.css（[03-design-system.md](03-design-system.md) 全部令牌）+ 首批 8 个 Clay 组件 + 一个组件预览页（顺便当 UI 回归基线）。
- `packages/content`：frontmatter schema + MDX 管线全链路（含 Shiki 陶土主题、图片管线、字体子集化脚本）。
- 写 3 篇真实测试文章覆盖全部排版元素。

**验收**：组件预览页双主题无可访问性违例；3 篇文章管线产物正确（toc/阅读时长/LQIP/高亮）。

## M2 · 主站核心（~3 周）

[05-site-web.md](05-site-web.md) 中除 lab/404 彩蛋外全部页面：首页（hero 先用静态占位图）、文章列表/详情/归档/标签/关于/友链、RSS/sitemap/OG 图、搜索、暗色模式、P0+P1 动效。

**验收**：性能指标达 [05-site-web.md](05-site-web.md) §4 表格；Lighthouse CI 卡线生效；手机实机走查无布局问题。

## M3 · 动态层 API（~2 周）

`apps/server` 公开 API：评论、点赞、浏览量、moments（[07-data.md](07-data.md) §4/§5），主站岛屿接入；限流与反垃圾；备份脚本。

**验收**：无 JS 时文章页可读且岛屿优雅降级；评论提交→审核态→展示全流程通；压测 100 rps 读不出错。

## M4 · Admin 站（~3 周）

[06-site-admin.md](06-site-admin.md) 全模块，编辑器优先（双模编辑、图片上传、预览、自动保存），其后审核/设置/运维；鉴权（口令 + Passkey）；重建队列。

**验收**：在 admin 完成"写一篇带图文章 → 预览 → 定时发布 → 自动重建 → 主站可见"全流程，全程不碰终端。

## M5 · 炫技（~3 周，可与 M4 穿插）

[08-webgpu.md](08-webgpu.md)：hero 粘土球 → 404 陶罐 → 捏泥工坊 → 泥点雨，按此顺序（hero 价值最高）。每个场景先 T0 后补降级档。

**验收**：[08-webgpu.md](08-webgpu.md) §5 清单全勾。

## M6 · 打磨上线（~1 周）

Docker Compose + Caddy 部署、域名 HTTPS、迁移演练（30 分钟复活测试，见 [07-data.md](07-data.md) §6）、全站文案走查、OG 卡片在主流平台实测、historical 文章导入（如有）。

**验收**：生产环境跑通备份-恢复演练；对外发布第一篇文章《把博客捏成一团泥》。

## 里程碑后（Backlog，不承诺）

Newsletter 订阅、Webmention、文章双语、评论邮件回复直接过审、实验室新玩具（拉坯机模拟）、年度报告页。

## 风险跟踪

| 风险 | 影响 | 缓解 | 关联 |
| --- | --- | --- | --- |
| 范围蔓延（炫技无底洞） | 延期、烂尾 | M5 固定 4 个场景封顶；新点子一律进 Backlog | [00-overview.md](00-overview.md) §5 |
| TipTap 双模往返丢格式 | 编辑器返工 | M4 第一周先做往返 fuzz 测试，不过关就降级为"源码模式为主 + 富文本只读预览" | [01-tech-stack.md](01-tech-stack.md) §4 |
| WebGPU 设备碎片化 | 体验不一致 | 降级链 + 真机三档验证前置到每个场景的完成定义里 | [08-webgpu.md](08-webgpu.md) §2 |
| 中文字体性能 | LCP 超标 | M1 就做子集化并进 CI 体积预算，不留到最后 | [03-design-system.md](03-design-system.md) §4 |
| 单人精力 | 节奏断档 | 每个 M 出口都是"可上线状态"，任何时刻停下都有完整产物 | — |
