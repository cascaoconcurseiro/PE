# 🧪 Aplicar Testes do Diagnostic Engine - Instruções

**Data**: 21 de Dezembro de 2025  
**Objetivo**: Executar testes de propriedade para validar o Diagnostic Engine

---

## 📋 O QUE SÃO OS TESTES DE PROPRIEDADE

Os testes de propriedade validam que o Diagnostic Engine funciona corretamente através de:

1. **Property 1: Complete Installment Discovery** - Encontra todas as parcelas que correspondem ao padrão
2. **Property 2: Comprehensive Analysis Coverage** - Cada análise contém todos os campos obrigatórios  
3. **Property 3: Problem Detection Completeness** - Detecta problemas conhecidos corretamente

Cada propriedade é testada com **100 iterações** usando dados aleatórios.

---

## 🚀 COMO APLICAR OS TESTES

### Passo 1: Aplicar Migration de Testes

1. **Acesse**: https://app.supabase.com
2. **Selecione seu projeto**
3. **Vá em**: SQL Editor → New Query
4. **Cole o conteúdo do arquivo**: `supabase/migrations/20260221_diagnostic_engine_tests.sql`
5. **Execute**: Run (Ctrl+Enter)
6. **Aguarde**: "Success. No rows returned"

### Passo 2: Executar Testes de Propriedade

```sql
-- Executar todos os testes de propriedade (300 iterações total)
SELECT * FROM public.run_diagnostic_engine_property_tests();
```

**⚠️ ATENÇÃO**: Este teste pode demorar alguns minutos para completar (300 iterações).

---

## 🧪 EXECUTAR TESTES INDIVIDUAIS

### Teste 1: Complete Installment Discovery

```sql
-- Testa se o diagnóstico encontra todas as parcelas (100 iterações)
SELECT * FROM public.test_property_complete_installment_discovery();
```

### Teste 2: Comprehensive Analysis Coverage

```sql
-- Testa se cada análise contém todos os campos obrigatórios (100 iterações)
SELECT * FROM public.test_property_comprehensive_analysis_coverage();
```

### Teste 3: Problem Detection Completeness

```sql
-- Testa se problemas conhecidos são detectados (100 iterações)
SELECT * FROM public.test_property_problem_detection_completeness();
```

---

## 📊 INTERPRETANDO OS RESULTADOS

### Resultado Esperado (Sucesso)

```
ok 1 - Iteration 1: Expected 5 installments, found 5
ok 2 - Iteration 2: Expected 12 installments, found 12
...
ok 100 - Iteration 100: Expected 8 installments, found 8
ok 101 - Property 1: Complete Installment Discovery - 100 iterations completed
...
ok 301 - === DIAGNOSTIC ENGINE PROPERTY TESTS COMPLETED ===
ok 302 - All 3 properties tested with 100 iterations each
ok 303 - Total test iterations: 300
```

### Resultado com Falha

```
not ok 15 - Iteration 15: Expected 7 installments, found 5
```

Se houver falhas, isso indica um bug no Diagnostic Engine que precisa ser corrigido.

---

## 🛠️ FUNÇÕES AUXILIARES DE TESTE

### Gerar Dados de Teste

```sql
-- Gerar 10 parcelas de teste com 30% de problemas
SELECT public.generate_test_installments(
    10,                           -- quantidade
    'user-a-id'::UUID,           -- usuário A
    'user-b-id'::UUID,           -- usuário B  
    'account-id'::UUID,          -- conta
    0.3,                         -- 30% corrupção
    'MEUS_TESTES'                -- padrão descrição
);
```

### Limpar Dados de Teste

```sql
-- Limpar todos os dados de teste
SELECT public.cleanup_test_installments('MEUS_TESTES');
```

---

## ⚠️ IMPORTANTE

### Segurança dos Testes

- ✅ **Testes são seguros** - Usam dados temporários com prefixo "TEST_"
- ✅ **Limpeza automática** - Dados de teste são removidos após cada iteração
- ✅ **Não afeta dados reais** - Apenas cria/remove dados com padrões específicos

### Performance

- ⏱️ **Tempo estimado**: 2-5 minutos para 300 iterações
- 🔄 **Iterações**: 100 por propriedade (total 300)
- 💾 **Uso de memória**: Mínimo (dados temporários)

---

## 🎯 CHECKLIST DE EXECUÇÃO

### Pré-Execução
- [ ] Diagnostic Engine aplicado com sucesso
- [ ] Migration de testes aplicada
- [ ] Acesso ao SQL Editor confirmado

### Execução
- [ ] Testes de propriedade executados
- [ ] Todos os testes passaram (ok)
- [ ] Nenhuma falha reportada (not ok)
- [ ] 300 iterações completadas

### Pós-Execução
- [ ] Resultados analisados
- [ ] Diagnostic Engine validado
- [ ] Pronto para próxima task

---

## 🚨 TROUBLESHOOTING

### Erro: "extension pgtap does not exist"

```sql
-- Instalar extensão pgTAP (se necessário)
CREATE EXTENSION IF NOT EXISTS pgtap;
```

### Erro: "permission denied"

- Verifique se está usando usuário com permissões adequadas
- Execute como `postgres` ou usuário com privilégios de superuser

### Testes muito lentos

- Execute testes individuais em vez do conjunto completo
- Reduza o número de iterações editando as funções (altere 100 para 10)

---

## 📈 PRÓXIMOS PASSOS

Após os testes passarem:

1. ✅ **Diagnostic Engine validado** - Funcionando corretamente
2. 🔄 **Próxima task** - Implementar Correction Engine
3. 📊 **Confiança alta** - Sistema testado com 300 cenários diferentes

---

**Execute os testes e me informe se todos passaram!**