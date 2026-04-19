ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ;

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

CREATE INDEX IF NOT EXISTS idx_return_request_buyer_id_created_at
    ON return_request (buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_return_request_seller_id_created_at
    ON return_request (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_return_request_status
    ON return_request (status);