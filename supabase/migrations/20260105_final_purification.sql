-- ==============================================================================
-- MIGRATION: FINAL PURIFICATION (2026-01-05)
-- DESCRIPTION: Elevates Implicit Concepts (Plans, Rules) to First-Class Tables.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. INSTALLMENT PLANS (Agrupamento de Parcelas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.installment_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    total_installments INTEGER NOT NULL,
    purchase_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.installment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_plans" ON public.installment_plans FOR ALL USING (user_id = auth.uid());

-- Link Transactions to Plan
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS installment_plan_id UUID REFERENCES public.installment_plans(id) ON DELETE SET NULL;


-- ==============================================================================
-- 2. RECURRING RULES (Assinaturas e Custos Fixos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.recurring_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC, -- Can be null if it varies (e.g. Electric Bill)
    category TEXT,
    frequency TEXT NOT NULL, -- 'MONTHLY', 'WEEKLY', 'YEARLY'
    active BOOLEAN DEFAULT TRUE,
    last_generated DATE,
    next_due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_rules" ON public.recurring_rules FOR ALL USING (user_id = auth.uid());

-- Link Transactions to Rule
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recurring_rule_id UUID REFERENCES public.recurring_rules(id) ON DELETE SET NULL;


-- ==============================================================================
-- 3. UNIFIED CATEGORIES (Padronização)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id), -- NULL for System Defaults
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    type TEXT, -- 'INCOME', 'EXPENSE'
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "access_categories" ON public.categories FOR ALL USING (
    (is_system = true) OR (user_id = auth.uid())
);

-- Note: We do not force FK on transactions.category yet to avoid breaking current string storage.


-- ==============================================================================
-- 4. CREDIT CARD STATEMENTS (Fechamento de Fatura)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.statements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT DEFAULT 'OPEN', -- 'OPEN', 'CLOSED', 'PAID'
    closing_date DATE,
    due_date DATE,
    total_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_statements" ON public.statements FOR ALL USING (
    EXISTS (SELECT 1 FROM accounts a WHERE a.id = account_id AND a.user_id = auth.uid())
);

-- Link Transactions to Statement
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS statement_id UUID REFERENCES public.statements(id) ON DELETE SET NULL;


-- ==============================================================================
-- AUTO-DISCOVERY BACKFILL (Best Effort)
-- ==============================================================================

-- 1. Create Installment Plans from existing transactions
-- Logic: Group by description + total_installments + amount? No, risky.
-- Installment grouping without IDs is hard. We skip Auto-Backfill for Installments to avoid incorrect merging.
-- Users will start using Plans for NEW purchases.

COMMIT;
