-- ==============================================================================
-- MIGRATION: SAFEGUARD SCHEMA FIX (RESET PROTECTION)
-- DATE: 2025-12-15
-- DESCRIPTION: Ensures user_notifications table has BOTH 'data' and 'metadata' 
--              columns to prevent crashes after factory resets or legacy code usage.
-- ==============================================================================

BEGIN;

-- 1. Ensure Table Exists (Safety Check)
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure 'data' column exists (Legacy/Frontend Compatibility)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'data') THEN
        ALTER TABLE public.user_notifications ADD COLUMN data JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Column "data" added to user_notifications.';
    END IF;
END $$;

-- 3. Ensure 'metadata' column exists (New System Manual Standard)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'metadata') THEN
        ALTER TABLE public.user_notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Column "metadata" added to user_notifications.';
    END IF;
END $$;

-- 4. Ensure 'is_read' vs 'read' Safety
-- The system seems to use 'is_read' in backend but 'read' might be in legacy definition.
-- Let's ensure 'is_read' exists as the standard.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'is_read') THEN
        ALTER TABLE public.user_notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Column "is_read" added to user_notifications.';
    END IF;
END $$;

COMMIT;
