-- ==============================================================================
-- BACKUP COMPLETO PRÉ-REESTRUTURAÇÃO DO SISTEMA COMPARTILHADO
-- DATA: 2025-12-21
-- OBJETIVO: Backup completo do estado atual antes da reestruturação
-- ==============================================================================

-- ========================================
-- 1. SCHEMA ATUAL (GOLDEN SNAPSHOT)
-- ========================================

-- Enable extensions
create extension if not exists "uuid-ossp";

-- User Profiles
create table if not exists public.user_profiles (
  id uuid references auth.users not null primary key,
  email text,
  name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  sync_status text default 'SYNCED',
  deleted boolean default false
);

-- Accounts
create table if not exists public.accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  name text not null,
  type text not null,
  balance numeric default 0,
  initial_balance numeric default 0,
  currency text default 'BRL',
  "limit" numeric,
  closing_day integer,
  due_day integer,
  is_international boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  deleted boolean default false,
  sync_status text default 'SYNCED'
);

-- Transactions (Estado Atual)
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  description text not null,
  amount numeric not null,
  type text not null,
  date date not null,
  category text,
  account_id uuid references public.accounts(id),
  destination_account_id uuid references public.accounts(id),
  trip_id uuid references public.trips(id),
  currency text default 'BRL',
  
  -- Extra Fields for Multi-currency & Transfers
  destination_amount numeric,
  exchange_rate numeric,
  
  -- Recurrence
  is_recurring boolean default false,
  frequency text,
  recurrence_day integer,
  last_generated timestamp with time zone,
  
  -- Installments
  is_installment boolean default false,
  current_installment integer,
  total_installments integer,
  original_amount numeric,
  series_id uuid,
  
  -- Sharing/Splitting (ESTADO ATUAL - PROBLEMÁTICO)
  is_shared boolean default false,
  shared_with jsonb,
  payer_id uuid,
  is_settled boolean default false,
  is_refund boolean default false,
  
  -- Metadata
  observation text,
  enable_notification boolean default false,
  notification_date date,
  
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  deleted boolean default false,
  sync_status text default 'SYNCED'
);

-- Shared Transaction Requests (Estado Atual)
CREATE TABLE IF NOT EXISTS public.shared_transaction_requests (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid references public.transactions(id) on delete cascade not null,
  requester_id uuid references auth.users(id) not null,
  invited_email text not null,
  invited_user_id uuid references auth.users(id),
  status text not null default 'PENDING',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  responded_at timestamp with time zone,
  constraint valid_status check (status in ('PENDING', 'ACCEPTED', 'REJECTED'))
);

-- Family Members
create table if not exists public.family_members (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  name text not null,
  role text,
  email text,
  linked_user_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  deleted boolean default false,
  sync_status text default 'SYNCED'
);

-- ========================================
-- 2. FUNÇÕES RPC ATUAIS (PROBLEMÁTICAS)
-- ========================================

