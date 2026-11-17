# Live deployment — 2026-11-17

- App: `/opt/wep-blog`, Docker Compose project `wep-blog`, file `compose.vps.yaml`.
- Main site: https://taoran.weppp.cyou ; Studio: https://taoran.weppp.cyou/admin .
- `admin.weppp.cyou` redirects to Studio; the temporary IP preview on port 3139 redirects to the main site.
- Existing host Caddy terminates HTTPS and proxies to `127.0.0.1:3138`. Other site blocks and containers remain unchanged.
- Local legacy images live in `/opt/wep-blog/legacy-assets`, served by Caddy at `/legacy-assets/*`. Back up this directory with the database. It is intentionally excluded from Git and Docker build context.

Migrated six existing articles in the inclusive 2026-06-12 to 2026-11-10 window, eight approved comments, two hidden/deleted comments, ten friend links, 651 article views and 298 likes. Articles in the old recycle bin were not republished. Moments and gallery are empty. The `legacy_import` table preserves the manifest, original comment IDs/parent relationships/moderation states and 188 daily view aggregates. The current comment UI is flat; only hidden comments have a parent relationship in this migrated set. Legacy email hashes were not treated as email addresses, and historical unique visitor counts were not invented.

The old service `taoran-server` is stopped and disabled. Its checkout `/opt/taoran-blog` and all original content remain. Consistent SQLite/content snapshots, old environment, service unit and Caddy backups are root-only under `/var/backups/wep-migration`. The final snapshot path is recorded in `cutover-latest`; the original pre-preview Caddy configuration is `Caddyfile.before-preview`. New database backups: `new-preview.dump` and `new-live.dump`.

To update, first back up the PostgreSQL database and legacy assets, then from `/opt/wep-blog` run `git pull --ff-only` and `docker compose -f compose.vps.yaml up -d --build`. Do not run the default `compose.yaml` on this VPS because it would compete with host Caddy for ports 80/443. Do not rerun the one-time import against a live database.

Rollback requires accounting for any new writes made on the new site. Take a fresh PostgreSQL backup first. Then enable/start `taoran-server`, verify `http://127.0.0.1:8787/api/health`, validate the saved original Caddy configuration, restore it to `/etc/caddy/Caddyfile` and reload Caddy. This redirects traffic to the retained old checkout. New comments/articles created after cutover will need reconciliation rather than being discarded. Do not delete either database volume or old checkout during rollback.

Admin credentials are stored in `/opt/wep-blog/.env` (root-only); the initial password was also delivered to the owner's local `output/deploy/studio-access.txt`, outside Git. Once the Studio password has changed, the database hash is authoritative and the environment password is no longer used for login.
