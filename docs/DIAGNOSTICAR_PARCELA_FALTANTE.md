# 🔍 DIAGNOSTICAR PARCELA FALTANTE

**Data**: 21 de Dezembro de 2025  
**Problema**: Aparecem apenas 9 de 10 parcelas para o usuário B  
**Objetivo**: Encontrar onde está a parcela que falta

---

## 🎯 PROBLEMA

- ✅ Esperado: 10 parcelas
- ❌ Aparecendo: 9 parcelas
- ❓ Faltando: 1 parcela

---

## 🔍 SCRIPT DE DIAGNÓSTICO (COPIE E COLE)

```sql
-- ==============================================================================
-- DIAGNÓSTICO: ENCONTRAR PARCELA FALTANTE
-- DATA: 2025-12-21
-- OBJETIVO: Investigar por que aparecem apenas 9 de 10 parcelas
-- ==============================================================================

DO $$
DECLARE
    v_user_b_id UUID;
    v_account_id UUID;
    v_total_installments INTEGER;
    v_visible_installments INTEGER;
    v_hidden_installments INTEGER;
    v_different_user_id INTEGER;
    v_deleted_installments INTEGER;
    v_series_info RECORD;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DIAGNÓSTICO: PARCELA FALTANTE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- =========================================================================
    -- PASSO 1: IDENTIFICAR O USUÁRIO B E SUA CONTA
    -- =========================================================================
    RAISE NOTICE '1. IDENTIFICANDO USUÁRIO B...';
    
    -- Assumindo que o usuário B é aquele que tem conta mas não importou
    -- Vamos buscar contas com parcelas
    SELECT DISTINCT a.user_id, a.id INTO v_user_b_id, v_account_id
    FROM public.accounts a
    JOIN public.transactions t ON t.account_id = a.id
    WHERE t.is_installment = true
      AND a.deleted = false
    LIMIT 1;
    
    IF v_user_b_id IS NULL THEN
        RAISE NOTICE '   ❌ Nenhuma conta com parcelas encontrada';
        RETURN;
    END IF;
    
    RAISE NOTICE '   ✅ Usuário B ID: %', v_user_b_id;
    RAISE NOTICE '   ✅ Conta ID: %', v_account_id;
    RAISE NOTICE '';

    -- =========================================================================
    -- PASSO 2: CONTAR TODAS AS PARCELAS RELACIONADAS À CONTA
    -- =========================================================================
    RAISE NOTICE '2. CONTANDO PARCELAS...';
    
    -- Total de parcelas na conta
    SELECT COUNT(*) INTO v_total_installments
    FROM public.transactions
    WHERE account_id = v_account_id
      AND is_installment = true;
    
    -- Parcelas visíveis para o usuário B
    SELECT COUNT(*) INTO v_visible_installments
    FROM public.transactions
    WHERE account_id = v_account_id
      AND is_installment = true
      AND user_id = v_user_b_id;
    
    -- Parcelas com user_id diferente
    SELECT COUNT(*) INTO v_different_user_id
    FROM public.transactions
    WHERE account_id = v_account_id
      AND is_installment = true
      AND user_id != v_user_b_id;
    
    -- Parcelas deletadas
    SELECT COUNT(*) INTO v_deleted_installments
    FROM public.transactions
    WHERE account_id = v_account_id
      AND is_installment = true
      AND deleted = true;
    
    RAISE NOTICE '   Total de parcelas na conta: %', v_total_installments;
    RAISE NOTICE '   Parcelas visíveis para usuário B: %', v_visible_installments;
    RAISE NOTICE '   Parcelas com user_id diferente: %', v_different_user_id;
    RAISE NOTICE '   Parcelas deletadas: %', v_deleted_installments;
    RAISE NOTICE '';

    -- =========================================================================
    -- PASSO 3: ANALISAR SÉRIES DE PARCELAS
    -- =========================================================================
    RAISE NOTICE '3. ANALISANDO SÉRIES DE PARCELAS...';
    
    FOR v_series_info IN
        SELECT 
            series_id,
            COUNT(*) as total_in_series,
            MIN(current_installment) as first_installment,
            MAX(current_installment) as last_installment,
            MAX(total_installments) as expected_total,
            COUNT(CASE WHEN user_id = v_user_b_id THEN 1 END) as visible_to_user_b,
            COUNT(CASE WHEN user_id != v_user_b_id THEN 1 END) as wrong_user_id,
            COUNT(CASE WHEN deleted = true THEN 1 END) as deleted_count
        FROM public.transactions
        WHERE account_id = v_account_id
          AND is_installment = true
          AND series_id IS NOT NULL
        GROUP BY series_id
        ORDER BY series_id
    LOOP
        RAISE NOTICE '   Série: %', v_series_info.series_id;
        RAISE NOTICE '     - Total na série: %', v_series_info.total_in_series;
        RAISE NOTICE '     - Esperado: %', v_series_info.expected_total;
        RAISE NOTICE '     - Primeira parcela: %', v_series_info.first_installment;
        RAISE NOTICE '     - Última parcela: %', v_series_info.last_installment;
        RAISE NOTICE '     - Visíveis para usuário B: %', v_series_info.visible_to_user_b;
        RAISE NOTICE '     - Com user_id errado: %', v_series_info.wrong_user_id;
        RAISE NOTICE '     - Deletadas: %', v_series_info.deleted_count;
        
        IF v_series_info.total_in_series != v_series_info.expected_total THEN
            RAISE NOTICE '     ❌ PROBLEMA: Série incompleta!';
        END IF;
        
        IF v_series_info.wrong_user_id > 0 THEN
            RAISE NOTICE '     ❌ PROBLEMA: Parcelas com user_id errado!';
        END IF;
        
        RAISE NOTICE '';
    END LOOP;

    -- =========================================================================
    -- PASSO 4: LISTAR PARCELAS PROBLEMÁTICAS
    -- =========================================================================
    RAISE NOTICE '4. LISTANDO PARCELAS PROBLEMÁTICAS...';
    
    -- Parcelas com user_id errado
    IF v_different_user_id > 0 THEN
        RAISE NOTICE '   PARCELAS COM USER_ID ERRADO:';
        FOR v_series_info IN
            SELECT 
                id,
                description,
                current_installment,
                total_installments,
                series_id,
                user_id,
                created_at
            FROM public.transactions
            WHERE account_id = v_account_id
              AND is_installment = true
              AND user_id != v_user_b_id
            ORDER BY series_id, current_installment
        LOOP
            RAISE NOTICE '     - ID: %, Desc: %, Parcela: %/%, User: %, Criado: %', 
                v_series_info.id, 
                v_series_info.description, 
                v_series_info.current_installment,
                v_series_info.total_installments,
                v_series_info.user_id,
                v_series_info.created_at;
        END LOOP;
        RAISE NOTICE '';
    END IF;

    -- =========================================================================
    -- PASSO 5: VERIFICAR FILTROS NO FRONTEND
    -- =========================================================================
    RAISE NOTICE '5. POSSÍVEIS CAUSAS NO FRONTEND...';
    RAISE NOTICE '   - Filtro por data (mês/ano atual)';
    RAISE NOTICE '   - Filtro por categoria';
    RAISE NOTICE '   - Filtro por status (pago/não pago)';
    RAISE NOTICE '   - Paginação limitando resultados';
    RAISE NOTICE '   - Cache desatualizado';
    RAISE NOTICE '';

    -- =========================================================================
    -- RESULTADO FINAL E RECOMENDAÇÕES
    -- =========================================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMO DO DIAGNÓSTICO';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    IF v_different_user_id > 0 THEN
        RAISE NOTICE '❌ PROBLEMA ENCONTRADO: % parcelas com user_id errado', v_different_user_id;
        RAISE NOTICE 'SOLUÇÃO: Execute o script de correção novamente';
    ELSIF v_total_installments = 10 AND v_visible_installments = 9 THEN
        RAISE NOTICE '⚠️  PROBLEMA PARCIAL: 1 parcela não visível';
        RAISE NOTICE 'POSSÍVEIS CAUSAS:';
        RAISE NOTICE '  - Filtro de data no frontend';
        RAISE NOTICE '  - Parcela em mês diferente';
        RAISE NOTICE '  - Cache do navegador';
    ELSE
        RAISE NOTICE '✅ DADOS CORRETOS NO BANCO';
        RAISE NOTICE 'PROBLEMA PODE SER NO FRONTEND:';
        RAISE NOTICE '  - Verifique filtros de data';
        RAISE NOTICE '  - Limpe cache do navegador';
        RAISE NOTICE '  - Verifique paginação';
    END IF;
    RAISE NOTICE '';

END $$;
```

