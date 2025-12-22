# Correção das Parcelas "Seguro - Carro"

## Problema Identificado
- **50 parcelas** de "Seguro - Carro" no banco de dados (deveria ter apenas 10)
- **Todas marcadas como `deleted: true`** (por isso não aparecem na interface)
- **Todas sem `account_id`** (não associadas a nenhuma conta)
- **40 parcelas duplicadas** do usuário `d7f294f7-8651-47f1-844b-9e04fbca0ea5`
- **10 parcelas duplicadas** do usuário `291732a3-1f5a-4cf9-9d17-55beeefc40f6` (Wesley)

## Solução Implementada

### Arquivos Criados:
1. `supabase/migrations/20260221_complete_seguro_carro_fix.sql` - Correção completa automatizada
2. `supabase/migrations/20260221_verify_seguro_carro_fix.sql` - Verificação dos resultados

### Passos da Correção:
1. **Remover duplicatas do Wesley** - Deletar todas as 10 parcelas (são duplicatas)
2. **Remover duplicatas do usuário principal** - Manter apenas 1 parcela de cada número (1-10)
3. **Identificar conta alvo** - Encontrar conta de cartão de crédito ativa do usuário
4. **Restaurar parcelas** - Marcar como `deleted: false` e associar à conta
5. **Verificar resultado** - Confirmar que temos exatamente 10 parcelas ativas

## Como Executar

### Opção 1: Via Supabase Dashboard
1. Acesse o Supabase Dashboard
2. Vá para SQL Editor
3. Execute o conteúdo de `supabase/migrations/20260221_complete_seguro_carro_fix.sql`
4. Execute o conteúdo de `supabase/migrations/20260221_verify_seguro_carro_fix.sql` para verificar

### Opção 2: Via CLI (se Docker estiver rodando)
```bash
cd supabase
npx supabase start
npx supabase migration up --local
```

## Resultado Esperado
- **10 parcelas ativas** de "Seguro - Carro" (numeradas de 1 a 10)
- **Todas associadas** à conta do usuário `d7f294f7-8651-47f1-844b-9e04fbca0ea5`
- **Todas visíveis** na interface do usuário B
- **Zero duplicatas** no banco de dados

## Verificação
Após executar a correção, o usuário B deve ver todas as 10 parcelas de "Seguro - Carro" na interface.