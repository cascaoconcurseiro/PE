-- Migration: Atomic Integrity Operations
-- Date: 2026-01-16
-- Description: Introduces RPCs for atomic operations to prevent split-brain states in the frontend.

-- 1. Atomic Cascade Delete for Trips
-- Ensures that deleting a trip AND unlinking its transactions happens in a single transaction block.
CREATE OR REPLACE FUNCTION delete_trip_cascade_rpc(
    p_trip_id UUID, 
    p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Soft Delete the Trip
    UPDATE public.trips
    SET 
        deleted = true,
        updated_at = NOW()
    WHERE id = p_trip_id AND user_id = p_user_id;

    -- 2. Unlink associated Transactions
    -- Note: transactions.trip_id is TEXT (legacy), so we cast p_trip_id
    UPDATE public.transactions
    SET 
        trip_id = NULL,
        updated_at = NOW()
    WHERE trip_id = p_trip_id::text AND user_id = p_user_id;

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete trip cascade: %', SQLERRM;
END;
$$;
