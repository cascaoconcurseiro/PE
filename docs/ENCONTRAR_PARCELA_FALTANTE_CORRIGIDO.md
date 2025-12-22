# 🔍 ENCONTRAR PARCELA FALTANTE - VERSÃO CORRIGIDA

**Data**: 21 de Dezembro de 2025  
**Problema**: Aparecem apenas 9 de 10 parcelas na tela de lançamentos  
**Hipótese**: 1 parcela pode estar como RECEITA em vez de DESPESA

---

## 🎯 ANÁLISE DAS IMAGENS

### Tela 1 (Lançamentos - 9 itens):
- Mostra parcelas **vermelhas** (DESPESA/DÉBITO)
- Total: **9 parcelas**

### Tela 2 (Crédito de Fran - Janeiro):
- Mostra parcelas **verdes** (RECEITA/CRÉDITO)  
- Total: **10 lançamentos**
- Valor: R$ 1.305,00

## 🤔 HIPÓTESE PRINCIPAL

**Possível causa**: 1 parcela foi criada incorretamente como **RECEITA** (verde) em vez de **DESPESA** (vermelha).

**Resultado**:
- 9 parcelas aparecem na tela de "Lançamentos" (DESPESA)
- 1 parcela aparece na tela de "Crédito" (RECEITA)
- Total: 10 parcelas (correto), mas em telas diferentes

---

## 🔍 SCRIPT DE DIAGNÓSTICO CORRIGIDO (COPIE E COLE)

```sql
-- ==============================================================================
-- ENCONTRAR A 10ª PARCELA FALTANTE - VERSÃO CORRIGIDA
-- DATA: 2025-12-21
-- OBJETIVO: Verificar status, data e categoria da parcela que não aparece
-- ==============================================================================

DO $$
DECLARE
    v_installment_info RECORD;
    v_total_count INTEGER;
    v_credit_count INTEGER;
    v_debit_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PROCURANDO A 10ª PARCELA FALTANTE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- =========================================================================
    -- CONTAR PARCELAS POR TIPO
    -- =========================================================================
    SELECT COUNT(*) INTO v_total_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE '%Wesley%';
    
    SELECT COUNT(*) INTO v_credit_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE '%Wesley%'
      AND type = 'RECEITA';
    
    SELECT COUNT(*) INTO v_debit_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE '%Wesley%'
      AND type = 'DESPESA';
    
    RAISE NOTICE 'CONTAGEM POR TIPO:';
    RAISE NOTICE '  Total de parcelas: %', v_total_count;
    RAISE NOTICE '  Parcelas RECEITA (verde): %', v_credit_count;
    RAISE NOTICE '  Parcelas DESPESA (vermelho): %', v_debit_count;
    RAISE NOTICE '';

    -- =========================================================================
    -- LISTAR TODAS AS PARCELAS COM DETALHES
    -- =========================================================================
    RAISE NOTICE 'DETALHES DE TODAS AS PARCELAS:';
    RAISE NOTICE '';
    
    FOR v_installment_info IN
        SELECT 
            id,
            description,
            amount,
            current_installment,
            total_installments,
            date,
            category,
            type,
            user_id,
            account_id,
            created_at
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE '%Wesley%'
        ORDER BY current_installment
    LOOP
        RAISE NOTICE 'Parcela %/%:', v_installment_info.current_installment, v_installment_info.total_installments;
        RAISE NOTICE '  ID: %', v_installment_info.id;
        RAISE NOTICE '  Descrição: %', v_installment_info.description;
        RAISE NOTICE '  Valor: R$ %', v_installment_info.amount;
        RAISE NOTICE '  Data: %', v_installment_info.date;
        RAISE NOTICE '  Categoria: %', v_installment_info.category;
        RAISE NOTICE '  Tipo: % (% na tela)', v_installment_info.type, 
            CASE 
                WHEN v_installment_info.type = 'RECEITA' THEN 'VERDE/CRÉDITO'
                WHEN v_installment_info.type = 'DESPESA' THEN 'VERMELHO/DÉBITO'
                ELSE 'DESCONHECIDO'
            END;
        RAISE NOTICE '  User ID: %', v_installment_info.user_id;
        RAISE NOTICE '  Account ID: %', v_installment_info.account_id;
        RAISE NOTICE '  Criado em: %', v_installment_info.created_at;
        RAISE NOTICE '';
    END LOOP;

    -- =========================================================================
    -- VERIFICAR PARCELAS POR MÊS
    -- =========================================================================
    RAISE NOTICE 'PARCELAS POR MÊS:';
    FOR v_installment_info IN
        SELECT 
            EXTRACT(YEAR FROM date) as year,
            EXTRACT(MONTH FROM date) as month,
            COUNT(*) as count,
            COUNT(CASE WHEN type = 'DESPESA' THEN 1 END) as despesas,
            COUNT(CASE WHEN type = 'RECEITA' THEN 1 END) as receitas
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE '%Wesley%'
        GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
        ORDER BY year, month
    LOOP
        RAISE NOTICE '  %/% - % parcelas (% despesas, % receitas)', 
            v_installment_info.month, v_installment_info.year, v_installment_info.count,
            v_installment_info.despesas, v_installment_info.receitas;
    END LOOP;
    RAISE NOTICE '';

    -- =========================================================================
    -- VERIFICAR PARCELAS POR CATEGORIA
    -- =========================================================================
    RAISE NOTICE 'PARCELAS POR CATEGORIA:';
    FOR v_installment_info IN
        SELECT 
            category,
            type,
            COUNT(*) as count
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE '%Wesley%'
        GROUP BY category, type
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  % (%) - % parcelas', v_installment_info.category, v_installment_info.type, v_installment_info.count;
    END LOOP;
    RAISE NOTICE '';

    -- =========================================================================
    -- VERIFICAR SEQUÊNCIA DE PARCELAS
    -- =========================================================================
    RAISE NOTICE 'VERIFICANDO SEQUÊNCIA DE PARCELAS:';
    FOR v_installment_info IN
        SELECT 
            generate_series(1, 10) as expected_installment
    LOOP
        SELECT COUNT(*) INTO v_credit_count
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE '%Wesley%'
          AND current_installment = v_installment_info.expected_installment;
        
        IF v_credit_count = 0 THEN
            RAISE NOTICE '  ❌ FALTA: Parcela %/10', v_installment_info.expected_installment;
        ELSE
            RAISE NOTICE '  ✅ OK: Parcela %/10 existe', v_installment_info.expected_installment;
        END IF;
    END LOOP;
    RAISE NOTICE '';

    -- =========================================================================
    -- RESULTADO E RECOMENDAÇÕES
    -- =========================================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ANÁLISE COMPLETA';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    IF v_total_count = 10 THEN
        RAISE NOTICE '✅ TODAS AS 10 PARCELAS EXISTEM NO BANCO';
        RAISE NOTICE '';
        RAISE NOTICE 'EXPLICAÇÃO DO PROBLEMA:';
        RAISE NOTICE '  - Tela 1 (Lançamentos): Mostra apenas DESPESAS (tipo = DESPESA)';
        RAISE NOTICE '  - Tela 2 (Crédito): Mostra apenas RECEITAS (tipo = RECEITA)';
        RAISE NOTICE '  - Se você vê 9 despesas + 1 receita = 10 parcelas total';
        RAISE NOTICE '';
        RAISE NOTICE 'POSSÍVEL CAUSA:';
        RAISE NOTICE '  - 1 parcela foi criada como RECEITA em vez de DESPESA';
        RAISE NOTICE '  - Por isso aparece na tela de créditos, não na de lançamentos';
        RAISE NOTICE '';
        RAISE NOTICE 'SOLUÇÃO:';
        RAISE NOTICE '  - Corrigir o tipo da parcela de RECEITA para DESPESA';
    ELSE
        RAISE NOTICE '❌ FALTAM % PARCELAS NO BANCO', (10 - v_total_count);
        RAISE NOTICE 'É necessário recriar as parcelas faltantes';
    END IF;
    RAISE NOTICE '';

END $$;
```

