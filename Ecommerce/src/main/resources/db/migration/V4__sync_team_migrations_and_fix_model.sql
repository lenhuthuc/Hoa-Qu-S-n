-- V4: Apply missing team migrations and fix product schema
-- This script consolidates logical changes from newer team scripts (10-12) 
-- and ensures the product table matches the JPA entity model.

-- 1. Updates for ORDERS (from team script 10 & 12)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_id BIGINT REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_master_order BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_orders_parent_order_id ON orders(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);

-- 2. Updates for PRODUCT (Missing columns required by Product.java)
ALTER TABLE product ADD COLUMN IF NOT EXISTS seller_id BIGINT REFERENCES users(id);
ALTER TABLE product ADD COLUMN IF NOT EXISTS shelf_life_days INTEGER;
ALTER TABLE product ADD COLUMN IF NOT EXISTS total_stock_weight_kg DECIMAL(12, 3);
ALTER TABLE product ADD COLUMN IF NOT EXISTS unit_weight_grams BIGINT;
ALTER TABLE product ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;
ALTER TABLE product ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50);
ALTER TABLE product ADD COLUMN IF NOT EXISTS origin VARCHAR(255);
ALTER TABLE product ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES categories(id);

-- 3. RETURN REQUESTS table (from team script 10 & 11)
CREATE TABLE IF NOT EXISTS return_request (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    buyer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason_code VARCHAR(50) NOT NULL,
    description TEXT,
    evidence_urls TEXT,
    refund_amount DECIMAL(12,2),
    status VARCHAR(50) NOT NULL,
    seller_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deadline TIMESTAMPTZ
);

ALTER TABLE return_request DROP CONSTRAINT IF EXISTS return_request_status_check;
ALTER TABLE return_request ADD CONSTRAINT return_request_status_check
    CHECK (status IN ('PENDING', 'SELLER_REVIEWING', 'NEGOTIATING', 'APPROVED', 'REJECTED', 'REJECTED_ACCEPTED', 'ESCALATED', 'REFUNDED'));

-- 4. VOUCHERS table (New table required by Voucher.java)
CREATE TABLE IF NOT EXISTS vouchers (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(500),
    discount_type VARCHAR(20) NOT NULL,
    discount_value DECIMAL(12,2) NOT NULL,
    min_order_amount DECIMAL(12,2),
    max_discount DECIMAL(12,2),
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    seller_id BIGINT REFERENCES users(id),
    created_at TIMESTAMP
);
