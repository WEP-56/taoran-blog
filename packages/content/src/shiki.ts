/**
 * Shiki「陶土」代码高亮双主题（docs/05-site-web.md §2.3）。
 * 色值取自设计系统色板的同族暖色（docs/03-design-system.md §2）。
 * 结构为 VS Code TextMate 主题格式，Shiki / Astro 直接接受。
 */

interface TokenColor {
  scope: string | string[];
  settings: { foreground?: string; fontStyle?: string };
}

interface ShikiTheme {
  name: string;
  type: "light" | "dark";
  colors: Record<string, string>;
  tokenColors: TokenColor[];
}

function makeTheme(
  name: string,
  type: "light" | "dark",
  c: {
    bg: string;
    fg: string;
    comment: string;
    string: string;
    keyword: string;
    func: string;
    constant: string;
    typeName: string;
    punct: string;
  },
): ShikiTheme {
  return {
    name,
    type,
    colors: {
      "editor.background": c.bg,
      "editor.foreground": c.fg,
    },
    tokenColors: [
      { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: c.comment, fontStyle: "italic" } },
      { scope: ["string", "string.quoted", "markup.inline.raw"], settings: { foreground: c.string } },
      { scope: ["keyword", "storage.type", "storage.modifier", "keyword.operator.new"], settings: { foreground: c.keyword } },
      { scope: ["entity.name.function", "support.function", "meta.function-call.generic"], settings: { foreground: c.func } },
      { scope: ["constant", "constant.numeric", "constant.language", "variable.other.enummember"], settings: { foreground: c.constant } },
      { scope: ["entity.name.type", "entity.name.class", "support.type", "support.class"], settings: { foreground: c.typeName } },
      { scope: ["entity.name.tag", "keyword.control"], settings: { foreground: c.keyword } },
      { scope: ["entity.other.attribute-name", "variable.parameter"], settings: { foreground: c.constant } },
      { scope: ["variable", "support.variable"], settings: { foreground: c.fg } },
      { scope: ["punctuation", "meta.brace"], settings: { foreground: c.punct } },
      { scope: ["keyword.operator"], settings: { foreground: c.punct } },
      { scope: ["markup.heading"], settings: { foreground: c.keyword, fontStyle: "bold" } },
      { scope: ["markup.bold"], settings: { fontStyle: "bold" } },
      { scope: ["markup.italic"], settings: { fontStyle: "italic" } },
    ],
  };
}

/** 亮色：晒在日光下的陶坯 */
export const taoranShikiLight = makeTheme("taoran-clay-light", "light", {
  bg: "#fff9f0",
  fg: "#4a3b32",
  comment: "#a08a78",
  string: "#6f8a55",
  keyword: "#c9603f",
  func: "#a3651e",
  constant: "#b07d2b",
  typeName: "#946b54",
  punct: "#8a7263",
});

/** 暗色：窑火里的釉面 */
export const taoranShikiDark = makeTheme("taoran-clay-dark", "dark", {
  bg: "#2e2620",
  fg: "#f3e9dd",
  comment: "#8f7b6a",
  string: "#a9bd96",
  keyword: "#f08a66",
  func: "#e8c463",
  constant: "#e0b05e",
  typeName: "#d9a66c",
  punct: "#b9a08f",
});
