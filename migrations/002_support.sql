CREATE TABLE support_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content JSONB NOT NULL DEFAULT '{"reason":"","declaration":"","thanks":"","channels":[],"supporters":[]}'::jsonb,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
INSERT INTO support_settings (id) VALUES (1);