---

## 📋 INSTRUÇÕES

1. **Execute o script acima** no SQL Editor do Supabase
2. **Leia os resultados** com atenção
3. **Identifique o problema** baseado no diagnóstico

---

## 🎯 POSSÍVEIS CAUSAS

### 1. ❌ Problema no Banco de Dados
- **Parcela com `user_id` errado** → Execute script de correção novamente
- **Parcela deletada** → Restaurar ou recriar
- **Série incompleta** → Falta criar a parcela

### 2. ⚠️ Problema no Frontend
- **Filtro de data** → Parcela pode estar em mês diferente
- **Filtro de categoria** → Parcela pode estar filtrada
- **Cache desatualizado** → Limpar cache do navegador
- **Paginação** → Verificar se há mais páginas

### 3. 🔍 Problema de Visualização
- **Parcela não paga** → Verificar filtro de status
- **Parcela futura** → Verificar filtro de data
- **Parcela em outra conta** → Verificar conta selecionada

---

## ✅ PRÓXIMOS PASSOS

Baseado no resultado do diagnóstico:

### Se encontrar parcelas com `user_id` errado:
```sql
-- Execute novamente o script de correção
UPDATE public.transactions 
SET user_id = accounts.user_id,
    updated_at = NOW()
FROM public.accounts
WHERE transactions.account_id = accounts.id
  AND transactions.user_id != accounts.user_id
  AND accounts.deleted = false
  AND transactions.is_installment = true;
```

