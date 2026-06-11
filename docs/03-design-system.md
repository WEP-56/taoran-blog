# 03 · 设计系统（粘土风）

## 1. 什么是这套粘土风

Claymorphism 三要素，全站组件统一遵守：

1. **大圆角**：组件像被搓圆的泥块，圆角显著大于常规 UI。
2. **双内阴影**：内部"上亮下暗"，制造受光的体积感 —— 这是粘土感的灵魂。
3. **柔和外影**：低对比、大模糊、带暖色相的投影，物体像轻轻搁在桌面上。

再加两味私货让它"温暖"：**纸张噪点**（全站底层 2% 透明度 grain 纹理，消除数码塑料感）与**手作不完美**（装饰元素允许 1–2° 随机旋转、手绘描边）。

## 2. 色板令牌

所有颜色以 CSS 自定义属性发布于 `packages/ui/src/tokens.css`，命名 `--clay-*`。

### 亮色「日晒陶坊」

> 注：M1 实机走查后按用户反馈整体降了一档亮度（原奶油白底偏晃眼），以下为现行值。

| Token | 值 | 用途 |
| --- | --- | --- |
| `--clay-bg` | `#F2E9DB` | 页面底（亚麻纸） |
| `--clay-surface` | `#EBDCC7` | 卡片/组件底（生陶土） |
| `--clay-surface-2` | `#F7EFE2` | 浮层、输入框内部 |
| `--clay-primary` | `#E07856` | 主行动色（陶土橘） |
| `--clay-primary-deep` | `#C9603F` | 主色按压态/链接 hover |
| `--clay-accent` | `#9CAF88` | 辅助（鼠尾草绿）：成功、标签点缀 |
| `--clay-sun` | `#F2C94C` | 高亮（奶油黄）：选中、星标 |
| `--clay-blush` | `#EFA48B` | 杏粉：点赞、温和强调 |
| `--clay-ink` | `#4A3B32` | 正文（深可可） |
| `--clay-ink-2` | `#8A7263` | 次级文字 |
| `--clay-line` | `#DCC9B2` | 分隔线 |
| `--clay-danger` | `#D45D4E` | 危险（admin 删除等） |

### 暗色「窑变之夜」

暗色不是反色，而是"进窑烧过的陶"——底色压暗保暖，主色提亮保持对比：

| Token | 值 |
| --- | --- |
| `--clay-bg` | `#27201B` |
| `--clay-surface` | `#332A23` |
| `--clay-surface-2` | `#3D332B` |
| `--clay-primary` | `#F08A66` |
| `--clay-accent` | `#A9BD96` |
| `--clay-sun` | `#E8C463` |
| `--clay-ink` | `#F3E9DD` |
| `--clay-ink-2` | `#B9A08F` |
| `--clay-line` | `#4A3D33` |

切换实现：`html[data-theme]` 切换变量集；配合 View Transitions 做"窑火蔓延"圆形扩散过场（见 [04-motion.md](04-motion.md) §4.3）。

**对比度要求**：正文/底 ≥ 7:1，次级文字 ≥ 4.5:1，主色按钮文字 ≥ 4.5:1（用工具在 CI 校验 token 文件）。

## 3. 形状与阴影令牌

| Token | 值 | 用途 |
| --- | --- | --- |
| `--clay-r-sm` | `12px` | 标签、小按钮 |
| `--clay-r-md` | `20px` | 输入框、普通按钮 |
| `--clay-r-lg` | `28px` | 卡片 |
| `--clay-r-xl` | `40px` | 大区块、对话框 |
| `--clay-r-blob` | `30% 70% 70% 30% / 30% 30% 70% 70%` | 装饰泥团（配合动画呼吸变形） |

**标准粘土阴影配方**（亮色值；暗色等比换暖黑）：

