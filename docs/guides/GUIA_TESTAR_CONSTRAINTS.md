# 🧪 GUIA: Como Testar as Constraints

## ✅ Migration Aplicada com Sucesso!

Agora vamos verificar se tudo está funcionando corretamente.

---

## 🔍 OPÇÃO 1: Script Automático de Teste

Execute este script no Supabase SQL Editor:

**Arquivo:** `supabase/migrations/20260128_testar_constraints.sql`

Este script:
- ✅ Usa seu user_id automaticamente
- ✅ Testa todas as constraints
- ✅ Mostra resultados claros
- ✅ Não quebra nada (limpa dados de teste)

---

## 🔍 OPÇÃO 2: Testes Manuais

### Teste 1: Constraint de Account Type

```sql
-- 1. Obter seu user_id
SELECT id FROM auth.users LIMIT 1;

-- 2. Tentar inserir tipo inválido (deve FALHAR)
INSERT INTO accounts (user_id, name, type, balance, currency)
VALUES (
  'SEU-USER-ID-AQUI',  -- Substitua pelo ID real
  'Teste', 
  'TIPO_INVALIDO',     -- Tipo inválido
  0, 
  'BRL'
);
-- Esperado: ERRO de constraint
```

### Teste 2: Constraint de Transaction Type

```sql
-- 1. Obter account_id válido
SELECT id FROM accounts WHERE user_id = 'SEU-USER-ID' LIMIT 1;

-- 2. Tentar inserir tipo inválido (deve FALHAR)
INSERT INTO transactions (user_id, description, amount, date, type, account_id)
VALUES (
  'SEU-USER-ID',
  'Teste',
  100,
  CURRENT_DATE,
  'TIPO_INVALIDO',  -- Tipo inválido
  'SEU-ACCOUNT-ID'
);
-- Esperado: ERRO de constraint
```

### Teste 3: Validação de Splits

```sql
-- 1. Criar transação de teste (R$ 100,00)
INSERT INTO transactions (user_id, description, amount, date, type, account_id, is_shared)
VALUES (
  'SEU-USER-ID',
  'Teste Split',
  100.00,
  CURRENT_DATE,
  'DESPESA',
  'SEU-ACCOUNT-ID',
  true
)
RETURNING id;

-- 2. Tentar criar split que excede total (deve FALHAR)
INSERT INTO transaction_splits (transaction_id, member_id, user_id, assigned_amount)
VALUES (
  'ID-DA-TRANSACAO-ACIMA',
  'SEU-USER-ID',
  'SEU-USER-ID',
  150.00  -- Excede os R$ 100,00
);
-- Esperado: ERRO de validação
```

---

## ✅ Verificar Saúde do Sistema

```sql
-- Ver se há problemas detectados
SELECT * FROM view_system_health;

-- Se retornar 0 linhas ou count = 0, tudo está OK! ✅
```

---

## 🎯 Resultado Esperado

### ✅ Se tudo estiver OK:
- Constraints bloqueiam valores inválidos
- Splits validados automaticamente
- View de saúde mostra 0 problemas
- Sistema funcionando normalmente

### ⚠️ Se houver problemas:
- Ver mensagens de erro específicas
- Consultar `view_system_health`
- Revisar logs do Supabase

---

## 📋 Checklist

- [ ] Executar script de teste automático
- [ ] Verificar view de saúde
- [ ] Testar sistema normalmente
- [ ] Confirmar que tudo funciona

---

## 💡 Dica

**Use o script automático** (`20260128_testar_constraints.sql`) - ele faz tudo automaticamente e mostra resultados claros!

