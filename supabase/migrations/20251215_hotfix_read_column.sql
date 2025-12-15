-- ==============================================================================
-- MIGRATION: HOTFIX READ COLUMN
-- DATE: 2025-12-15
-- DESCRIPTION: Adds 'read' column to user_notifications to satisfy legacy triggers.
--              Also ensures 'is_read' exists for newer code.
-- ==============================================================================

BEGIN;

-- 1. Ensure 'read' column exists (Legacy Trigger Requirement)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'read') THEN
        ALTER TABLE public.user_notifications ADD COLUMN "read" BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Column "read" added to user_notifications.';
    END IF;
END $$;

-- 2. Ensure 'is_read' column exists (New Standard)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_notifications' AND column_name = 'is_read') THEN
        ALTER TABLE public.user_notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Column "is_read" added to user_notifications.';
    END IF;
END $$;

-- 3. Update Trigger to handle both? 
-- The error came from "Add Family Member" -> `invite_user_to_family`.
-- Let's redefine `invite_user_to_family` to be safe and use explicitly available columns if possible,
-- OR simply rely on the column addition above which fixes the strict SQL error.
-- SAFE OPTION: Just adding the column fixes the immediate crash.

COMMIT;