### Se o banco estiver correto:
1. Limpe o cache do navegador (Ctrl+Shift+R)
2. Verifique filtros de data no frontend
3. Verifique se está vendo o mês correto
4. Verifique paginação

---

## 📊 EXEMPLO DE RESULTADO ESPERADO

```
NOTICE: ========================================
NOTICE: DIAGNÓSTICO: PARCELA FALTANTE
NOTICE: ========================================
NOTICE: 
NOTICE: 1. IDENTIFICANDO USUÁRIO B...
NOTICE:    ✅ Usuário B ID: abc-123-def
NOTICE:    ✅ Conta ID: xyz-789-ghi
NOTICE: 
NOTICE: 2. CONTANDO PARCELAS...
NOTICE:    Total de parcelas na conta: 10
NOTICE:    Parcelas visíveis para usuário B: 9
NOTICE:    Parcelas com user_id diferente: 1
NOTICE:    Parcelas deletadas: 0
NOTICE: 
NOTICE: 3. ANALISANDO SÉRIES DE PARCELAS...
NOTICE:    Série: series-123
NOTICE:      - Total na série: 10
NOTICE:      - Esperado: 10
NOTICE:      - Primeira parcela: 1
NOTICE:      - Última parcela: 10
NOTICE:      - Visíveis para usuário B: 9
NOTICE:      - Com user_id errado: 1
NOTICE:      ❌ PROBLEMA: Parcelas com user_id errado!
NOTICE: 
NOTICE: 4. LISTANDO PARCELAS PROBLEMÁTICAS...
NOTICE:    PARCELAS COM USER_ID ERRADO:
NOTICE:      - ID: trans-123, Desc: Fatura 10/10, Parcela: 10/10, User: user-a-id
NOTICE: 
NOTICE: ========================================
NOTICE: RESUMO DO DIAGNÓSTICO
NOTICE: ========================================
NOTICE: 
NOTICE: ❌ PROBLEMA ENCONTRADO: 1 parcelas com user_id errado
NOTICE: SOLUÇÃO: Execute o script de correção novamente
```

---

**Execute o diagnóstico e me mostre os resultados para identificarmos exatamente onde está o problema!**