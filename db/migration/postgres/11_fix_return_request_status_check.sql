-- Fix status check constraint for return_request to support post-rejection flow
-- This script is safe to run multiple times.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'return_request'
    ) THEN
        -- Drop known old check name if present
        ALTER TABLE return_request DROP CONSTRAINT IF EXISTS return_request_status_check;

        -- Recreate a compatible constraint including legacy and new statuses
        ALTER TABLE return_request
            ADD CONSTRAINT return_request_status_check
            CHECK (
                status IN (
                    'PENDING',
                    'SELLER_REVIEWING',
                    'NEGOTIATING',
                    'APPROVED',
                    'REJECTED',
                    'REJECTED_ACCEPTED',
                    'ESCALATED',
                    'REFUNDED'
                )
            );
    END IF;
END $$;
