# 🔍 Buscar Parcelas: Carro Ar Condicionado

**Data**: 21 de Dezembro de 2025  
**Padrão**: Carro ar condicionado

---

## 🎯 SCRIPTS PARA EXECUTAR

### 1. Buscar Parcelas com "carro"

```sql
-- Buscar todas as transações com "carro" na descrição
SELECT 
    id,
    description,
    current_installment,
    total_installments,
    amount,
    date,
    type,
    user_id,
    account_id,
    deleted,
    is_installment
FROM public.transactions
WHERE description ILIKE '%carro%'
  AND is_installment = true
ORDER BY current_installment;
```

### 2. Buscar Parcelas com "ar condicionado"

```sql
-- Buscar todas as transações com "ar condicionado" na descrição
SELECT 
    id,
    description,
    current_installment,
    total_installments,
    amount,
    date,
    type,
    user_id,
    account_id,
    deleted,
    is_installment
FROM public.transactions
WHERE description ILIKE '%ar%condicionado%'
  AND is_installment = true
ORDER BY current_installment;
```

### 3. Buscar Todas as Parcelas (Qualquer Descrição)

```sql
-- Buscar TODAS as parcelas importadas recentemente
SELECT 
    description,
    COUNT(*) as quantidade,
    MIN(current_installment) as primeira_parcela,
    MAX(current_installment) as ultima_parcela,
    MAX(total_installments) as total_esperado
FROM public.transactions
WHERE is_installment = true
  AND created_at > NOW() - INTERVAL '7 days'  -- Últimos 7 dias
GROUP BY description
ORDER BY created_at DESC;
```

### 4. Diagnóstico com Padrão Correto

```sql
-- Executar diagnóstico com o padrão correto
-- SUBSTITUA '%PADRÃO%' pela descrição que você encontrou acima

SELECT * FROM public.diagnose_missing_installments('%carro%');
```

---

## 📊 PRÓXIMOS PASSOS

1. **Execute o script 3** para ver todas as parcelas recentes
2. **Identifique a descrição exata** das parcelas que estão faltando
3. **Execute o diagnóstico** com o padrão correto
4. **Me mostre os resultados** para aplicarmos a correção

---

## 🔧 CORREÇÃO RÁPIDA

Depois de identificar o padrão correto, execute:

```sql
-- 1. Diagnóstico
SELECT * FROM public.diagnose_missing_installments('%PADRÃO_CORRETO%');

-- 2. Simulação
SELECT * FROM public.fix_missing_installments('%PADRÃO_CORRETO%', true);

-- 3. Correção real
SELECT * FROM public.fix_missing_installments('%PADRÃO_CORRETO%', false);
```

---

**Execute os scripts acima e me mostre qual é a descrição exata das parcelas!**
