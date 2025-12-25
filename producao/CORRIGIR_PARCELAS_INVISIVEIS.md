# 🔧 Corrigir Parcelas Compartilhadas Invisíveis

## 🎯 Problema

Você cria uma parcela compartilhada para o usuário B, mas:
- ✅ Você consegue ver a parcela
- ❌ O usuário B NÃO consegue ver

## 💡 Causa

O trigger que cria os "espelhos" das transações compartilhadas foi removido acidentalmente.

## ✅ Solução Rápida

### Opção 1: Script Automático (Recomendado)

```powershell
cd producao
.\aplicar-correcao-espelhos.ps1
```

### Opção 2: Manual via Supabase Dashboard

1. Acesse: https://supabase.com/dashboard
2. Vá em: SQL Editor
3. Execute na ordem:

**Primeiro:**
```sql
-- Copie e cole o conteúdo de:
-- supabase/migrations/20241225_restore_shared_sync_trigger.sql
```

**Depois:**
```sql
-- Copie e cole o conteúdo de:
-- supabase/migrations/20241225_backfill_missing_mirrors.sql
```

### Opção 3: Via CLI

```bash
cd producao
supabase db push
```

## 🧪 Como Testar

1. **Criar nova parcela:**
   - Importe uma nova parcela compartilhada
   - Atribua ao usuário B
   - Verifique se aparece para ambos

2. **Verificar parcelas antigas:**
   - As parcelas existentes devem aparecer agora
   - Ambos os usuários devem ver

## 📋 O Que Foi Corrigido

1. **Trigger restaurado:** Agora cria espelhos automaticamente
2. **Transações antigas:** Espelhos criados retroativamente
3. **Futuras transações:** Funcionarão automaticamente

## 🔍 Verificar se Funcionou

Execute no SQL Editor do Supabase:

```sql
-- Deve retornar 0 linhas (sem transações sem espelhos)
SELECT COUNT(*) as transacoes_sem_espelho
FROM transactions t
WHERE t.is_shared = true
  AND t.shared_with IS NOT NULL
  AND jsonb_array_length(t.shared_with) > 0
  AND NOT EXISTS (
      SELECT 1
      FROM transactions mirror
      WHERE mirror.payer_id = t.user_id::text
      AND mirror.date = t.date
      AND mirror.is_shared = true
  );
```

## 📚 Documentação Completa

Para mais detalhes técnicos, veja:
- `SOLUCAO_PARCELAS_COMPARTILHADAS_INVISIVEIS.md`

## ⚠️ Importante

- Faça backup antes de aplicar (opcional, mas recomendado)
- As migrations são seguras e reversíveis
- Não afeta transações normais (não compartilhadas)
