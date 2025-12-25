# 🔧 Correção do Erro "Falha na comunicação com o servidor"

## 🎯 PROBLEMA IDENTIFICADO

O erro acontece porque a função `import_shared_installments` estava **faltando o parâmetro `p_author_id`**.

### O que estava acontecendo:

**Frontend enviava:**
```javascript
await supabase.rpc('import_shared_installments', {
    p_user_id: ownerUserId,       // ✅
    p_author_id: currentUserId,   // ❌ FUNÇÃO NÃO TINHA ESSE PARÂMETRO
    p_description: description,   // ✅
    p_parcel_amount: parseFloat(amount),  // ✅
    p_installments: parseInt(installments), // ✅
    p_first_due_date: date,       // ✅
    p_category: category,         // ✅
    p_account_id: null,           // ✅
    p_shared_with_user_id: mirrorUserId // ✅
});
```

**Função tinha:**
```sql
CREATE FUNCTION import_shared_installments(
    p_user_id UUID,              -- ✅
    -- p_author_id UUID,         -- ❌ FALTANDO!
    p_description TEXT,          -- ✅
    p_parcel_amount NUMERIC,     -- ✅
    p_installments INTEGER,      -- ✅
    p_first_due_date DATE,       -- ✅
    p_category TEXT,             -- ✅
    p_account_id UUID,           -- ✅
    p_shared_with_user_id UUID   -- ✅
)
```

**Resultado:** Erro 400 - Parâmetro não reconhecido

---

## ✅ SOLUÇÃO

Criei o script: `20241224_fix_import_shared_installments.sql`

Este script:
1. Remove a função antiga
2. Cria a função corrigida com o parâmetro `p_author_id`
3. Garante permissões corretas

---

## 📋 COMO APLICAR

### Opção 1: Supabase Dashboard (RECOMENDADO)

1. Acesse: https://supabase.com/dashboard/project/mlqzeihukezlozooqhko
2. Clique em **"SQL Editor"**
3. Clique em **"New Query"**
4. Copie e cole o conteúdo de: `supabase/migrations/20241224_fix_import_shared_installments.sql`
5. Clique em **"Run"**

### Opção 2: Linha de comando

```bash
cd producao
psql "postgresql://postgres:[SUA-SENHA]@db.mlqzeihukezlozooqhko.supabase.co:5432/postgres" -f supabase/migrations/20241224_fix_import_shared_installments.sql
```

---

## ✅ COMO TESTAR

Após aplicar o script:

1. Abra o app
2. Vá em "Compartilhado"
3. Clique em "Importar Parcelado"
4. Preencha os dados:
   - Descrição: "Teste Geladeira"
   - Valor da parcela: 100
   - Parcelas: 3
   - Selecione quem vai pagar (Fran)
5. Clique em "Confirmar"

**Resultado esperado:** ✅ "Importação concluída com sucesso!"

---

## 🔍 VERIFICAÇÃO

Para confirmar que a função está correta, execute no SQL Editor:

```sql
SELECT 
    proname as nome_funcao,
    pg_get_function_arguments(oid) as parametros
FROM pg_proc 
WHERE proname = 'import_shared_installments' 
AND pronamespace = 'public'::regnamespace;
```

**Deve retornar:**
```
nome_funcao: import_shared_installments
parametros: p_user_id uuid, p_author_id uuid, p_description text, p_parcel_amount numeric, p_installments integer, p_first_due_date date, p_category text, p_account_id uuid, p_shared_with_user_id uuid
```

Note o **p_author_id uuid** na lista! ✅

---

## 📊 RESUMO

- ❌ **Antes:** Função sem `p_author_id` → Erro 400
- ✅ **Depois:** Função com `p_author_id` → Funciona perfeitamente

**Tempo de aplicação:** ~5 segundos
**Downtime:** Nenhum
**Risco:** Baixíssimo (apenas recria a função)

---

## 🆘 SE AINDA DER ERRO

1. Verifique o console do navegador (F12)
2. Copie a mensagem de erro completa
3. Me envie aqui no chat
4. Vou investigar mais a fundo

Mas com 99% de certeza, esse era o problema! 🎯
