-- Traceability data model for linking Story -> persistent milestones
ALTER TABLE IF EXISTS farming_batches
    ADD COLUMN IF NOT EXISTS batch_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS qr_code_value TEXT,
    ADD COLUMN IF NOT EXISTS start_date DATE;

UPDATE farming_batches
SET batch_name = COALESCE(NULLIF(batch_name, ''), NULLIF(product_name, ''), batch_id)
WHERE batch_name IS NULL OR batch_name = '';

UPDATE farming_batches
SET start_date = COALESCE(start_date, planted_at)
WHERE start_date IS NULL;

CREATE TABLE IF NOT EXISTS trace_milestones (
    id BIGSERIAL PRIMARY KEY,
    batch_id VARCHAR(100) NOT NULL,
    story_id BIGINT,
    seller_id BIGINT NOT NULL,
    title VARCHAR(300),
    note TEXT,
    activity_type VARCHAR(50),
    media_url VARCHAR(1000),
    media_type VARCHAR(16),
    captured_at TIMESTAMP,
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    metadata_missing BOOLEAN NOT NULL DEFAULT FALSE,
    has_audio BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trace_milestones_batch_id_created_at
    ON trace_milestones (batch_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_trace_milestones_story_id
    ON trace_milestones (story_id);

CREATE INDEX IF NOT EXISTS idx_farming_batches_batch_name
    ON farming_batches (batch_name);