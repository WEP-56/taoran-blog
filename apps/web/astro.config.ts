import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { remarkCallouts, remarkReadingTime } from "@taoran/content/remark";
import { taoranShikiDark, taoranShikiLight } from "@taoran/content/shiki";
import { defineConfig } from "astro/config";
import pagefind from "astro-pagefind";
import remarkDirective from "remark-directive";

export default defineConfig({
  site: process.env.SITE_URL ?? "http://localhost:4321",
  // 全站 SSG（docs/01-tech-stack.md §3.2）；动态数据由岛屿向 server 拉取
  output: "static",
  integrations: [react(), mdx(), sitemap(), pagefind()],
  markdown: {
    shikiConfig: {
      themes: {
        light: taoranShikiLight,
        dark: taoranShikiDark,
      },
    },
    remarkPlugins: [remarkDirective, remarkCallouts, remarkReadingTime],
  },
});
