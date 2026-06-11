import type { Root } from "mdast";
import { toString as mdToString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";

/**
 * remark 插件集（docs/07-data.md §3）。
 * 由 apps/web 的 astro 配置挂载；server 的预览管线（M4）复用同一套。
 */

interface AstroVFile {
  data: { astro?: { frontmatter?: Record<string, unknown> } };
}

// 假名 + CJK 统一表意文字（含扩展A）+ 兼容表意文字
const CJK_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/g;

/** 阅读时长：中文按 350 字/分钟，西文按 200 词/分钟，写入 frontmatter.readingMinutes */
export function remarkReadingTime() {
  return (tree: Root, file: AstroVFile) => {
    const text = mdToString(tree);
    const cjkChars = text.match(CJK_RE)?.length ?? 0;
    const latinWords = text
      .replace(CJK_RE, " ")
      .split(/\s+/)
      .filter(Boolean).length;
    const minutes = Math.max(1, Math.round(cjkChars / 350 + latinWords / 200));

    const frontmatter = ((file.data.astro ??= {}).frontmatter ??= {});
    frontmatter.readingMinutes = minutes;
  };
}

/** :::note / :::tip / :::warn 容器 → <aside class="callout callout-*">（依赖 remark-directive） */
const CALLOUT_KINDS = new Set(["note", "tip", "warn"]);

interface DirectiveNode {
  type: string;
  name?: string;
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
}

export function remarkCallouts() {
  return (tree: Root) => {
    visit(tree, (node) => {
      const directive = node as unknown as DirectiveNode;
      if (directive.type !== "containerDirective") return;
      if (!directive.name || !CALLOUT_KINDS.has(directive.name)) return;

      directive.data ??= {};
      directive.data.hName = "aside";
      directive.data.hProperties = { class: `callout callout-${directive.name}` };
    });
  };
}
