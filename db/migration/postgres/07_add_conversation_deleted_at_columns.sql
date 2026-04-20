ALTER TABLE conversation
  ADD COLUMN IF NOT EXISTS deleted_at_buyer TIMESTAMP;

ALTER TABLE conversation
  ADD COLUMN IF NOT EXISTS deleted_at_seller TIMESTAMP;
