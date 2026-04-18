-- Story enhancements for 24h TTL and anti-fraud metadata
ALTER TABLE IF EXISTS story
    ADD COLUMN IF NOT EXISTS media_url VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS media_type VARCHAR(16),
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS captured_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS has_audio BOOLEAN,
    ADD COLUMN IF NOT EXISTS metadata_missing BOOLEAN DEFAULT FALSE;

UPDATE story
SET expires_at = COALESCE(expires_at, created_at + INTERVAL '24 hours')
WHERE created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_story_seller_created_at ON story (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_expires_at ON story (expires_at);
CREATE INDEX IF NOT EXISTS idx_story_published_expires ON story (is_published, expires_at);
