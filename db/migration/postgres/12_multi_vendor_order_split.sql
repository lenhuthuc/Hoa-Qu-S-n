ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS seller_id BIGINT REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS parent_order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS is_master_order BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_orders_parent_order_id ON orders(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_parent_created ON orders(user_id, parent_order_id, created_at DESC);
