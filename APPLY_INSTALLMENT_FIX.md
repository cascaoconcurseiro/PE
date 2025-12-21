# Guia de Aplicação: Fix de Importação de Parcelas

**Data**: 21 de Dezembro de 2025  
**Tempo Estimado**: 5 minutos  
**Risco**: Baixo

---

## 📋 Pré-requisitos

- ✅ Acesso ao Supabase Dashboard ou CLI
- ✅ Permissões de administrador no banco de dados
- ✅ Backup recente do banco de dados (recomendado)

---

## 🚀 Passo a Passo

### Opção 1: Via Supabase Dashboard (Recomendado)

1. **Acesse o Supabase Dashboard**
   - Vá para: https://app.supabase.com
   - Selecione seu projeto

2. **Abra o SQL Editor**
   - No menu lateral, clique em "SQL Editor"
   - Clique em "New Query"

3. **Cole o Script de Migration**
   - Abra o arquivo: `supabase/migrations/20260221_fix_installment_import_user_id.sql`
   - Copie todo o conteúdo
   - Cole no SQL Editor

4. **Execute a Migration**
   - Clique em "Run" ou pressione `Ctrl+Enter`
   - Aguarde a mensagem de sucesso: "Success. No rows returned"

5. **Verifique a Aplicação**
   - Execute o script de teste (opcional mas recomendado)
   - Abra: `supabase/migrations/20260221_test_installment_import_fix.sql`
   - Cole no SQL Editor e execute
   - Verifique se todos os testes passam (✅)

### Opção 2: Via Supabase CLI

```bash
# 1. Certifique-se de estar na raiz do projeto
cd /caminho/para/seu/projeto

# 2. Aplique a migration
supabase db push

# 3. Ou aplique manualmente
supabase db execute -f supabase/migrations/20260221_fix_installment_import_user_id.sql

# 4. (Opcional) Execute os testes
supabase db execute -f supabase/migrations/20260221_test_installment_import_fix.sql
```

---

## ✅ Verificação

### Verificação Manual

Execute esta query no SQL Editor para verificar se as funções foram criadas:

```sql
-- Verificar se a função can_access_account existe
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'can_access_account';

-- Verificar se create_transaction foi atualizado
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'create_transaction';
```

**Resultado Esperado**: Ambas as queries devem retornar resultados.

### Teste Funcional

1. **Faça login como User A**
2. **Acesse uma conta de cartão de crédito**
3. **Importe faturas usando o modal de importação**
4. **Faça logout e login como User B (dono da conta)**
5. **Verifique se as faturas aparecem**

**Resultado Esperado**: User B deve ver todas as faturas importadas por User A.

---

## 🔄 Rollback (Se Necessário)

Se algo der errado, você pode reverter para a versão anterior:

```sql
-- Restaurar versão anterior do create_transaction
-- (Execute o conteúdo do arquivo 20260127_consolidacao_final_rpc_e_balance.sql)

-- Remover função auxiliar
DROP FUNCTION IF EXISTS public.can_access_account(UUID, UUID);
```

**Nota**: O rollback não afeta transações já criadas. Apenas restaura o comportamento antigo para novas transações.

---

## 📊 Monitoramento

### Logs a Observar

Após aplicar o fix, monitore os logs do Supabase para mensagens como:

```
NOTICE: [create_transaction] Usuário atual: abc-123, Dono da conta: xyz-789, Usando user_id: xyz-789
```

### Queries de Monitoramento

```sql
-- Verificar transações criadas nas últimas 24h
SELECT 
    t.id,
    t.description,
    t.user_id as transaction_user_id,
    a.user_id as account_owner_id,
    t.user_id = a.user_id as user_ids_match,
    t.created_at
FROM transactions t
JOIN accounts a ON t.account_id::uuid = a.id
WHERE t.created_at > NOW() - INTERVAL '24 hours'
ORDER BY t.created_at DESC;

-- Resultado esperado: user_ids_match deve ser TRUE para todas as linhas
```

---

## 🐛 Troubleshooting

### Problema: "Function already exists"

**Solução**: A migration usa `CREATE OR REPLACE`, então isso não deve acontecer. Se acontecer:

```sql
DROP FUNCTION IF EXISTS public.create_transaction CASCADE;
DROP FUNCTION IF EXISTS public.can_access_account CASCADE;
-- Depois execute a migration novamente
```

### Problema: "Permission denied"

**Solução**: Certifique-se de estar usando um usuário com permissões de administrador:

```sql
-- Verificar permissões
SELECT current_user, current_database();

-- Se necessário, conecte como postgres ou service_role
```

### Problema: Testes falhando

**Solução**: Verifique os logs detalhados:

```sql
-- Habilitar logs detalhados
SET client_min_messages TO NOTICE;

-- Execute os testes novamente
-- Analise as mensagens de erro
```

---

## 📞 Suporte

Se encontrar problemas:

1. **Verifique os logs do Supabase**
   - Dashboard > Logs > Postgres Logs

2. **Execute o script de diagnóstico**
   ```sql
   -- Verificar estado das funções
   SELECT 
       proname as function_name,
       pg_get_functiondef(oid) as definition
   FROM pg_proc
   WHERE proname IN ('create_transaction', 'can_access_account');
   ```

3. **Consulte a documentação**
   - `INSTALLMENT_IMPORT_FIX_SUMMARY.md` - Detalhes técnicos
   - `BUG_FIXES_PROGRESS.md` - Contexto geral

---

## ✅ Checklist Final

Antes de considerar a aplicação completa, verifique:

- [ ] Migration aplicada com sucesso (sem erros)
- [ ] Testes executados e passando (se aplicável)
- [ ] Funções criadas e visíveis no banco
- [ ] Teste funcional realizado (importação de faturas)
- [ ] Logs monitorados (sem erros críticos)
- [ ] Documentação atualizada (se necessário)

---

## 🎉 Conclusão

Após seguir este guia, o fix de importação de parcelas estará aplicado e funcionando.

**Benefícios Imediatos**:
- ✅ Parcelas importadas aparecem para o dono da conta
- ✅ Dados consistentes entre usuários
- ✅ Validação de segurança robusta
- ✅ Sistema pronto para compartilhamento familiar

**Próximos Passos**:
1. Monitorar logs por 24-48 horas
2. Coletar feedback dos usuários
3. Considerar expansão para compartilhamento familiar

---

**Status**: ✅ PRONTO PARA APLICAÇÃO

**Última Atualização**: 21 de Dezembro de 2025
