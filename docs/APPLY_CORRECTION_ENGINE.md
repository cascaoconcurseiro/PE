# 🔧 Aplicar Correction Engine - Instruções

**Data**: 21 de Dezembro de 2025  
**Objetivo**: Aplicar o Correction Engine para corrigir parcelas faltantes

---

## 📋 O QUE É O CORRECTION ENGINE

O Correction Engine corrige os problemas identificados pelo Diagnostic Engine:

1. **Corrige user_id incorreto** - Atualiza para o ID do dono da conta
2. **Restaura parcelas deletadas** - Marca deleted=false
3. **Corrige account_id** - Se parcelas estão em contas diferentes
4. **Operações atômicas** - Tudo ou nada (rollback em caso de erro)
5. **Modo dry-run** - Simula correções antes de aplicar

---

## 🚀 COMO APLICAR

### Passo 1: Aplicar Correction Engine

1. **Acesse**: https://app.supabase.com
2. **SQL Editor** → New Query
3. **Cole**: Conteúdo de `supabase/migrations/20260221_correction_engine.sql`
4. **Execute**: Run (Ctrl+Enter)
5. **Aguarde**: "Success. No rows returned"

---

## ✅ COMO USAR O CORRECTION ENGINE

### 1. Primeiro: Executar em Modo DRY-RUN (Simulação)

```sql
-- SIMULAÇÃO: Ver o que seria corrigido (não faz mudanças reais)
SELECT * FROM public.fix_missing_installments('%Wesley%', true);
```

**Resultado**: Lista de ações que seriam executadas, sem fazer mudanças reais.

### 2. Depois: Executar Correção Real

```sql
-- CORREÇÃO REAL: Aplicar as correções no banco de dados
SELECT * FROM public.fix_missing_installments('%Wesley%', false);
```

**⚠️ ATENÇÃO**: Este comando faz mudanças reais no banco de dados!

### 3. Validar Correção

```sql
-- Executar diagnóstico novamente para verificar se foi corrigido
SELECT 
    phase,
    status,
    message,
    details->>'user_b_visible_count' as parcelas_visiveis
FROM public.diagnose_missing_installments('%Wesley%')
WHERE phase = 'SUMMARY';
```

---

## 🎯 FLUXO COMPLETO DE CORREÇÃO

### Script Completo (Copie e Cole)

```sql
-- ==============================================================================
-- FLUXO COMPLETO: DIAGNÓSTICO → CORREÇÃO → VALIDAÇÃO
-- ==============================================================================

-- PASSO 1: Diagnóstico inicial
SELECT 'DIAGNÓSTICO INICIAL' as etapa, * FROM (
    SELECT 
        phase,
        status,
        message,
        details->>'user_a_visible_count' as user_a_count,
        details->>'user_b_visible_count' as user_b_count,
        details->>'total_problems' as problemas
    FROM public.diagnose_missing_installments('%Wesley%')
    WHERE phase IN ('COUNT_ANALYSIS', 'SUMMARY')
) sub;

-- PASSO 2: Simulação da correção (DRY-RUN)
SELECT 'SIMULAÇÃO DE CORREÇÃO' as etapa, * FROM (
    SELECT 
        action,
        message,
        success
    FROM public.fix_missing_installments('%Wesley%', true)
    WHERE action IN ('INFO', 'SUMMARY')
) sub;

-- PASSO 3: Aplicar correção real (DESCOMENTE PARA EXECUTAR)
-- SELECT 'CORREÇÃO APLICADA' as etapa, * FROM (
--     SELECT 
--         action,
--         message,
--         success
--     FROM public.fix_missing_installments('%Wesley%', false)
--     WHERE action IN ('INFO', 'SUMMARY')
-- ) sub;

-- PASSO 4: Diagnóstico final (DESCOMENTE APÓS APLICAR CORREÇÃO)
-- SELECT 'DIAGNÓSTICO FINAL' as etapa, * FROM (
--     SELECT 
--         phase,
--         status,
--         message,
--         details->>'user_b_visible_count' as parcelas_visiveis_agora
--     FROM public.diagnose_missing_installments('%Wesley%')
--     WHERE phase = 'SUMMARY'
-- ) sub;
```

---

## 📊 INTERPRETANDO OS RESULTADOS

### Ações do Correction Engine

1. **INFO** - Informações iniciais (modo dry-run vs real)
2. **UPDATE_USER_ID** - Corrigiu user_id de uma parcela
3. **RESTORE_DELETED** - Restaurou parcela deletada
4. **UPDATE_ACCOUNT_ID** - Corrigiu account_id de uma parcela
5. **SUMMARY** - Resumo final com total de correções

### Status de Sucesso

- **success = true** ✅ - Ação executada com sucesso
- **success = false** ❌ - Erro durante a ação

### Exemplo de Resultado Esperado

```
INFO | MODO DRY-RUN: Simulando correções - Usuário B: abc123, Conta: def456
UPDATE_USER_ID | Parcela 10/10: user_id corrigido de xyz789 para abc123
SUMMARY | Simulação concluída: 1 correções aplicadas, 0 erros encontrados
```

---

## 🔧 FUNÇÕES AUXILIARES

### Corrigir Parcela Específica

```sql
-- Corrigir user_id de uma parcela específica
SELECT * FROM public.fix_installment_user_id(
    'installment-id-aqui'::UUID,
    'correct-user-id'::UUID,
    true  -- dry-run
);
```

### Restaurar Parcela Deletada

```sql
-- Restaurar parcela deletada
SELECT * FROM public.restore_deleted_installment(
    'installment-id-aqui'::UUID,
    'correct-user-id'::UUID,
    true  -- dry-run
);
```

### Correção em Lote

```sql
-- Corrigir múltiplas parcelas de uma vez
SELECT * FROM public.fix_installments_batch(
    ARRAY['id1'::UUID, 'id2'::UUID, 'id3'::UUID],
    'correct-user-id'::UUID,
    true  -- dry-run
);
```

---

## ⚠️ IMPORTANTE

### Segurança

- ✅ **Sempre teste em dry-run primeiro** - Veja o que será alterado
- ✅ **Operações atômicas** - Se algo falhar, tudo é revertido
- ✅ **Validações** - Verifica se conta existe antes de corrigir
- ✅ **Logs detalhados** - Cada ação é registrada

### Backup

- 📦 **Faça backup** antes de executar correções reais
- 🔄 **Teste em ambiente de desenvolvimento** primeiro (se possível)

---

## 🎯 PRÓXIMOS PASSOS

1. **Execute o diagnóstico** - Veja quais problemas existem
2. **Execute dry-run** - Simule as correções
3. **Analise os resultados** - Verifique se as correções fazem sentido
4. **Execute correção real** - Aplique as mudanças
5. **Valide o resultado** - Execute diagnóstico novamente

---

**Execute o fluxo completo e me mostre os resultados!**