# 🚀 Como Aplicar a Migration AGORA

**Migration:** `20260224_fix_critical_issues.sql`  
**Tempo:** 2 minutos

---

## Opção 1: Via Supabase Dashboard (RECOMENDADO)

### Passo 1: Acessar SQL Editor

1. Abrir: https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/sql
2. Fazer login se necessário

### Passo 2: Copiar SQL

Abrir o arquivo: `producao/supabase/migrations/20260224_fix_critical_issues.sql`

**OU** copiar daqui:

```sql
-- Copie TODO o conteúdo do arquivo 20260224_fix_critical_issues.sql
-- Ele tem aproximadamente 400 linhas
```

### Passo 3: Colar e Executar

1. Colar o SQL no editor
2. Clicar em "Run" (ou Ctrl+Enter)
3. Aguardar mensagem de sucesso

### Passo 4: Verificar

Execute para validar:

```sql
-- Verificar triggers desabilitados
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname IN ('trg_sync_ddd_ledger', 'sync_transaction_to_ddd_ledger');
-- Resultado esperado: tgenabled = 'D' ou nenhuma linha

-- Verificar coluna notes
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'transactions' AND column_name = 'notes';
-- Resultado esperado: 1 linha

-- Verificar funções criadas
SELECT proname 
FROM pg_proc 
WHERE proname IN ('calculate_cash_flow', 'get_receivables_payables', 'get_account_balance');
-- Resultado esperado: 3 linhas

-- Testar função
SELECT * FROM calculate_cash_flow(
    (SELECT id FROM auth.users WHERE deleted_at IS NULL LIMIT 1),
    2025
) LIMIT 3;
-- Resultado esperado: Retorna dados sem erro
```

---

## Opção 2: Via psql (Se tiver instalado)

```bash
# Conectar ao banco
psql "postgresql://postgres:[YOUR-PASSWORD]@db.mlqzeihukezlozooqhko.supabase.co:5432/postgres"

# Executar migration
\i producao/supabase/migrations/20260224_fix_critical_issues.sql

# Verificar
\df calculate_cash_flow
```

---

## Opção 3: Instalar Supabase CLI e Aplicar

```bash
# Instalar Supabase CLI
npm install -g supabase

# Fazer login
supabase login

# Linkar projeto
cd producao
supabase link --project-ref mlqzeihukezlozooqhko

# Aplicar migration
supabase db push
```

---

## ✅ Após Aplicar

### Testar no Frontend

1. Abrir aplicação: http://localhost:5173
2. Criar transação normal → Deve funcionar sem erro
3. Verificar lista de transações → Transações compartilhadas devem aparecer
4. Verificar dashboard → Cash flow deve estar correto

### Testar Funções RPC

```typescript
// No console do navegador (F12)
const { data, error } = await supabase.rpc('get_receivables_payables', {
    p_user_id: 'seu-user-id'
});
console.log('Receivables:', data.receivables);
console.log('Payables:', data.payables);
```

---

## 🆘 Se Houver Erro

### Erro: "relation does not exist"

**Causa:** Tabela não existe no banco.

**Solução:** Verificar se está conectado ao banco correto.

### Erro: "permission denied"

**Causa:** Usuário não tem permissão.

**Solução:** Usar usuário `postgres` (admin) no dashboard.

### Erro: "syntax error"

**Causa:** SQL copiado incorretamente.

**Solução:** Copiar novamente o arquivo completo.

---

## 📞 Suporte

**Arquivo da Migration:** `producao/supabase/migrations/20260224_fix_critical_issues.sql`  
**Documentação:** `producao/docs/GUIA_APLICACAO_CORRECOES.md`  
**Dashboard:** https://supabase.com/dashboard/project/mlqzeihukezlozooqhko

---

**Tempo Estimado:** 2 minutos  
**Dificuldade:** Fácil  
**Risco:** Baixo (migration é idempotente)
