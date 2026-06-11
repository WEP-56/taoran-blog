#!/usr/bin/env bash
# 每日备份：content/ + SQLite 一致性副本 → tar.gz（docs/07-data.md §6）
# cron 示例：30 3 * * * /srv/taoran/deploy/backup.sh /srv/taoran /backups
set -euo pipefail

REPO_ROOT="${1:?用法: backup.sh <仓库根目录> <备份输出目录>}"
OUT_DIR="${2:?用法: backup.sh <仓库根目录> <备份输出目录>}"
KEEP=30

STAMP=$(date +%Y%m%d-%H%M%S)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# SQLite 热备：VACUUM INTO 产出一致性副本（不锁写）
sqlite3 "$REPO_ROOT/data/taoran.db" "VACUUM INTO '$WORK/taoran.db'"

mkdir -p "$OUT_DIR"
tar -czf "$OUT_DIR/taoran-$STAMP.tar.gz" \
  -C "$REPO_ROOT" content \
  -C "$WORK" taoran.db

# 滚动保留最近 $KEEP 份
ls -1t "$OUT_DIR"/taoran-*.tar.gz | tail -n +$((KEEP + 1)) | xargs -r rm --

echo "✓ taoran-$STAMP.tar.gz"
