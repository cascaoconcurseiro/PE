# 🔍 Aplicar Diagnostic Engine - Instruções

**Data**: 21 de Dezembro de 2025  
**Objetivo**: Aplicar o Diagnostic Engine para identificar parcelas faltantes

---

## 📋 O QUE É O DIAGNOSTIC ENGINE

O Diagnostic Engine é um conjunto de funções SQL que:

1. **Identifica usuários A e B** - Quem importou vs quem é dono da conta
2. **Analisa cada parcela** - Verifica user_id, account_id, deleted status
3. **Detecta problemas** - User_id incorreto, parcelas deletadas, contas diferentes
4. **Gera relatório completo** - Com todas as informações necessárias para correção

---

## 🚀 COMO APLICAR

### Opção 1: Via Supabase Dashboard (Recomendado)

1. **Acesse**: https://app.supabase.com
2. **Selecione seu projeto**
3. **Vá em**: SQL Editor → New Query
4. **Cole o conteúdo do arquivo**: `supabase/migrations/20260221_diagnostic_engine.sql`
5. **Execute**: Run (Ctrl+Enter)
6. **Aguarde**: "Success. No rows returned"

### Opção 2: Via psql (Se tiver acesso direto)

```bash
psql -h <seu-host> -U postgres -d postgres -f supabase/migrations/20260221_diagnostic_engine.sql
```

---

## ✅ COMO USAR O DIAGNOSTIC ENGINE

### 1. Executar Diagnóstico Completo

```sql
-- Executar diagnóstico para parcelas com "Wesley" na descrição
SELECT * FROM public.diagnose_missing_installments('%Wesley%');
```

**Resultado**: Tabela com fases do diagnóstico, status, mensagens e detalhes em JSON

### 2. Identificar Usuários

```sql
-- Identificar usuários A e B
SELECT * FROM public.identify_installment_users('%Wesley%');
```

**Resultado**: user_a_id, user_b_id, account_id, contagens

### 3. Detectar Problemas Específicos

```sql
-- Detectar todos os problemas
SELECT * FROM public.detect_installment_problems('%Wesley%');
```

**Resultado**: Tipo de problema, severidade, contagem, IDs das parcelas afetadas

### 4. Analisar Parcela Específica

```sql
-- Analisar uma parcela específica (substitua os UUIDs)
SELECT * FROM public.analyze_installment(
    'installment-id-aqui'::UUID,
    'expected-user-id'::UUID,
    'expected-account-id'::UUID
);
```

**Resultado**: Status detalhado da parcela e problemas encontrados

---

## 📊 INTERPRETANDO OS RESULTADOS

### Fases do Diagnóstico

1. **IDENTIFICATION** - Identifica usuários e conta
2. **COUNT_ANALYSIS** - Compara contagens entre usuários
3. **DETAILED_ANALYSIS** - Analisa cada parcela individualmente
4. **PROBLEM_DETECTION** - Detecta problemas específicos
5. **SUMMARY** - Resumo final com total de problemas

### Status Possíveis

- **SUCCESS** ✅ - Tudo OK
- **WARNING** ⚠️ - Atenção necessária
- **ERROR** ❌ - Problema encontrado
- **INFO** ℹ️ - Informação

### Tipos de Problemas

1. **INCORRECT_USER_ID** - Parcela com user_id errado (severidade: HIGH)
2. **DELETED_INSTALLMENTS** - Parcela deletada incorretamente (severidade: HIGH)
3. **MULTIPLE_ACCOUNTS** - Parcelas em contas diferentes (severidade: MEDIUM)
4. **INCOMPLETE_SEQUENCE** - Sequência de parcelas incompleta (severidade: MEDIUM)

---

## 🎯 EXEMPLO DE USO COMPLETO

```sql
-- Passo 1: Executar diagnóstico completo
SELECT 
    phase,
    status,
    message,
    details->>'user_a_visible_count' as user_a_count,
    details->>'user_b_visible_count' as user_b_count,
    details->>'total_problems' as problems
FROM public.diagnose_missing_installments('%Wesley%')
WHERE phase = 'SUMMARY';

-- Passo 2: Ver problemas específicos
SELECT 
    problem_type,
    severity,
    count,
    details->>'description' as description
FROM public.detect_installment_problems('%Wesley%');

-- Passo 3: Ver parcelas com problemas
SELECT 
    phase,
    status,
    message,
    details->>'installment_id' as id,
    details->>'current_installment' as parcela,
    details->>'visibility_status' as visibilidade,
    details->>'user_status' as user_status,
    details->>'delete_status' as delete_status
FROM public.diagnose_missing_installments('%Wesley%')
WHERE phase = 'DETAILED_ANALYSIS'
  AND status = 'ERROR'
ORDER BY (details->>'current_installment')::INTEGER;
```

---

## 🔍 PRÓXIMOS PASSOS

Após executar o diagnóstico:

1. **Analise os resultados** - Identifique quais parcelas têm problemas
2. **Anote os IDs** - Das parcelas que precisam correção
3. **Verifique o tipo de problema** - User_id incorreto, deletada, etc.
4. **Aguarde a próxima task** - Implementação do Correction Engine

---

## ⚠️ IMPORTANTE

- Este é apenas o **diagnóstico** - não faz correções ainda
- É **seguro executar** - apenas lê dados, não modifica nada
- Pode ser executado **múltiplas vezes** sem problemas
- Os resultados ajudarão a **planejar a correção**

---

## 📝 CHECKLIST

- [ ] Migration aplicada com sucesso
- [ ] Diagnóstico executado
- [ ] Resultados analisados
- [ ] Problemas identificados
- [ ] IDs das parcelas problemáticas anotados
- [ ] Pronto para próxima task (Correction Engine)

---

**Execute o diagnóstico e me mostre os resultados!**
