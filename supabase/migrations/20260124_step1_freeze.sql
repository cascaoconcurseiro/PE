-- ==============================================================================
-- MIGRATION: STEP 1 - FREEZE PRODUCTION (SAFE MODE)
-- DATA: 2026-01-24
-- OBJ: Impedir corrupção por concorrência e garantir apenas escritas validadas.
-- ==============================================================================

BEGIN;

-- 1. FEATURE FLAGS & CONFIG TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_flags (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on flags
ALTER TABLE public.system_flags ENABLE ROW LEVEL SECURITY;

-- Default: Maintenance Mode is ON (Freeze Direct Writes) by default during migration?
-- Or "Safe Mode" where only RPCs work.
INSERT INTO public.system_flags (key, value, description)
VALUES 
    ('maintenance_mode', 'true', 'If true, blocks direct client writes (INSERT/UPDATE/DELETE) via RLS.'),
    ('feature_shared_mirroring', 'false', 'Legacy shared mirroring (Disabled).'),
    ('feature_json_sync', 'false', 'Legacy JSON split sync (Disabled).')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. DISABLE LEGACY TRIGGERS (Source of Corruption)
-- ------------------------------------------------------------------------------

-- A) Disable JSON Sync (Splits)
DROP TRIGGER IF EXISTS trg_sync_json_splits ON public.transactions;
DROP FUNCTION IF EXISTS public.sync_json_splits();

-- B) Disable Shared Mirroring (Se existir)
DROP TRIGGER IF EXISTS trg_mirror_shared_transaction ON public.transactions;
DROP TRIGGER IF EXISTS trg_update_shared_transaction ON public.transactions;


-- 3. ENFORCE "WRITE-ONLY VIA BACKEND" (RLS FREEZE)
-- ------------------------------------------------------------------------------
-- Criamos uma policy que BLOQUEIA Insert/Update/Delete direto pelo Client
-- se a flag 'maintenance_mode' estiver 'true'.
-- Como RPCs são SECURITY DEFINER, elas bypassam RLS e continuam funcionando.

-- Policy function lookup to avoid recursion issues or perf hit?
-- Postgres caches stable functions. Let's make a clear check.

CREATE OR REPLACE FUNCTION public.is_system_active()
RETURNS BOOLEAN AS $$
DECLARE
    v_mode TEXT;
BEGIN
    SELECT value INTO v_mode FROM public.system_flags WHERE key = 'maintenance_mode';
    -- Se maintenance_mode = 'true', retornamos FALSE (System NOT active for direct writes)
    IF (v_mode = 'true') THEN
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Aplica Policies de Bloqueio em Transactions
-- (Estamos adicionando uma Restrictive Policy? Ou alterando as existentes?)
-- O Supabase soma policies (OR). Se eu adicionar uma que retorna false, não adianta se outra retorna true.
-- Para BLOQUEAR, precisamos que TODAS falhem ou usar RLS "RESTRICTIVE" (PG 10+ supports AS RESTRICTIVE).
-- Supabase PG version suporta 'CREATE POLICY ... AS RESTRICTIVE'.

-- Bloqueia INSERT/UPDATE/DELETE se maintenance_mode = true
CREATE POLICY "System Freeze - Maintenance Mode"
    ON public.transactions
    AS RESTRICTIVE  -- Garante que esta policy DEVE ser passar, além das outras (Permissive).
    FOR ALL
    USING (public.is_system_active());

-- Aplica a mesma proteção para outras tabelas críticas
CREATE POLICY "System Freeze - Maintenance Mode"
    ON public.transaction_splits
    AS RESTRICTIVE
    FOR ALL
    USING (public.is_system_active());

CREATE POLICY "System Freeze - Maintenance Mode"
    ON public.trips
    AS RESTRICTIVE
    FOR ALL
    USING (public.is_system_active());

-- NOTA: Como 'is_system_active' é SECURITY DEFINER, ela lê a tabela flags.
-- Quando o Client chama insert direto, o is_system_active() retorna FALSE -> RLS Block.
-- Quando o Client chama RPC (Security Definer), o RPC roda como Owner -> Bypass RLS -> Sucesso.

COMMIT;
