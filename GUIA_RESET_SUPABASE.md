# 🔄 GUIA: Como Resetar o Banco de Dados Supabase

## ⚠️ ATENÇÃO
Este processo irá **DELETAR TODOS OS DADOS** do banco de dados, mas manterá a estrutura (tabelas, colunas, constraints).

---

## 📋 Passo a Passo

### 1️⃣ Abrir o Supabase Dashboard

1. Acesse: https://supabase.com/dashboard
2. Faça login na sua conta
3. Selecione o projeto **PE** (Pé de Meia)

---

### 2️⃣ Abrir o SQL Editor

1. No menu lateral esquerdo, clique em **SQL Editor**
2. Clique em **New Query** (Nova Consulta)

---

### 3️⃣ Copiar o Script

Copie **TODO** o conteúdo do arquivo `RESET_SUPABASE.sql`:

```sql
-- ========================================
-- SCRIPT DE RESET COMPLETO DO SUPABASE
-- ========================================
-- ⚠️ ATENÇÃO: Este script irá DELETAR TODOS OS DADOS!
-- Execute no Supabase Dashboard > SQL Editor
-- ========================================

BEGIN;

-- 1. DELETAR TODOS OS DADOS (mantém estrutura)
-- ========================================

-- Deletar na ordem correta (respeitando foreign keys)
DELETE FROM public.snapshots;
DELETE FROM public.custom_categories;
DELETE FROM public.family_members;
DELETE FROM public.goals;
DELETE FROM public.budgets;
DELETE FROM public.assets;
DELETE FROM public.trips;
DELETE FROM public.transactions;
DELETE FROM public.accounts;
DELETE FROM public.profiles;

-- 2. RESETAR SEQUENCES (IDs voltam para 1)
-- ========================================

-- Não há sequences para resetar pois usamos UUIDs

-- 3. VERIFICAR RESULTADO
-- ========================================

-- Contar registros em cada tabela (deve ser 0)
SELECT 
    'profiles' as tabela, COUNT(*) as registros FROM public.profiles
UNION ALL
SELECT 'accounts', COUNT(*) FROM public.accounts
UNION ALL
SELECT 'transactions', COUNT(*) FROM public.transactions
UNION ALL
SELECT 'trips', COUNT(*) FROM public.trips
UNION ALL
SELECT 'assets', COUNT(*) FROM public.assets
UNION ALL
SELECT 'budgets', COUNT(*) FROM public.budgets
UNION ALL
SELECT 'goals', COUNT(*) FROM public.goals
UNION ALL
SELECT 'family_members', COUNT(*) FROM public.family_members
UNION ALL
SELECT 'custom_categories', COUNT(*) FROM public.custom_categories
UNION ALL
SELECT 'snapshots', COUNT(*) FROM public.snapshots;

COMMIT;

-- ========================================
-- MENSAGEM FINAL
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '✅ BANCO DE DADOS RESETADO COM SUCESSO!';
    RAISE NOTICE '';
    RAISE NOTICE 'Todas as tabelas foram esvaziadas.';
    RAISE NOTICE 'A estrutura do banco foi mantida.';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ Faça logout e login novamente no aplicativo.';
END $$;
```

---

### 4️⃣ Colar e Executar

1. Cole o script completo no SQL Editor
2. Clique no botão **Run** (Executar) ou pressione `Ctrl+Enter`
3. Aguarde a execução (deve levar alguns segundos)

---

### 5️⃣ Verificar Resultado

Após a execução, você verá:

#### Tabela de Resultados:
```
tabela              | registros
--------------------|----------
profiles            | 0
accounts            | 0
transactions        | 0
trips               | 0
assets              | 0
budgets             | 0
goals               | 0
family_members      | 0
custom_categories   | 0
snapshots           | 0
```

✅ **Todos os registros devem estar em 0**

#### Mensagens:
```
✅ BANCO DE DADOS RESETADO COM SUCESSO!

Todas as tabelas foram esvaziadas.
A estrutura do banco foi mantida.

⚠️ Faça logout e login novamente no aplicativo.
```

---

### 6️⃣ Fazer Logout e Login no App

1. Abra o aplicativo Pé de Meia
2. Clique no botão **Sair** (canto inferior esquerdo)
3. Faça login novamente
4. O sistema estará limpo e pronto para usar

---

## ✅ Checklist

- [ ] Abri o Supabase Dashboard
- [ ] Abri o SQL Editor
- [ ] Copiei o script completo
- [ ] Executei o script
- [ ] Verifiquei que todas as tabelas têm 0 registros
- [ ] Fiz logout no app
- [ ] Fiz login novamente
- [ ] Sistema está funcionando limpo

---

## 🆘 Problemas Comuns

### Erro: "permission denied"
**Solução:** Você precisa ter permissões de administrador no projeto Supabase.

### Erro: "violates foreign key constraint"
**Solução:** O script já deleta na ordem correta. Se der erro, execute linha por linha.

### App não carrega após reset
**Solução:** 
1. Limpe o cache do navegador (Ctrl+Shift+Delete)
2. Faça logout e login novamente
3. Recarregue a página (F5)

---

## 📝 Notas Importantes

1. ✅ **Estrutura mantida:** Todas as tabelas, colunas e constraints permanecem
2. ✅ **Apenas dados deletados:** Você pode começar a usar imediatamente
3. ✅ **Reversível:** Você pode restaurar de um backup se tiver
4. ⚠️ **Irreversível:** Sem backup, os dados são perdidos permanentemente

---

**Data:** 2025-12-04  
**Tempo estimado:** 2-3 minutos  
**Dificuldade:** Fácil
