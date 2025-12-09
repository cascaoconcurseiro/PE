# 🔧 Correções Urgentes Necessárias

## 🔴 PROBLEMA CRÍTICO: React Error #426

### Causa Identificada
O erro #426 está sendo causado pelo hook `useSettings` que tenta acessar a tabela `user_settings` no Supabase, que **não existe**.

### Erro no Console
```
mlqzeihukezlozooqhko.supabase.co/rest/v1/user_settings?select=*&user_id=eq.d7f294f7-8651-47f1-844b-9e04fbca0ea5:1  
Failed to load resource: the server responded with a status of 404 ()
```

### Solução Imediata

**Opção 1: Criar a tabela `user_settings` no Supabase**

Execute este SQL no Supabase:

```sql
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notifications JSONB DEFAULT '{}'::jsonb,
    security JSONB DEFAULT '{}'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb,
    privacy JSONB DEFAULT '{}'::jsonb,
    appearance JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can manage their own settings"
ON public.user_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_user_settings_user_id ON public.user_settings(user_id);
```

**Opção 2: Desabilitar temporariamente o useSettings**

Modifique `hooks/useSettings.tsx` linhas 63-91 para comentar as chamadas ao Supabase e usar apenas localStorage.

---

## 🎨 PROBLEMA: Logo não aparece

### Causa
O Vercel está usando cache do build anterior. Os novos ícones foram enviados mas o navegador ainda está carregando os antigos.

### Solução
1. Limpar cache do Vercel
2. Fazer hard refresh no navegador (Ctrl+Shift+R)
3. Aguardar próximo deploy completar

---

## 📋 Checklist de Correções

- [ ] Criar tabela `user_settings` no Supabase
- [ ] Testar login sem erro #426
- [ ] Verificar se logo da meia aparece
- [ ] Confirmar que formulário de transação abre
- [ ] Validar que não há mais erros 404

---

**Criado em:** 2025-12-05 15:12  
**Prioridade:** 🔴 CRÍTICA