```css
.clay {
  background: var(--clay-surface);
  border-radius: var(--clay-r-lg);
  box-shadow:
    inset -8px -8px 16px rgba(197, 153, 124, 0.35),   /* 内·背光面 */
    inset  8px  8px 16px rgba(255, 255, 255, 0.65),   /* 内·受光面 */
    12px 16px 32px rgba(180, 140, 110, 0.25);         /* 外·落影 */
}
.clay:active {            /* 按压态：内外阴影同时收紧 = "捏下去" */
  box-shadow:
    inset -4px -4px 8px rgba(197, 153, 124, 0.45),
    inset  4px  4px 8px rgba(255, 255, 255, 0.55),
    4px 6px 12px rgba(180, 140, 110, 0.2);
  transform: scale(0.97);
}
```

层级靠**阴影深度**而非边框表达：`--clay-elev-rest / -raised / -float / -pressed` 四档。

## 4. 字体方案

| 角色 | 字体 | 说明 |
| --- | --- | --- |
| 标题 / 点缀 | **霞鹜文楷**（LXGW WenKai Screen） | 手写楷体，温暖手作感的最大功臣；开源可自托管 |
| 正文中文 | Noto Sans SC | 长文阅读以清晰为先，楷体只给标题 |
| 西文正文 | Nunito | 圆端 sans，与粘土圆角呼应 |
| 代码 | JetBrains Mono | 配 Shiki 自定义"陶土"高亮主题 |

**子集化是硬要求**：M1 起采用预子集化的 npm 字体包（`lxgw-wenkai-screen-webfont`、`@fontsource/noto-sans-sc` 等，均已按 unicode-range 切为按需加载的 woff2 分片），效果等同自跑 `cn-font-split` 且零维护成本；`font-display: swap`。正文字号 17px / 行高 1.85 / 段距 1.25em，行宽 max 38em。

## 5. 组件清单（`packages/ui`，前缀 Clay）

| 组件 | 规格要点 |
| --- | --- |
| `ClayCard` | 标准阴影配方；hover 抬升至 `-raised` + 1° 微倾（指针设备才有） |
| `ClayButton` | 三型：primary（陶土橘实心）/ soft（surface 同色）/ ghost；按压形变见动效文档 |
| `ClayTag` | 药丸形，色相从 accent/sun/blush 按 tag 名哈希取，像捏的小泥条 |
| `ClayInput` / `ClayTextarea` | **凹陷式**（内阴影反转，像泥上压出的槽）；focus 时槽边缘亮起主色描边 |
| `ClayToggle` | 滑块是一颗会被"压扁再弹回"的泥球；用于主题切换等 |
| `ClayAvatar` | 圆形 + 不规则 blob 描边；hover 轻微 wobble |
| `ClayDialog` | `--clay-r-xl`，进出场为 squish 弹入（见 [04-motion.md](04-motion.md)） |
| `ClayTooltip` | 小泥片 + 手绘箭头 |
| `ClayProgress` | "搓泥条"：进度条两端圆鼓，增长时有蠕动质感 |
| `ClaySkeleton` | 加载骨架是缓慢呼吸变形的 blob |
| `ClayToast` | 从底部"啪叽"落下并轻微压扁回弹 |
| `ClayDivider` | 手绘波浪线 SVG，不是直线 |

组件同时服务主站岛屿与 admin —— admin 整体也是粘土风，但密度更高（间距 token 取紧凑档）。

## 6. 插画与材质

- 全站 grain：一张 128px tile 噪点 PNG，`opacity: .02`，`pointer-events: none` 顶层叠加。
- 装饰泥团：3–4 个 `--clay-r-blob` 形状的纯 CSS 元素散布在 hero / 空状态 / 404，缓慢 morphing。
- 图标：Phosphor Icons（duotone 风格，描边圆润），关键位置（导航、空状态）替换为手绘 SVG。
- 空状态插画统一脚本：一只没捏完的泥猫 + 一句温暖文案。

## 7. 无障碍与响应式

- 焦点环不用默认蓝框：用"压痕"风格 —— `outline: 3px solid var(--clay-primary)` + 2px offset，全键盘可达。
- 所有纯动效信息（如点赞成功的形变）必须伴随文字/ARIA live 提示。
- 断点：`sm 640 / md 768 / lg 1024 / xl 1280`；文章页移动端单栏，目录收进底部抽屉。
- 触控目标 ≥ 44px；`prefers-reduced-motion` 策略见 [04-motion.md](04-motion.md) §6。