---

## 📋 INSTRUÇÕES

1. **Execute o script acima** no SQL Editor do Supabase
2. **Analise os resultados** - especialmente a contagem por tipo
3. **Identifique qual parcela** está como RECEITA em vez de DESPESA

---

## 🎯 RESULTADOS ESPERADOS

### Se a hipótese estiver correta:
```
NOTICE: CONTAGEM POR TIPO:
NOTICE:   Total de parcelas: 10
NOTICE:   Parcelas RECEITA (verde): 1
NOTICE:   Parcelas DESPESA (vermelho): 9
NOTICE: 
NOTICE: ✅ TODAS AS 10 PARCELAS EXISTEM NO BANCO
NOTICE: 
NOTICE: EXPLICAÇÃO DO PROBLEMA:
NOTICE:   - Tela 1 (Lançamentos): Mostra apenas DESPESAS (tipo = DESPESA)
NOTICE:   - Tela 2 (Crédito): Mostra apenas RECEITAS (tipo = RECEITA)
NOTICE:   - Se você vê 9 despesas + 1 receita = 10 parcelas total
NOTICE: 
NOTICE: POSSÍVEL CAUSA:
NOTICE:   - 1 parcela foi criada como RECEITA em vez de DESPESA
NOTICE:   - Por isso aparece na tela de créditos, não na de lançamentos
```

---

## 🔧 SOLUÇÃO (SE CONFIRMADO)

Se o diagnóstico confirmar que 1 parcela está como RECEITA, vou criar um script para corrigir o tipo:

```sql
-- Corrigir parcela que está como RECEITA para DESPESA
UPDATE public.transactions 
SET type = 'DESPESA',
    updated_at = NOW()
WHERE is_installment = true
  AND description LIKE '%Wesley%'
  AND type = 'RECEITA';
```

---

**Execute o diagnóstico primeiro e me mostre os resultados para confirmarmos a causa!**