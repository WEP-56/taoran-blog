# WEP Blog

保留原有黑白前端、Three.js 背景、Studio 编辑界面。Next.js 16 + PostgreSQL，面向单台 Ubuntu VPS。新库只初始化一条站点设置，文章、动态、图库、友链、评论、访问记录均为空；应用访问不会创建演示内容。

## 本地开发

需要 Node.js 24、PostgreSQL 17。复制 `.env.example` 为 `.env`，填写数据库连接、站点 URL 和不少于 12 位的管理口令。不要提交 `.env`。

```sh
npm ci
npm run db:migrate
npm run dev
```

`ADMIN_PASSWORD` 仅用于首次设置口令。首次成功登录后保存 scrypt 哈希；之后在 Studio 修改口令，旧会话全部失效。环境变量不会覆盖已经设置的口令。没有默认口令，旧演示口令也不能登录。正式环境仅通过 HTTPS 访问，Cookie 为 HttpOnly、Secure、SameSite=Strict，8 小时到期。

## Ubuntu VPS 部署

1. 安装 Docker Engine 和 Compose 插件；域名 A/AAAA 指向 VPS，放行 TCP 80/443。若未配置 IPv6，请勿保留错误的 AAAA 记录。
2. 上传源码，复制 `.env.example` 为 `.env`。设置 `DOMAIN`、`SITE_URL=https://你的域名`、随机 `POSTGRES_PASSWORD` 和强管理口令。数据库密码建议使用 `openssl rand -hex 32`，避免 URL 特殊字符。`chmod 600 .env`。
3. 执行下面命令。Compose 内自动设置数据库连接及可信代理，数据库和应用端口不暴露到主机。迁移成功后应用启动；Caddy 自动申请证书。

```sh
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 migrate app caddy
curl -f https://你的域名/api/health
```

访问 `/admin` 创建第一篇文章。生产镜像采用 standalone 输出和非 root 用户。首次部署使用新的 `postgres_data` 卷即为空站；不要把开发库导入生产。已有库不会被部署脚本自动清空。不要执行 `docker compose down -v`，它会删除持久化卷。

如果前面再加 CDN/代理，需重新配置可信 IP 链；当前 Caddy 用直接连接地址覆盖 `X-Real-IP`，客户端无法自报 IP。不要绕过 Caddy 暴露应用端口。开发环境 `TRUST_PROXY=0` 使用统一限流桶，正式 Compose 按代理提供的 IP 限流。

## 更新、备份与恢复

更新前备份，记录当前源码版本和镜像 ID。迁移串行、事务执行，有历史记录，失败会回滚。部署前请先在临时库测试新迁移。

```sh
mkdir -p backups
chmod 700 backups
docker compose exec -T db pg_dump -U blog -d blog -Fc > backups/blog.dump
docker compose build
docker compose run --rm migrate
docker compose up -d
```

将备份另存到 VPS 之外，定期做恢复演练。恢复时先停止 app，在一个新数据库中执行 `pg_restore -U blog -d 新库 --no-owner`，验证后切换连接；不要直接覆盖正在使用的库。回滚应同时考虑应用版本与 schema 的兼容性；涉及不兼容迁移时恢复对应备份。Studio JSON 导出不替代数据库备份。

访问统计默认保留，数据量大后需另设保留策略。后台趋势读取最近 14 天，总访问与访客数使用数据库聚合；设备分布展示最近 14 天。点赞为按 IP 限流的轻量统计，不保证唯一用户。公共评论默认待审核，邮箱不出现在公共 API 或页面 HTML。

## 验证

```sh
npm run lint
npm run typecheck
npm run build
npm test
npm audit
```

测试先要求完成 build。测试使用独立内存 PGlite，通过 PostgreSQL 协议运行生产 HTTP 服务；不读取或写入真实数据库。使用本机端口 55439、3137。包含迁移重复运行、空站页面、登录/退出、越权、草稿、评论隐私、恶意链接、请求限流和 Markdown 卡死回归。`node scripts/test-server.mjs` 可启动临时空站预览，退出后数据消失。

本机没有 Docker/原生 PostgreSQL，因此 Ubuntu 容器构建、真实 PostgreSQL 并发行为、域名证书与备份恢复仍需在 VPS/预发布环境验收。PGlite 测试不能替代这些检查。

自托管边界依据 [Next.js 自托管文档](https://nextjs.org/docs/app/guides/self-hosting)；鉴权在每个 API 处理入口执行，参见 [Next.js 鉴权文档](https://nextjs.org/docs/app/guides/authentication)。
