# 04 · 动效设计

## 1. 动效哲学：万物皆可捏

陶然的动效不追求"花"，追求**统一的材质幻觉**：页面上每个元素都假装自己是一块粘土。由此推出三条铁律：

1. **受力必形变**：被点、被拖、被悬停的东西要有体积反馈（压扁/鼓起），而不是变色了事。
2. **形变必弹回**：所有恢复都走 spring 过冲，没有线性 ease 的"死"动画。
3. **不抢内容**：正文阅读区零常驻动画；动效只发生在交互瞬间和页面边缘。

每加一个动效前自问：它让内容更好读了吗？或者它有趣到值得这 80ms 吗？两个都答不上来就删。

## 2. 动效令牌

与颜色一样发布为 token（`packages/ui/src/tokens.css` + motion 配置常量）：

| Token | 值 | 用途 |
| --- | --- | --- |
| `--mo-fast` | `140ms` | hover、focus 进入 |
| `--mo-base` | `240ms` | 一般状态切换 |
| `--mo-slow` | `420ms` | 浮层、过场 |
| `--mo-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | 入场 |
| `--mo-ease-squish` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 果冻回弹（CSS 用） |
| `spring.squish` | `{ stiffness: 260, damping: 18, mass: 1 }` | motion：标准捏压 |
| `spring.soft` | `{ stiffness: 170, damping: 24 }` | motion：浮层、跟随 |
| `spring.wobble` | `{ stiffness: 320, damping: 9 }` | motion：刻意夸张的彩蛋 |

技术分工（哪层动效用哪个库）已定于 [01-tech-stack.md](01-tech-stack.md) §3.3，此处不重复。

## 3. P0 · 微交互（全站基线，纯 CSS / motion）

| 对象 | 动效 |
| --- | --- |
| 按钮按压 | `scale(0.97)` + 阴影收紧（配方见 [03-design-system.md](03-design-system.md) §3）；松开 spring 弹回并轻微过冲 |
| 卡片 hover | 抬升至 `-raised` 阴影 + `translateY(-3px)` + 1° 倾斜（仅指针设备） |
| 链接 hover | 底部"泥条"下划线从中间向两侧鼓出来 |
| 输入框 focus | 凹槽边缘主色描边以 140ms 点亮 + 轻微内缩 |
| Toggle 切换 | 泥球滑块被压扁 → 滑动 → 弹圆 |
| 点赞（捏一下） | 按住持续压扁 + 微颤，松手弹回并喷出 3–5 颗泥点粒子（CSS particle，非 canvas） |
| Toast | 落下压扁 8% 再弹回 |
| 列表入场 | `@starting-style` 渐入 + 6px 上移，stagger 40ms，仅首屏一次 |

## 4. P1 · 页面级动效

### 4.1 滚动叙事（首页专属，GSAP + Lenis）

首页从 hero 往下滚动：粘土球滚向一侧让位 → 精选文章卡片像泥片一样依次"拍"在桌面上 → 标签云的泥条逐个挤出。整页只此一条 ScrollTrigger 时间线，滚出视口即休眠。

### 4.2 跨页过场（Astro View Transitions）

- 列表 → 文章页：封面图与标题做 shared-element 连续过渡，其余内容旧页轻微"压扁淡出"、新页"弹开淡入"。
- 仅 morph 1–2 个共享元素，时长 ≤ `--mo-slow`；Firefox 等不支持时自动退为普通跳转。

### 4.3 主题切换「窑变」

以切换按钮为圆心的 `clip-path` 圆形扩散（View Transitions API），暖光从点击处蔓延整页，420ms。降级：直接切换。

### 4.4 阅读进度「搓泥条」

文章页顶部进度条用 `ClayProgress`：随滚动增长，到达 100% 时轻微鼓一下。`scroll-timeline` 实现，零 JS。

## 5. P2 · 炫技动效（限定首页 / 实验室 / 404）

| 场景 | 动效 | 实现 |
| --- | --- | --- |
| 首页 hero | 可按、可搓、会留指纹的粘土球 | clay-engine，规格见 [08-webgpu.md](08-webgpu.md) §3.1 |
| 404 | 一只陶罐从顶部掉落摔碎，碎片可拖拽；拼回去有彩蛋 | Rapier 物理 + 预切割网格（[08-webgpu.md](08-webgpu.md) §3.3） |
| 实验室·捏泥工坊 | 自由雕刻粘土并导出截图 | [08-webgpu.md](08-webgpu.md) §3.2 |
| 鼠标跟随 | 首页与实验室页：指针拖出一条渐隐"泥痕"（trail） | 2D canvas 岛屿，移动端禁用 |
| 关于页贴纸 | 头像/徽章贴纸可拖拽甩动，物理回弹 | motion drag + spring |

## 6. 可达性与降级

`prefers-reduced-motion: reduce` 时三档全降：

- P0：保留状态变化（颜色/阴影），移除位移、缩放与粒子。
- P1：ScrollTrigger 不注册、View Transitions 改为 crossfade、窑变改为直切。
- P2：clay-engine 不加载，渲染静态封面图；404 直接展示碎好的陶罐静态插画。

实现上统一走一个 `useMotionPref()` / CSS `@media`，禁止组件各自为政。

## 7. 性能预算

| 指标 | 预算 |
| --- | --- |
| 动效相关 JS（motion + GSAP + Lenis，gzip） | ≤ 80KB，且全部岛屿级按需加载 |
| 任何交互反馈延迟 | ≤ 100ms 内开始呈现 |
| 帧率 | 交互动效 60fps；只用 transform/opacity/clip-path，禁触发 layout 的属性 |
| CLS | 0 —— 入场动画一律不改变占位尺寸 |
| 长任务 | 动效初始化不产生 >50ms 长任务（拆分 + `requestIdleCallback`） |

CI 中用 Lighthouse CI 卡住 LCP/CLS/TBT 回归（见 [09-roadmap.md](09-roadmap.md)）。
