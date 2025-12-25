# 🔍 INSTRUÇÕES: Executar Validação de Integridade

**Data:** 25 de Dezembro de 2024  
**Status:** Pronto para execução

---

## 📋 PASSO A PASSO

### 1. Acessar o Supabase SQL Editor

1. Acesse: https://supabase.com/dashboard/project/mlqzeihukezlozooqhko
2. Vá em: **SQL Editor** (menu lateral)
3. Clique em: **New Query**

---

### 2. Executar Validação Rápida (5 minutos)

Cole e execute esta query para um resumo geral:

```sql
-- VALIDAÇÃO RÁPIDA DE INTEGRIDADE
-- Tempo estimado: 30 segundos

SELECT 
    'Transações sem ledger' as tipo_problema,
    COUNT(*) as quantidade
FROM transactions t
LEFT JOIN ledger_entries l ON l.transaction_id = t.id
WHERE t.deleted = false
AND l.id IS NULL

UNION ALL

SELECT 
    'Splits maiores que total' as tipo_problema,
    COUNT(*) as quantidade
FROM transactions t
WHERE t.is_shared = true
AND t.deleted = false
AND t.shared_with IS NOT NULL
AND (
    SELECT SUM((split->>'assignedAmount')::numeric)
    FROM jsonb_array_elements(t.shared_with) as split
) > t.amount + 0.01

UNION ALL

SELECT 
    'Transferências sem destino' as tipo_problema,
    COUNT(*) as quantidade
FROM transactions
WHERE type = 'TRANSFERÊNCIA'
AND deleted = false
AND (destination_account_id IS NULL OR destination_account_id = '')

UNION ALL

SELECT 
    'Valores inválidos' as tipo_problema,
    COUNT(*) as quantidade
FROM transactions
WHERE deleted = false
AND (amount IS NULL OR amount <= 0)

UNION ALL

SELECT 
    'Espelhos não sincronizados' as tipo_problema,
    COUNT(*) as quantidade
FROM shared_transaction_mirrors
WHERE sync_status != 'SYNCED';
```

**Resultado Esperado:**
```
tipo_problema                  | quantidade
-------------------------------|------------
Transações sem ledger          | 0
Splits maiores que total       | 0
Transferências sem destino     | 0
Valores inválidos              | 0
Espelhos não sincronizados     | 0
```

✅ Se todos os valores forem **0**, o sistema está íntegro!

---

### 3. Executar Validação Completa (15 minutos)

Se quiser uma análise detalhada, execute o arquivo completo:

1. Abra: `producao/VALIDACAO_INTEGRIDADE_DADOS.sql`
2. Copie TODO o conteúdo
3. Cole no SQL Editor do Supabase
4. Execute

**Atenção:** Este script tem múltiplas queries. Execute uma por vez ou use o botão "Run" para executar todas.

---

### 4. Interpretar Resultados

#### ✅ Sistema Íntegro
Se todas as queries retornarem **0 problemas** ou **status OK**, o sistema está perfeito!

#### ⚠️ Problemas Encontrados
Se houver problemas, anote os IDs das transações problemáticas e prossiga para a correção.

---

### 5. Aplicar Correções (SE NECESSÁRIO)

**⚠️ ATENÇÃO: Apenas execute se houver problemas identificados!**

#### Passo 1: Fazer Backup
```sql
-- Criar backup manual
CREATE TABLE backup_manual_25_12_2024 AS
SELECT * FROM transactions WHERE deleted = false;

-- Verificar backup
SELECT COUNT(*) FROM backup_manual_25_12_2024;
```

#### Passo 2: Executar Correções
1. Abra: `producao/CORRECAO_INTEGRIDADE_DADOS.sql`
2. Copie TODO o conteúdo
3. Cole no SQL Editor
4. **LEIA ATENTAMENTE** o que será feito
5. Execute

#### Passo 3: Validar Correções
Execute novamente a validação rápida (Passo 2) para confirmar que os problemas foram resolvidos.

