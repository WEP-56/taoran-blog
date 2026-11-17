# Existing VPS migration

The existing blog lives in `/opt/taoran-blog` and uses a system Caddy service, `taoran-server.service`, Markdown/MDX content and SQLite. Other projects already use ports 3000 and 8080. Use `compose.vps.yaml` for the new app on loopback port 3138; do not start the default Compose Caddy service here.

**Do not run `git pull` in the old deployment directory.** The new main branch replaces the old application architecture. Clone it into a separate directory such as `/opt/wep-blog`. Keep the old checkout, service, database and Caddy configuration for rollback.

Old source code is preserved in `legacy/pre-next-2026-11-17` at commit `ce14a60e45a79b8ec2d0784c02976e9429833154`. This branch does not include uncommitted production content or SQLite data.

Migration scope requested by the owner:

- Articles dated June 12 through November 10, 2026 inclusive, evaluated in Asia/Shanghai, and their comments.
- Friend links from the authoritative `content/friends.json`.
- Preserve actual article view counts where available. Do not invent historical visitors or visit events.
- Do not migrate moments or demo content outside the requested range.
- Preserve draft and comment moderation states. Verify a corresponding MDX source exists before importing a database article row. Preserve image references and old article URLs.

Before changing traffic, take a consistent SQLite backup using SQLite's backup API (a plain copy of a live WAL database is insufficient), archive `content/`, save the Caddy configuration and service unit, and verify backup integrity. Inventory the selected source files and comments before writing an importer. The production checkout contains uncommitted files, so a Git branch alone is not a sufficient rollback backup.

Deployment and migration are intentionally staged: backup and inspect; prepare/import into a separate database; validate content and URLs; temporarily freeze old writes and synchronize the final changes; then validate and reload Caddy to switch only the two blog domains. The admin domain should redirect to the new canonical site's `/admin` so authentication stays same-origin. Keep unrelated domains and containers unchanged. Restore the saved Caddy configuration to roll back traffic.

Publishing this repository does not perform these server-side steps. Migration completed on 2026-11-17. See DEPLOYED.md for the live deployment and rollback procedure.
