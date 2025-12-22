# Guia Rápido: Aplicar Fix de Importação de Parcelas

**Tempo**: 2 minutos  
**Ordem de Execução**: IMPORTANTE!

---

## 📋 Ordem Correta de Aplicação

### Passo 1: Aplicar a Migration Principal (OBRIGATÓRIO)

**Arquivo**: `supabase/migrations/20260221_fix_installment_import_user_id.sql`

1. Abra o Supabase Dashboard
2. Vá em **SQL Editor** → **New Query**
3. Cole o conteúdo de `20260221_fix_installment_import_user_id.sql`
4. Clique em **Run** (ou `Ctrl+Enter`)
5. Aguarde a mensagem: **"Success. No rows returned"**

✅ **Resultado Esperado**: 
```
Success. No rows returned
```

---

### Passo 2: Executar o Script de Teste (OPCIONAL)

**Arquivo**: `supabase/migrations/20260221_test_installment_import_fix.sql`

1. No mesmo SQL Editor, abra uma **New Query**
2. Cole o conteúdo de `20260221_test_installment_import_fix.sql`
3. Clique em **Run**
4. Verifique se todos os testes passam

✅ **Resultado Esperado**:
```
NOTICE: ========================================
NOTICE: VERIFICANDO FIX DE IMPORTAÇÃO DE PARCELAS
NOTICE: ========================================
NOTICE: 
NOTICE: 1. TESTE 1: Verificar se função can_access_account existe...
NOTICE:    ✅ PASSOU: Função can_access_account existe
NOTICE: 
NOTICE: 2. TESTE 2: Verificar se create_transaction foi atualizado...
NOTICE:    ✅ PASSOU: create_transaction usa can_access_account
NOTICE: 
NOTICE: 3. TESTE 3: Testar função can_access_account...
NOTICE:    ✅ PASSOU: Dono da conta tem acesso
NOTICE:    ✅ PASSOU: Usuário aleatório não tem acesso
NOTICE:    ✅ PASSOU: Conta inexistente retorna false
NOTICE:    ✅ Dados de teste removidos
NOTICE: 
NOTICE: 4. TESTE 4: Verificar estrutura de create_transaction...
NOTICE:    ✅ PASSOU: create_transaction busca user_id do dono da conta
NOTICE: 
NOTICE: ========================================
NOTICE: ✅ TODOS OS TESTES DE ESTRUTURA PASSARAM!
NOTICE: ========================================
```

---

## ❌ Erro Comum

Se você executar o **Passo 2 ANTES do Passo 1**, verá este erro:

```
ERROR: P0001: ❌ FALHOU: Função can_access_account não encontrada
```

**Solução**: Execute o **Passo 1** primeiro!

---

## 🧪 Teste Funcional (Via Aplicação)

Após aplicar a migration:

1. **Faça login** na aplicação como usuário A
2. **Acesse** uma conta de cartão de crédito
3. **Clique** em "Importar Faturas"
4. **Preencha** os valores das faturas
5. **Salve** as faturas
6. **Verifique** se as faturas aparecem na lista de transações

✅ **Resultado Esperado**: As faturas devem aparecer corretamente para o dono da conta.

---

## 📊 Verificação Rápida

Para verificar se a migration foi aplicada com sucesso:

```sql
-- Verificar se as funções existem
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('can_access_account', 'create_transaction')
ORDER BY proname;
```

✅ **Resultado Esperado**: Deve retornar 2 linhas (uma para cada função).

---

## 🆘 Troubleshooting

### Problema: "Function already exists"
**Causa**: Migration já foi aplicada  
**Solução**: Pule o Passo 1, vá direto para o Passo 2

### Problema: "Usuário não autenticado"
**Causa**: Tentando criar transações via SQL sem autenticação  
**Solução**: Use o teste funcional via aplicação (não via SQL)

### Problema: "check_account_type violation"
**Causa**: Usando valores em inglês ('CHECKING') em vez de português  
**Solução**: Já corrigido no script de teste atual

---

## ✅ Checklist Final

- [ ] Migration principal aplicada (`20260221_fix_installment_import_user_id.sql`)
- [ ] Script de teste executado com sucesso (opcional)
- [ ] Teste funcional via aplicação realizado
- [ ] Faturas aparecem corretamente para o dono da conta

---

**Status**: Pronto para produção! 🚀

**Última Atualização**: 21 de Dezembro de 2025
