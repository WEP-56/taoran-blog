
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      site_name TEXT NOT NULL DEFAULT 'WEP',
      site_tagline TEXT NOT NULL DEFAULT '',
      intro_zh TEXT NOT NULL,
      intro_en TEXT NOT NULL,
      author_name TEXT NOT NULL DEFAULT 'WEP',
      author_role TEXT NOT NULL DEFAULT '',
      footer_text TEXT NOT NULL DEFAULT '以留白盛放思想',
      about_markdown TEXT NOT NULL DEFAULT '',
      now_status TEXT NOT NULL DEFAULT '',
      social_links JSONB NOT NULL DEFAULT '[]'::jsonb,
      shader_mode TEXT NOT NULL DEFAULT 'subtle',
      admin_passcode TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );


    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '随笔',
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      cover_image TEXT DEFAULT '',
      pinned BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'published',
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      reading_minutes INTEGER NOT NULL DEFAULT 3,
      published_at TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );


    CREATE TABLE IF NOT EXISTS moments (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT '日常',
      location TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      likes INTEGER NOT NULL DEFAULT 0,
      published_at TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );


    CREATE TABLE IF NOT EXISTS gallery_items (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      caption TEXT NOT NULL,
      image_url TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      camera_spec TEXT NOT NULL DEFAULT '',
      taken_at TEXT NOT NULL,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );


    CREATE TABLE IF NOT EXISTS friend_links (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      avatar_url TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );


    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL,
      post_slug TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_email TEXT DEFAULT '',
      author_url TEXT DEFAULT '',
      content TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      approved BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );


    CREATE TABLE IF NOT EXISTS page_views (
      id SERIAL PRIMARY KEY,
      path TEXT NOT NULL,
      post_slug TEXT DEFAULT '',
      visitor_hash TEXT NOT NULL,
      device TEXT NOT NULL DEFAULT 'Desktop',
      referrer TEXT DEFAULT 'direct',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
CREATE INDEX IF NOT EXISTS posts_status_date_idx ON posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS comments_post_idx ON comments(post_id, approved, created_at DESC);
CREATE INDEX IF NOT EXISTS views_date_idx ON page_views(created_at DESC);
ALTER TABLE site_settings ALTER COLUMN admin_passcode SET DEFAULT '';
ALTER TABLE comments ALTER COLUMN approved SET DEFAULT FALSE;
INSERT INTO site_settings(id, intro_zh, intro_en) VALUES (1, '欢迎你的到来', 'Welcome') ON CONFLICT DO NOTHING;
