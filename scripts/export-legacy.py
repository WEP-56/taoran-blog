"""Export a backed-up Taoran content archive + SQLite snapshot to transactional SQL.
Usage: python3 scripts/export-legacy.py content.tar.gz taoran.db output-directory
Requires PyYAML (available on the source Ubuntu server). No live files are modified.
"""
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys
import tarfile
from urllib.parse import quote
from zoneinfo import ZoneInfo
import yaml

archive, database, destination = map(Path, sys.argv[1:])
destination.mkdir(parents=True, exist_ok=True)
db = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
db.row_factory = sqlite3.Row
source_posts = {r['slug']: dict(r) for r in db.execute('select * from posts')}
source_comments = [dict(r) for r in db.execute('select * from comments')]
selected = []
images = []
with tarfile.open(archive) as tar:
    members = {m.name: m for m in tar.getmembers() if m.isfile()}
    for name in sorted(members):
        if not name.startswith('content/posts/') or not name.endswith('/index.mdx'):
            continue
        raw = tar.extractfile(members[name]).read().decode('utf-8')
        _, front, body = raw.split('---', 2)
        meta = yaml.safe_load(front)
        date = dt.datetime.fromisoformat(str(meta['date']).replace('Z', '+00:00'))
        if date.tzinfo is None:
            date = date.replace(tzinfo=ZoneInfo('Asia/Shanghai'))
        day = date.astimezone(ZoneInfo('Asia/Shanghai')).date().isoformat()
        if not '2026-06-12' <= day <= '2026-11-10':
            continue
        slug = meta['slug']
        old = source_posts.get(slug, {})
        def image_url(match):
            relative = match.group(2)
            if not relative.startswith('./'):
                return match.group(0)
            source = str(Path(name).parent / relative[2:]).replace('\\', '/')
            if source not in members or '..' in Path(relative).parts:
                raise ValueError(f'Missing or unsafe image: {name}: {relative}')
            filename = Path(relative).name
            target = destination / 'assets' / slug / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(tar.extractfile(members[source]).read())
            url = '/legacy-assets/' + quote(slug) + '/' + quote(filename)
            images.append(url)
            return match.group(1) + url + match.group(3)
        body = re.sub(r'(!\[[^\]]*\]\()([^\)]+)(\))', image_url, body)
        selected.append(dict(slug=slug, title=meta['title'], summary=meta.get('summary', ''),
            content=body, tags=meta.get('tags', []), category=(meta.get('tags') or ['随笔'])[0],
            pinned=bool(meta.get('pinned')), status='published' if meta.get('status') == 'published' else 'draft',
            views=int(old.get('views_count', 0)), likes=int(old.get('likes_count', 0)),
            published_at=day, created_at=date.isoformat(), reading_minutes=max(1, (len(body)+799)//800),
            source_sha256=hashlib.sha256(raw.encode()).hexdigest()))
    friends = json.loads(tar.extractfile(members['content/friends.json']).read())['friends']

slugs = {p['slug'] for p in selected}
comments = [c for c in source_comments if c['post_slug'] in slugs]
daily = [dict(r) for r in db.execute('select * from views_daily') if r['post_slug'] in slugs]
report = dict(window=['2026-06-12','2026-11-10'], timezone='Asia/Shanghai',
    posts=[{k:p[k] for k in ['slug','title','published_at','status','views','likes','source_sha256']} for p in selected],
    comments=len(comments), approved_comments=sum(c['state']=='ok' for c in comments),
    hidden_comments=sum(c['state']!='ok' for c in comments), friends=len(friends),
    views=sum(p['views'] for p in selected), likes=sum(p['likes'] for p in selected),
    assets=images, legacy_daily_rows=len(daily), excluded_database_slugs=sorted(set(source_posts)-slugs))

def literal(value):
    if value is None: return 'NULL'
    if isinstance(value, bool): return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int,float)): return str(value)
    if isinstance(value, (dict,list)): value=json.dumps(value,ensure_ascii=False)
    return "'"+str(value).replace("'","''")+"'"

sql = ["BEGIN;", "SELECT pg_advisory_xact_lock(72401933);",
    "DO $$ BEGIN IF EXISTS (SELECT 1 FROM posts) OR EXISTS (SELECT 1 FROM comments) OR EXISTS (SELECT 1 FROM friend_links) THEN RAISE EXCEPTION 'Target must be empty'; END IF; END $$;",
    "CREATE TABLE IF NOT EXISTS legacy_import (id integer PRIMARY KEY, imported_at timestamptz DEFAULT now(), manifest jsonb NOT NULL, comment_metadata jsonb NOT NULL, daily_views jsonb NOT NULL);"]
for post in selected:
    values = {k:v for k,v in post.items() if k != 'source_sha256'}
    sql.append('INSERT INTO posts ('+','.join(values)+') VALUES ('+','.join(map(literal,values.values()))+');')
for c in comments:
    # The old system stored email hashes, not email addresses; do not invent email/admin identity.
    values=[c['post_slug'],c['author_name'],'',c.get('author_site') or '',c['body_md'],False,c['state']=='ok',dt.datetime.fromtimestamp(c['created_at'],dt.timezone.utc).isoformat()]
    sql.append('INSERT INTO comments (post_id,post_slug,author_name,author_email,author_url,content,is_admin,approved,created_at) VALUES ((SELECT id FROM posts WHERE slug='+literal(c['post_slug'])+'),'+','.join(map(literal,values))+');')
for i,f in enumerate(friends):
    sql.append('INSERT INTO friend_links (name,url,description,avatar_url,sort_order) VALUES ('+','.join(map(literal,[f['name'],f['url'],f.get('desc',''),f.get('avatar',''),i]))+');')
metadata=[{k:c[k] for k in ['id','post_slug','parent_id','state','created_at']} for c in comments]
sql.append('INSERT INTO legacy_import(id,manifest,comment_metadata,daily_views) VALUES (1,'+','.join(map(literal,[report,metadata,daily]))+');')
sql.append('COMMIT;')
(destination/'import.sql').write_text('\n'.join(sql)+'\n',encoding='utf-8')
(destination/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ['posts','assets']},ensure_ascii=True))
