import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL ?? "http://localhost:4321",
  // 全站 SSG（docs/01-tech-stack.md §3.2）；动态数据由岛屿向 server 拉取
  output: "static",
});
