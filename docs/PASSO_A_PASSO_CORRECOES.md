# 📋 PASSO A PASSO - APLICAR CORREÇÕES

## ✅ O QUE JÁ FOI FEITO (Código)
- [x] Correções no código TypeScript
- [x] Script SQL consolidado criado
- [x] Push para GitHub

---

## 🔧 O QUE VOCÊ PRECISA FAZER (Banco de Dados)

### PASSO 1: Acessar o Supabase Dashboard

1. Abra o navegador
2. Acesse: https://supabase.com/dashboard
3. Faça login na sua conta
4. Selecione o projeto **PE**

---

### PASSO 2: Abrir o SQL Editor

1. No menu lateral esquerdo, clique em **SQL Editor**
2. Clique em **+ New query** (ou "Nova consulta")

---

### PASSO 3: Copiar o Script SQL

1. Abra o arquivo: `docs/sql-scripts/CORRECOES_COMPLETAS.sql`
2. Selecione **TODO** o conteúdo (Ctrl+A)
3. Copie (Ctrl+C)

---

### PASSO 4: Executar o Script

1. Cole o script no SQL Editor do Supabase (Ctrl+V)
2. Clique no botão **Run** (ou pressione Ctrl+Enter)
3. Aguarde a execução (pode levar alguns segundos)

---

### PASSO 5: Verificar o Resultado

Você deve ver uma mensagem como:
```
✅ CORREÇÕES APLICADAS COM SUCESSO!
📊 Contas ativas: X
📊 Transações ativas: Y
📊 Tipos de conta: CONTA CORRENTE, POUPANÇA, CARTÃO DE CRÉDITO, ...
```

Se aparecer algum erro, me envie a mensagem completa.

---

### PASSO 6: Testar o Sistema

1. Abra o aplicativo no navegador
2. Faça um **refresh forçado** (Ctrl+Shift+R)
3. Verifique se:
   - ✅ Saldos das contas estão corretos
   - ✅ "A Receber" mostra valores de compartilhados
   - ✅ "A Pagar" mostra fatura do cartão
   - ✅ Navegação entre meses funciona sem mostrar R$ 0,00

---

## ⚠️ SE ALGO DER ERRADO

### Erro: "permission denied"
- Verifique se você está logado como owner do projeto

### Erro: "constraint violation"
- Pode haver dados com tipos inválidos
- Me envie a mensagem de erro completa

### Valores ainda zerados
- Abra o console do navegador (F12)
- Vá na aba "Console"
- Me envie os logs que aparecem

---

## 📊 RESUMO DAS CORREÇÕES

| Correção | Descrição |
|----------|-----------|
| Tipos de Conta | Padronizado para português (CARTÃO DE CRÉDITO, etc) |
| Trigger de Saldo | Agora trata refunds corretamente |
| Índices | Adicionados para melhor performance |
| Recálculo | Todos os saldos foram recalculados |

---

## 🎯 RESULTADO ESPERADO

Após aplicar as correções:

1. **Dashboard** deve mostrar valores corretos imediatamente
2. **Fatura do cartão** deve aparecer em "A Pagar"
3. **Compartilhados** devem aparecer em "A Receber"
4. **Navegação de mês** não deve mais mostrar R$ 0,00

---

*Documento criado em 18/12/2025*
