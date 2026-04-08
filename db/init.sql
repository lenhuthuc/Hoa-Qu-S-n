-- ══════════════════════════════════════════════════════
-- Hoa Quả Sơn — PostgreSQL Schema (new tables only)
-- Existing MySQL ecommerce tables remain untouched.
-- This DB is used for: traceability, shipping, analytics
-- ══════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";   -- pgvector for semantic search

-- ─── Product Catalog Mirror (for pgvector search) ───
CREATE TABLE IF NOT EXISTS product_embeddings (
    id              BIGSERIAL PRIMARY KEY,
    product_id      BIGINT NOT NULL UNIQUE,           -- FK to MySQL product.id
    product_name    TEXT NOT NULL,
    description     TEXT,
    category        TEXT,
    price           NUMERIC(12,2),
    embedding       vector(768),                       -- text-embedding vector
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_embedding ON product_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── Farming Journal (also stored in MongoDB for flexibility) ───
CREATE TABLE IF NOT EXISTS farming_batches (
    id              BIGSERIAL PRIMARY KEY,
    batch_id        VARCHAR(50) NOT NULL UNIQUE,      -- e.g. "BATCH-2026-001"
    seller_id       BIGINT NOT NULL,
    product_name    VARCHAR(255),
    crop_type       VARCHAR(100),
    planted_at      DATE,
    harvest_at      DATE,
    status          VARCHAR(20) DEFAULT 'GROWING',    -- GROWING, HARVESTED, SOLD
    qr_code_url     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Shipping Validation Cache ───
CREATE TABLE IF NOT EXISTS shipping_rules (
    id              BIGSERIAL PRIMARY KEY,
    product_id      BIGINT NOT NULL,
    shelf_life_days INT NOT NULL DEFAULT 7,            -- shelf life in days
    max_etd_days    INT NOT NULL DEFAULT 5,            -- max delivery days allowed
    fragile         BOOLEAN DEFAULT FALSE,
    cold_chain      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farming_batches_seller_id ON farming_batches(seller_id);

-- ─── Livestream Sessions ───
CREATE TABLE IF NOT EXISTS livestream_sessions (
    id              BIGSERIAL PRIMARY KEY,
    seller_id       BIGINT NOT NULL,
    stream_key      VARCHAR(100) NOT NULL UNIQUE,
    title           VARCHAR(255),
    status          VARCHAR(20) DEFAULT 'CREATED',    -- CREATED, LIVE, ENDED
    viewer_count    INT DEFAULT 0,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Market Price Reference (for AI price suggestion) ───
CREATE TABLE IF NOT EXISTS market_prices (
    id              BIGSERIAL PRIMARY KEY,
    product_name    VARCHAR(255) NOT NULL,
    category        VARCHAR(100),
    region          VARCHAR(100) DEFAULT 'Vietnam',
    avg_price       NUMERIC(12,2) NOT NULL,
    min_price       NUMERIC(12,2),
    max_price       NUMERIC(12,2),
    unit            VARCHAR(20) DEFAULT 'kg',
    source          VARCHAR(100),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed market prices for common Vietnamese fruits
INSERT INTO market_prices (product_name, category, avg_price, min_price, max_price, unit, source) VALUES
('Xoài cát Hòa Lộc',    'Trái cây', 85000, 60000, 120000, 'kg', 'market_survey'),
('Sầu riêng Ri6',       'Trái cây', 150000, 100000, 220000, 'kg', 'market_survey'),
('Thanh long ruột đỏ',  'Trái cây', 35000, 20000, 55000, 'kg', 'market_survey'),
('Bưởi da xanh',        'Trái cây', 45000, 30000, 65000, 'kg', 'market_survey'),
('Chôm chôm',           'Trái cây', 25000, 15000, 40000, 'kg', 'market_survey'),
('Măng cụt',            'Trái cây', 55000, 35000, 80000, 'kg', 'market_survey'),
('Nhãn lồng',           'Trái cây', 40000, 25000, 60000, 'kg', 'market_survey'),
('Vải thiều',           'Trái cây', 45000, 30000, 70000, 'kg', 'market_survey'),
('Mít Thái',            'Trái cây', 30000, 18000, 50000, 'kg', 'market_survey'),
('Dưa hấu',             'Trái cây', 12000, 5000, 20000, 'kg', 'market_survey'),
('Cam sành',            'Trái cây', 25000, 15000, 40000, 'kg', 'market_survey'),
('Ổi',                  'Trái cây', 20000, 10000, 35000, 'kg', 'market_survey'),
('Chuối',               'Trái cây', 15000, 8000, 25000, 'kg', 'market_survey'),
('Dừa tươi',            'Trái cây', 20000, 12000, 35000, 'trái', 'market_survey'),
('Bơ 034',              'Trái cây', 60000, 40000, 90000, 'kg', 'market_survey'),
('Rau muống',           'Rau củ', 8000, 5000, 15000, 'bó', 'market_survey'),
('Cà chua',             'Rau củ', 15000, 8000, 25000, 'kg', 'market_survey'),
('Khoai lang',          'Rau củ', 12000, 7000, 20000, 'kg', 'market_survey'),
('Gạo ST25',            'Lương thực', 22000, 18000, 28000, 'kg', 'market_survey'),
('Mật ong rừng',        'Đặc sản', 350000, 250000, 500000, 'lít', 'market_survey');