#### Passo 4: Commit ou Rollback
```sql
-- Se tudo estiver OK:
COMMIT;

-- Se algo deu errado:
ROLLBACK;
```

---

## 📊 SCORE DE INTEGRIDADE

Execute esta query para obter um score geral:

```sql
WITH problem_counts AS (
    SELECT 
        (SELECT COUNT(*) FROM transactions WHERE deleted = false) as total_transactions,
        (SELECT COUNT(*) FROM transactions t LEFT JOIN ledger_entries l ON l.transaction_id = t.id WHERE t.deleted = false AND l.id IS NULL) as no_ledger,
        (SELECT COUNT(*) FROM transactions t WHERE t.is_shared = true AND t.deleted = false AND t.shared_with IS NOT NULL AND (SELECT SUM((split->>'assignedAmount')::numeric) FROM jsonb_array_elements(t.shared_with) as split) > t.amount + 0.01) as bad_splits,
        (SELECT COUNT(*) FROM transactions WHERE type = 'TRANSFERÊNCIA' AND deleted = false AND (destination_account_id IS NULL OR destination_account_id = '')) as no_destination,
        (SELECT COUNT(*) FROM transactions WHERE deleted = false AND (amount IS NULL OR amount <= 0)) as invalid_amounts
)
SELECT 
    total_transactions,
    no_ledger + bad_splits + no_destination + invalid_amounts as total_problems,
    ROUND(
        (1 - (no_ledger + bad_splits + no_destination + invalid_amounts)::numeric / NULLIF(total_transactions, 0)) * 100,
        2
    ) as integrity_score_percent,
    CASE 
        WHEN ROUND((1 - (no_ledger + bad_splits + no_destination + invalid_amounts)::numeric / NULLIF(total_transactions, 0)) * 100, 2) >= 99 THEN '✅ EXCELENTE'
        WHEN ROUND((1 - (no_ledger + bad_splits + no_destination + invalid_amounts)::numeric / NULLIF(total_transactions, 0)) * 100, 2) >= 95 THEN '✅ BOM'
        WHEN ROUND((1 - (no_ledger + bad_splits + no_destination + invalid_amounts)::numeric / NULLIF(total_transactions, 0)) * 100, 2) >= 90 THEN '⚠️ ACEITÁVEL'
        ELSE '❌ CRÍTICO'
    END as status
FROM problem_counts;
```

**Resultado Esperado:**
```
total_transactions | total_problems | integrity_score_percent | status
-------------------|----------------|------------------------|-------------
1234               | 0              | 100.00                 | ✅ EXCELENTE
```

---

## 🎯 PRÓXIMOS PASSOS

### Se Score >= 99% (Excelente)
✅ Sistema está perfeito! Nenhuma ação necessária.

### Se Score 95-98% (Bom)
⚠️ Pequenos problemas encontrados. Revisar e corrigir manualmente.

### Se Score 90-94% (Aceitável)
⚠️ Problemas moderados. Executar script de correção.

### Se Score < 90% (Crítico)
❌ Problemas graves. Revisar dados manualmente antes de aplicar correções automáticas.

---

## 📞 SUPORTE

Se encontrar problemas ou tiver dúvidas:

1. Anote os IDs das transações problemáticas
2. Revise os logs de erro
3. Consulte: `EXEMPLOS_VALIDACAO_PARTIDAS_DOBRADAS.md`
4. Entre em contato com o suporte técnico

---

## ✅ CHECKLIST DE VALIDAÇÃO

- [ ] Acessei o Supabase SQL Editor
- [ ] Executei a validação rápida
- [ ] Revisei os resultados
- [ ] Se necessário: fiz backup
- [ ] Se necessário: executei correções
- [ ] Validei novamente após correções
- [ ] Obtive score de integridade >= 99%
- [ ] Sistema está pronto para uso

---

**Última atualização:** 25/12/2024  
**Tempo estimado total:** 15-30 minutos
