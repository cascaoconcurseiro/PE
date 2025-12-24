# 🚀 PASSO A PASSO - APLICAR CORREÇÕES

## 📋 PARTE 1: BANCO DE DADOS (Supabase)

### 1. Abra o Supabase Dashboard
- Acesse: https://supabase.com/dashboard
- Faça login
- Selecione o projeto "Pedemeia"

### 2. Vá para o SQL Editor
- No menu lateral, clique em **"SQL Editor"**
- Ou acesse diretamente: https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/sql

### 3. Execute o Script
- Abra o arquivo: `producao/EXECUTAR_NO_SUPABASE.sql`
- Copie TODO o conteúdo
- Cole no SQL Editor do Supabase
- Clique em **"Run"** (ou pressione Ctrl+Enter)

### 4. Verifique o Resultado
Você deve ver no final:
```
total_funcoes: 1
parcelas_antigas: 0
```

✅ Se viu isso, o banco está correto!

---

## 💻 PARTE 2: CÓDIGO FRONTEND

### 1. Verifique se o Código Foi Atualizado

Abra o arquivo: `producao/src/components/shared/SharedInstallmentImport.tsx`

Procure pela linha ~110 e verifique se está assim:

```typescript
const totalValue = parseFloat(amount); // Valor TOTAL a ser parcelado
const numInstallments = parseInt(installments);
const installmentValue = totalValue / numInstallments; // Valor de CADA parcela
```

✅ Se está assim, o código está correto!

### 2. Recompile o Projeto (se necessário)

Se você estiver rodando em desenvolvimento:

```bash
cd producao
npm run dev
```

Ou se estiver em produção, faça o build:

```bash
cd producao
npm run build
```

---

## 🧪 PARTE 3: TESTE

### 1. Limpe o Cache do Navegador
- Pressione **Ctrl+Shift+R** (Windows/Linux)
- Ou **Cmd+Shift+R** (Mac)
- Ou feche e abra o navegador novamente

### 2. Teste com Importação Compartilhada

1. Abra a aplicação
2. Vá em **"Compartilhado"**
3. Clique em **"Importar Parcelado"**
4. Preencha:
   - **Descrição:** Teste Final
   - **Valor Total:** 100
   - **Parcelas:** 10
   - Selecione categoria, conta e membro
5. Clique em **"Confirmar 10x de R$ 10,00"**

### 3. Verifique o Resultado

Deve criar:
- ✅ 10 parcelas
- ✅ Cada uma de R$ 10,00
- ✅ Uma por mês (jan, fev, mar, etc.)
- ✅ Total: R$ 100,00

### 4. Teste com Formulário Normal

1. Clique no botão **"+"**
2. Preencha:
   - **Descrição:** Teste Cartão
   - **Valor:** 100
   - Selecione um **cartão de crédito**
   - Marque **"Parcelado"**
   - **Parcelas:** 10
3. Salve

Deve criar:
- ✅ 10 parcelas de R$ 10,00 cada
- ✅ Uma por mês

---

## ❌ SE AINDA NÃO FUNCIONAR

### Verifique o Console do Navegador

1. Pressione **F12**
2. Vá na aba **"Console"**
3. Procure por erros em vermelho
4. Tire um print e me envie

### Verifique o Banco de Dados

Execute no Supabase SQL Editor:

```sql
-- Ver as últimas parcelas criadas
SELECT 
    description,
    amount,
    date,
    current_installment,
    total_installments,
    created_at
FROM transactions 
WHERE is_installment = true 
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC, current_installment;
```

Se mostrar parcelas com valor errado (ex: 100 em vez de 10), o problema está no código frontend.

### Verifique a Função do Banco

Execute no Supabase SQL Editor:

```sql
-- Deve retornar apenas 1 função
SELECT COUNT(*) 
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'create_financial_record';
```

Se retornar 2, execute novamente o script `EXECUTAR_NO_SUPABASE.sql`.

---

## 📞 PRECISA DE AJUDA?

Me envie:
1. Print do erro (se houver)
2. Print do console do navegador (F12)
3. Resultado da query de verificação do banco
4. Qual fluxo você está usando (importação ou formulário normal)

---

## ✅ CHECKLIST FINAL

- [ ] Script SQL executado no Supabase
- [ ] Função create_financial_record tem 16 parâmetros
- [ ] Parcelas antigas deletadas
- [ ] Código frontend atualizado
- [ ] Cache do navegador limpo
- [ ] Teste com importação funcionou
- [ ] Teste com formulário funcionou

**Se todos os itens estão marcados, está tudo pronto!** 🎉
