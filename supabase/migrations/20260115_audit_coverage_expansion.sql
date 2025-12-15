-- 20260115_audit_coverage_expansion.sql
-- PURPOSE: Ensure Goals and Budgets tables exist and have Audit Triggers attached.
-- This fixes the gap where these entities existed in Schema but lacked Audit Logging.

-- 1. Ensure 'goals' table exists
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT, 
    target_amount NUMERIC, 
    current_amount NUMERIC, 
    deadline DATE, 
    icon TEXT, 
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), 
    deleted BOOLEAN DEFAULT FALSE
);

-- 2. Ensure 'budgets' table exists
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id TEXT, 
    amount NUMERIC, 
    period TEXT, 
    alert_threshold INTEGER, 
    rollover BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), 
    deleted BOOLEAN DEFAULT FALSE
);

-- 3. Attach Audit Triggers (Goals)
DROP TRIGGER IF EXISTS tr_audit_goals ON public.goals;
CREATE TRIGGER tr_audit_goals
    AFTER INSERT OR UPDATE OR DELETE ON public.goals
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_changes();

-- 4. Attach Audit Triggers (Budgets)
DROP TRIGGER IF EXISTS tr_audit_budgets ON public.budgets;
CREATE TRIGGER tr_audit_budgets
    AFTER INSERT OR UPDATE OR DELETE ON public.budgets
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_changes();

-- 5. Attach Audit Triggers (Custom Categories - Extra Safety)
DROP TRIGGER IF EXISTS tr_audit_custom_categories ON public.custom_categories;
CREATE TRIGGER tr_audit_custom_categories
    AFTER INSERT OR UPDATE OR DELETE ON public.custom_categories
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_changes();