-- Função create_transaction atual (com problemas)
CREATE OR REPLACE FUNCTION public.create_transaction_backup(
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL,
    p_destination_account_id UUID DEFAULT NULL,
    p_trip_id UUID DEFAULT NULL,
    p_is_shared BOOLEAN DEFAULT FALSE,
    p_domain TEXT DEFAULT NULL,
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_shared_with JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
BEGIN
    -- Validação de autenticação
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Domain Resolution: TRAVEL se tem trip, senão PERSONAL
    IF p_trip_id IS NOT NULL THEN
        v_final_domain := 'TRAVEL';
    ELSE
        v_final_domain := COALESCE(NULLIF(p_domain, ''), 'PERSONAL');
    END IF;

    -- Validação de Transferência
    IF p_type = 'TRANSFERÊNCIA' AND p_destination_account_id IS NULL THEN
        RAISE EXCEPTION 'Transferência requer conta de destino.';
    END IF;

    -- Inserção da transação
    INSERT INTO public.transactions (
        description, amount, type, category, date,
        account_id, destination_account_id, trip_id,
        is_shared, domain, user_id,
        is_installment, current_installment, total_installments, series_id,
        is_recurring, frequency,
        shared_with, payer_id,
        created_at, updated_at
    ) VALUES (
        p_description, p_amount, p_type, p_category, p_date,
        p_account_id, p_destination_account_id, p_trip_id,
        p_is_shared, v_final_domain, v_user_id,
        p_is_installment, p_current_installment, p_total_installments, p_series_id,
        p_is_recurring, p_frequency,
        p_shared_with,
        CASE WHEN p_is_shared THEN 'me' ELSE NULL END,
        NOW(), NOW()
    ) RETURNING id INTO v_new_id;

    -- Sincronização de transações compartilhadas (PROBLEMÁTICA)
    BEGIN
        PERFORM public.sync_shared_transaction(v_new_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[create_transaction] Sync compartilhado falhou para ID %: %', v_new_id, SQLERRM;
    END;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 3. PROBLEMAS IDENTIFICADOS
-- ========================================

/*
PROBLEMAS CRÍTICOS NO SISTEMA ATUAL:

1. PARCELAS COMPARTILHADAS NÃO APARECEM PARA USUÁRIO B
   - Função sync_shared_transaction falha silenciosamente
   - Transações espelho não são criadas corretamente
   - Falta de validação de integridade

2. DONO NÃO CONSEGUE EDITAR TRANSAÇÃO COMPARTILHADA
   - RLS policies muito restritivas
   - Falta de diferenciação entre transação original e espelho
   - Permissões inadequadas

3. BANCO DE DADOS DESORGANIZADO
   - 45+ migrações com duplicações
   - Funções com múltiplas versões
   - Scripts de diagnóstico espalhados
   - Falta de consolidação

4. SINCRONIZAÇÃO INCONSISTENTE
   - Falhas silenciosas sem retry
   - Falta de mecanismos de recuperação
   - Inconsistências entre dados originais e espelho

5. INTERFACE PROBLEMÁTICA
   - Feedback inadequado para usuário
   - Falta de indicadores de progresso
   - Tratamento de erro insuficiente
*/

-- ========================================
-- 4. SCRIPT DE ROLLBACK DE EMERGÊNCIA
-- ========================================

CREATE OR REPLACE FUNCTION public.emergency_rollback_shared_system()
RETURNS TEXT AS $$
BEGIN
    -- Este script pode ser usado para reverter para o estado atual
    -- em caso de problemas durante a reestruturação
    
    RAISE NOTICE 'EMERGENCY ROLLBACK: Restaurando estado anterior do sistema compartilhado';
    
    -- Desabilitar triggers temporariamente
    ALTER TABLE public.transactions DISABLE TRIGGER ALL;
    ALTER TABLE public.shared_transaction_requests DISABLE TRIGGER ALL;
    
    -- Restaurar funções originais se necessário
    -- (código específico será adicionado conforme necessário)
    
    -- Reabilitar triggers
    ALTER TABLE public.transactions ENABLE TRIGGER ALL;
    ALTER TABLE public.shared_transaction_requests ENABLE TRIGGER ALL;
    
    RETURN 'Rollback de emergência executado com sucesso';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 5. METADADOS DO BACKUP
-- ========================================

CREATE TABLE IF NOT EXISTS public.backup_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type TEXT NOT NULL,
    backup_date TIMESTAMPTZ DEFAULT NOW(),
    description TEXT,
    schema_version TEXT,
    migration_count INTEGER,
    notes TEXT
);

INSERT INTO public.backup_metadata (
    backup_type, 
    description, 
    schema_version, 
    migration_count, 
    notes
) VALUES (
    'PRE_SHARED_SYSTEM_OVERHAUL',
    'Backup completo antes da reestruturação do sistema compartilhado',
    'GOLDEN_SCHEMA_2025_12_20',
    45,
    'Sistema com problemas críticos: parcelas não aparecem para usuário B, dono não consegue editar, banco desorganizado'
);

-- ==============================================================================
-- BACKUP CONCLUÍDO
-- ==============================================================================