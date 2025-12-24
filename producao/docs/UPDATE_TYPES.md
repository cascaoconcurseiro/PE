# Atualização de Tipos TypeScript

## Objetivo

Garantir que os tipos TypeScript estejam sincronizados com o schema do Supabase após as correções de schema.

## Processo

### 1. Regenerar Tipos

```bash
cd producao
./scripts/regenerate-types.sh
```

Ou manualmente:

```bash
supabase gen types typescript --local > src/types/database.types.ts
```

### 2. Verificar Mudanças

Após regenerar, verificar se há mudanças significativas:

```bash
git diff src/types/database.types.ts
```

### 3. Mudanças Esperadas

Após a migration de schema corrections, esperamos:

✅ **Nenhuma mudança estrutural** - Schema já estava correto
✅ **Possíveis mudanças em comentários** - Documentação adicionada
✅ **Constraints não aparecem nos tipos** - São validações de banco

### 4. Validar Imports

Buscar por imports quebrados:

```bash
# Buscar referências a "notes" (não deve existir)
grep -r "\.notes" src/

# Buscar uso de "observation" (correto)
grep -r "\.observation" src/
```

### 5. Corrigir Código (Se Necessário)

Se encontrar referências a `notes`:

```typescript
// ❌ ERRADO
transaction.notes = "alguma nota";

// ✅ CORRETO
transaction.observation = "alguma nota";
```

## Checklist de Validação

- [ ] Tipos regenerados com sucesso
- [ ] Nenhum erro de compilação TypeScript
- [ ] Nenhuma referência a coluna "notes"
- [ ] Campo "observation" sendo usado corretamente
- [ ] Enums de type e domain estão corretos
- [ ] Testes passando

## Tipos Importantes

### Transaction Type

```typescript
type: 'RECEITA' | 'DESPESA' | 'TRANSFERÊNCIA'
```

### Transaction Domain

```typescript
domain: 'PERSONAL' | 'TRAVEL' | 'SHARED' | 'BUSINESS' | null
```

### Payer ID

```typescript
payer_id: string | null  // Pode ser 'me' ou UUID
```

## Troubleshooting

### Erro: "Property 'notes' does not exist"

**Causa:** Código tentando acessar coluna que não existe

**Solução:** Substituir por `observation`

### Erro: "Type 'X' is not assignable to type 'RECEITA' | 'DESPESA' | 'TRANSFERÊNCIA'"

**Causa:** Tentando usar valor inválido para type

**Solução:** Usar apenas valores permitidos

### Erro: Supabase CLI não encontrado

**Solução:**
```bash
npm install -g supabase
```

## Próximos Passos

Após atualizar tipos:

1. Executar testes: `npm test`
2. Validar compilação: `npm run build`
3. Verificar que não há erros TypeScript
4. Prosseguir para Checkpoint 1
