import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 开发期把 /api 代理到本地 server，免 CORS 配置
      "/api": "http://localhost:8787",
    },
  },
});
