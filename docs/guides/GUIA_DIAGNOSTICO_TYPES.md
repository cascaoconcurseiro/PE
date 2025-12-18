# 🔍 GUIA DE DIAGNÓSTICO - Valores de TYPE

## ✅ Status Atual

- ✅ **Sem valores NULL** em `accounts.type` e `transactions.type`
- ⚠️ **Próximo passo:** Verificar se há valores inválidos

---

## 📋 Passo 1: Executar Diagnóstico Completo

Execute este script no Supabase SQL Editor:

**Arquivo:** `supabase/migrations/20260128_verificar_valores_type.sql`

Este script mostra:
1. Todos os tipos de conta existentes
2. Quais são válidos vs inválidos
3. Quantos registros precisam ser corrigidos

---

## 📊 O Que Esperar

### Se TUDO estiver OK:
```
status  | type         | quantidade
--------|--------------|------------
VÁLIDO  | CHECKING     | 5
VÁLIDO  | SAVINGS      | 3
VÁLIDO  | CREDIT_CARD  | 2
```

### Se houver PROBLEMAS:
```
status  | type         | quantidade
--------|--------------|------------
INVÁLIDO| BANCO        | 2
INVÁLIDO| CARTÃO       | 1
VÁLIDO  | CHECKING     | 5
```

---

## 🔧 Passo 2: Executar Migration

Após verificar os valores:

1. **Se houver valores inválidos:**
   - A migration corrige automaticamente `accounts.type` → 'OTHER'
   - Para `transactions.type`, apenas avisa (não corrige automaticamente)

2. **Se tudo estiver OK:**
   - A migration adiciona as constraints normalmente

---

## ⚠️ IMPORTANTE

- A migration é **SEGURA** - não quebra nada
- Valores inválidos em `accounts` são corrigidos automaticamente
- Valores inválidos em `transactions` precisam correção manual (se houver)

---

## 🎯 Próximos Passos

1. Execute `20260128_verificar_valores_type.sql`
2. Envie os resultados (ou execute a migration diretamente)
3. A migration mostrará o que foi corrigido

