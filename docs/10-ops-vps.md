# 10 · VPS 运维手册

本文记录当前线上部署方式：Ubuntu 22.04 + Caddy + systemd + Node 22 + pnpm。主站和后台是静态产物，API 是常驻 Hono Node 服务，运行时数据保存在 `content/` 和 `data/`。

## 1. 线上信息

| 项 | 值 |
| --- | --- |
| 项目目录 | `/opt/taoran-blog` |
| 主站 | `https://taoran.weppp.cyou` |
| 后台 | `https://admin.weppp.cyou` |
| API 本机端口 | `127.0.0.1:8787` |
| systemd 服务 | `taoran-server.service` |
| Caddy 配置 | `/etc/caddy/Caddyfile` |
| 环境变量文件 | `/etc/taoran-blog.env` |
| 内容目录 | `/opt/taoran-blog/content` |
| 数据目录 | `/opt/taoran-blog/data` |
| SQLite | `/opt/taoran-blog/data/taoran.db` |

DNS 当前应包含：

```text
A  taoran  154.40.58.78
A  admin   154.40.58.78
```

初次排障建议保持 Cloudflare 灰云（DNS only）。如果开启橙云，SSL/TLS 模式使用 Full 或 Full strict，不要使用 Flexible。

## 2. 常用命令

查看后端状态：

```bash
systemctl status taoran-server --no-pager
curl http://127.0.0.1:8787/api/health
curl https://taoran.weppp.cyou/api/health
```

查看日志：

```bash
journalctl -u taoran-server -n 120 --no-pager
journalctl -u taoran-server -f
```

重启后端：

```bash
systemctl restart taoran-server
```

检查 Caddy：

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl status caddy --no-pager
```

确认后台线上静态资源版本：

```bash
cd /opt/taoran-blog
grep -o 'assets/[^"]*' apps/admin/dist/index.html
curl -s https://admin.weppp.cyou | grep -o 'assets/[^"]*'
```

两条输出应一致。

## 3. 部署更新

进入项目：

```bash
cd /opt/taoran-blog
git pull
pnpm install --frozen-lockfile
```

只改后台：

```bash
pnpm --filter @taoran/admin build
```

只改主站：

```bash
SITE_URL=https://taoran.weppp.cyou \
PUBLIC_API_BASE=https://taoran.weppp.cyou \
pnpm --filter @taoran/web build
```

改了共享包、主站和后台都可能受影响：

```bash
SITE_URL=https://taoran.weppp.cyou \
ADMIN_URL=https://admin.weppp.cyou \
PUBLIC_API_BASE=https://taoran.weppp.cyou \
pnpm build
```

需要重启 `taoran-server` 的情况：

- 改了 `apps/server/**`
- 改了 server 使用的共享包，例如 `packages/content`
- 改了数据库 schema 或迁移
- 改了 `/etc/taoran-blog.env`
- 改了 Node 依赖并影响 server 运行

不需要重启的情况：

- 只改 `apps/admin/**` 并已重新 build
- 只改 `apps/web/**` 并已重新 build
- 只改 CSS、静态资源、后台前端交互

## 4. Caddy 配置

当前关键结构应类似：

```caddy
taoran.weppp.cyou {
	encode zstd gzip

	route {
		reverse_proxy /api/* 127.0.0.1:8787

		root * /opt/taoran-blog/apps/web/dist
		try_files {path} {path}/ /404.html
		file_server
	}
}

admin.weppp.cyou {
	encode zstd gzip

	route {
		reverse_proxy /api/* 127.0.0.1:8787

		root * /opt/taoran-blog/apps/admin/dist
		try_files {path} /index.html
		file_server
	}
}
```

`route` 里的 `/api/*` 必须在静态文件处理之前，否则 API 请求可能被当成前端页面返回 HTML。

## 5. 环境变量

文件位置：

```bash
/etc/taoran-blog.env
```

常见检查：

```bash
grep -E '^(NODE_ENV|SITE_URL|ADMIN_URL|SERVER_PORT|RP_ID|RP_ORIGIN)=' /etc/taoran-blog.env
```

不要公开：

- `SESSION_SECRET`
- `ADMIN_PASSWORD_HASH`

修改环境变量后需要：

```bash
systemctl restart taoran-server
```

## 6. 重设后台密码

在 VPS 上执行：

```bash
cd /opt/taoran-blog
read -rsp "New admin password: " ADMIN_PASSWORD; echo
ADMIN_PASSWORD_HASH=$(ADMIN_PASSWORD="$ADMIN_PASSWORD" pnpm --filter @taoran/server exec node --input-type=module -e "import { hash } from '@node-rs/argon2'; console.log(await hash(process.env.ADMIN_PASSWORD));")
unset ADMIN_PASSWORD
cp /etc/taoran-blog.env /etc/taoran-blog.env.bak.$(date +%F-%H%M%S)
sed -i "s#^ADMIN_PASSWORD_HASH=.*#ADMIN_PASSWORD_HASH=$ADMIN_PASSWORD_HASH#" /etc/taoran-blog.env
unset ADMIN_PASSWORD_HASH
systemctl restart taoran-server
```

测试登录接口：

```bash
read -rsp "Admin password: " P; echo
curl -i https://admin.weppp.cyou/api/admin/auth/login \
  -H 'content-type: application/json' \
  --data "{\"password\":\"$P\"}"
unset P
```

返回 `{"ok":true}` 表示密码正确。

## 7. 备份与恢复

必须备份：

```text
/opt/taoran-blog/content
/opt/taoran-blog/data
```

手动打包：

```bash
cd /opt/taoran-blog
bash deploy/backup.sh /opt/taoran-blog /root/taoran-backups
```

恢复原则：

1. 拉取项目代码。
2. 恢复 `content/` 和 `data/`。
3. 执行 `pnpm install --frozen-lockfile`。
4. 执行 `pnpm build`。
5. 启动或重启 `taoran-server`。

## 8. 常见故障

后台能打开但登录失败：

```bash
curl -i https://admin.weppp.cyou/api/health
```

如果返回 HTML，说明 Caddy 没有把 `/api/*` 反代到 server，检查 Caddy `route` 顺序。

后台改了但线上没变化：

```bash
cd /opt/taoran-blog
git rev-parse HEAD
grep -o 'assets/[^"]*' apps/admin/dist/index.html
curl -s https://admin.weppp.cyou | grep -o 'assets/[^"]*'
```

如果 `dist/index.html` 和 `curl` 不一致，检查 Caddy root 或 reload。若一致但浏览器仍旧，使用强刷或清 Cloudflare 缓存。

`git pull` 被 `pnpm-lock.yaml` 阻止：

```bash
cd /opt/taoran-blog
git status --short
git restore pnpm-lock.yaml
git pull
pnpm install --frozen-lockfile
```

仅在确认 VPS 上的 lockfile 不是手工修改时这样处理。

发布文章后主站没更新：

```bash
journalctl -u taoran-server -n 120 --no-pager
```

也可以在后台“运维”页手动重建。重建命令由 `/etc/taoran-blog.env` 中的 `REBUILD_CMD` 控制，未设置时使用默认 `pnpm --filter @taoran/web build`。
