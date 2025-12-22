-- ==============================================================================
-- DIAGNÓSTICO: Factory Reset não está excluindo todos os dados
-- DATA: 2025-12-22
-- PROBLEMA: Fluxo de caixa ainda puxa dados de lançamentos que não existem mais
-- ==============================================================================

-- PASSO 1: Verificar se há transações que não estão sendo deletadas
-- Execute este comando substituindo 'SEU_USER_ID' pelo ID do usuário

-- 1.1 Verificar transações próprias do usuário
SELECT 
    'Transações Próprias' as tipo,
    COUNT(*) as total,
    COUNT(CASE WHEN deleted = false THEN 1 END) as ativas,
    COUNT(CASE WHEN is_shared = true THEN 1 END) as compartilhadas,
    COUNT(CASE WHEN is_mirror = true THEN 1 END) as espelhos
FROM public.transactions 
WHERE user_id = 'SEU_USER_ID';

-- 1.2 Verificar transações espelho (mirror) do usuário
SELECT 
    'Transações Espelho' as tipo,
    COUNT(*) as total,
    COUNT(CASE WHEN deleted = false THEN 1 END) as ativas,
    COUNT(CASE WHEN source_transaction_id IS NOT NULL THEN 1 END) as com_source
FROM public.transactions 
WHERE user_id = 'SEU_USER_ID' 
AND is_mirror = true;

-- 1.3 Verificar transações compartilhadas onde o usuário é participante
SELECT 
    'Transações Compartilhadas (Participante)' as tipo,
    COUNT(*) as total
FROM public.transactions t
INNER JOIN public.shared_transaction_requests str ON str.transaction_id = t.id
WHERE str.invited_user_id = 'SEU_USER_ID'
AND str.status = 'ACCEPTED'
AND t.deleted = false
AND t.user_id != 'SEU_USER_ID';

-- 1.4 Verificar espelhos órfãos (sem transação original)
SELECT 
    'Espelhos Órfãos' as tipo,
    COUNT(*) as total
FROM public.transactions t
WHERE user_id = 'SEU_USER_ID'
AND is_mirror = true
AND source_transaction_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM public.transactions t2 
    WHERE t2.id = t.source_transaction_id 
    AND t2.deleted = false
);

-- 1.5 Verificar solicitações de compartilhamento
SELECT 
    'Solicitações de Compartilhamento' as tipo,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'ACCEPTED' THEN 1 END) as aceitas,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pendentes
FROM public.shared_transaction_requests
WHERE invited_user_id = 'SEU_USER_ID' OR requester_id = 'SEU_USER_ID';

-- 1.6 Verificar espelhos de transações compartilhadas
SELECT 
    'Espelhos de Transações Compartilhadas' as tipo,
    COUNT(*) as total
FROM public.shared_transaction_mirrors
WHERE mirror_user_id = 'SEU_USER_ID';

-- ==============================================================================
-- PASSO 2: Verificar o que aparece no fluxo de caixa
-- ==============================================================================

-- 2.1 Simular a consulta do fluxo de caixa (get_monthly_cashflow)
SELECT 
    EXTRACT(MONTH FROM date)::INT as month,
    SUM(CASE WHEN type = 'RECEITA' THEN amount ELSE 0 END) as income,
    SUM(CASE WHEN type = 'DESPESA' THEN amount ELSE 0 END) as expense,
    COUNT(*) as total_transactions
FROM transactions
WHERE user_id = 'SEU_USER_ID'
AND deleted = false
AND EXTRACT(YEAR FROM date)::INT = 2024  -- Ajuste o ano conforme necessário
AND type IN ('RECEITA', 'DESPESA')
AND category != 'Saldo Inicial / Ajuste'
GROUP BY EXTRACT(MONTH FROM date)
ORDER BY month;

-- 2.2 Listar todas as transações visíveis no fluxo de caixa
SELECT 
    id,
    description,
    amount,
    type,
    date,
    is_shared,
    is_mirror,
    source_transaction_id,
    deleted,
    created_at
FROM transactions
WHERE user_id = 'SEU_USER_ID'
AND deleted = false
ORDER BY date DESC
LIMIT 20;

-- ==============================================================================
-- PASSO 3: Identificar o problema específico
-- ==============================================================================

-- 3.1 Verificar se há transações que deveriam ter sido deletadas
SELECT 
    'Problema Identificado' as tipo,
    CASE 
        WHEN COUNT(*) > 0 THEN 'SIM - Há transações que não foram deletadas'
        ELSE 'NÃO - Todas as transações foram deletadas'
    END as resultado,
    COUNT(*) as total_transacoes_nao_deletadas
FROM transactions
WHERE user_id = 'SEU_USER_ID'
AND deleted = false;

-- 3.2 Verificar se há transações espelho que não foram deletadas
SELECT 
    'Transações Espelho Não Deletadas' as tipo,
    COUNT(*) as total,
    array_agg(id) as ids
FROM transactions
WHERE user_id = 'SEU_USER_ID'
AND is_mirror = true
AND deleted = false;

-- 3.3 Verificar se há transações compartilhadas que não foram deletadas
SELECT 
    'Transações Compartilhadas Não Deletadas' as tipo,
    COUNT(*) as total,
    array_agg(id) as ids
FROM transactions
WHERE user_id = 'SEU_USER_ID'
AND is_shared = true
AND deleted = false;

-- ==============================================================================
-- PASSO 4: Solução - Corrigir a função de factory reset
-- ==============================================================================

-- A função execute_factory_reset_complete() está deletando apenas transações
-- onde user_id = target_user_id, mas NÃO está deletando:
-- 1. Transações espelho (is_mirror = true) que pertencem ao usuário
-- 2. Transações compartilhadas onde o usuário é participante

-- SOLUÇÃO: Atualizar a função para deletar TODAS as transações relacionadas
