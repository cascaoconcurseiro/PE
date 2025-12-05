-- ========================================
-- CREATE USER_SETTINGS TABLE
-- ========================================
-- This table stores user preferences and settings
-- Run this in Supabase SQL Editor to fix React Error #426

CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Settings as JSONB for flexibility
    notifications JSONB DEFAULT '{
        "enableBillReminders": true,
        "enableBudgetAlerts": true,
        "enableGoalReminders": true,
        "reminderDaysBefore": 3,
        "preferredNotificationTime": "09:00"
    }'::jsonb,
    
    security JSONB DEFAULT '{
        "twoFactorEnabled": false,
        "activeSessions": [],
        "loginHistory": []
    }'::jsonb,
    
    preferences JSONB DEFAULT '{
        "language": "pt-BR",
        "dateFormat": "DD/MM/YYYY",
        "timeFormat": "24h",
        "weekStartsOn": "monday",
        "defaultCurrency": "BRL"
    }'::jsonb,
    
    privacy JSONB DEFAULT '{
        "shareAnalytics": false,
        "hideBalanceInSharedScreens": false,
        "familyMemberPermissions": {}
    }'::jsonb,
    
    appearance JSONB DEFAULT '{
        "fontSize": "medium",
        "density": "comfortable",
        "customCategoryColors": {}
    }'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one settings record per user
    UNIQUE(user_id)
);

-- ========================================
-- ENABLE ROW LEVEL SECURITY
-- ========================================
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ========================================
-- CREATE RLS POLICIES
-- ========================================
-- Users can only access their own settings
CREATE POLICY "Users can view their own settings"
ON public.user_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
ON public.user_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.user_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings"
ON public.user_settings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- CREATE INDEXES
-- ========================================
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id 
ON public.user_settings(user_id);

-- ========================================
-- CREATE UPDATED_AT TRIGGER
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- VERIFICATION
-- ========================================
-- Check if table was created successfully
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_settings'
    ) THEN
        RAISE NOTICE '✅ Table user_settings created successfully!';
    ELSE
        RAISE EXCEPTION '❌ Failed to create user_settings table';
    END IF;
END $$;
