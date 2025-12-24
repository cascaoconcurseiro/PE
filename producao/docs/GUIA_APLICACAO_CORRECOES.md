# Guia de Aplicação das Correções

**Data:** 2024-12-24  
**Tempo Estimado:** 15 minutos

---

## 🚀 Passo a Passo

### Passo 1: Verificar Arquivos Modificados ✅ COMPLETO

Os seguintes arquivos já foram corrigidos:

1. ✅ `producao/src/utils/transactionFilters.ts`
2. ✅ `producao/src/utils/SafeFinancialCalculations.ts`
3. ✅ `producao/supabase/migrations/20260224_fix_critical_issues.sql` (NOVO)

**Ação:** Nenhuma ação necessária - arquivos já corrigidos.

---

### Passo 2: Aplicar Migration no Banco de Dados

#### Opção A: Via Supabase CLI (Recomendado)

```bash
# 1. Navegar para o diretório do projeto
cd producao

# 2. Aplicar migration
supabase db push

# 3. Verificar se foi aplicada
supabase db diff
```

#### Opção B: Via Supabase Dashboard

1. Acessar: https://app.supabase.com/project/YOUR_PROJECT/sql
2. Copiar conteúdo de `producao/supabase/migrations/20260224_fix_critical_issues.sql`
3. Colar no editor SQL
4. Clicar em "Run"
5. Verificar mensagens de sucesso

#### Opção C: Via psql

```bash
# Conectar ao banco
psql -h db.YOUR_PROJECT.supabase.co -U postgres -d postgres

# Executar migration
\i producao/supabase/migrations/20260224_fix_critical_issues.sql

# Verificar funções criadas
\df calculate_cash_flow
\df get_receivables_payables
\df get_account_balance
```

---

### Passo 3: Validar Correções no Banco

Execute os seguintes comandos SQL para validar:

```sql
-- 1. Verificar se triggers foram desabilitados
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname IN ('trg_sync_ddd_ledger', 'sync_transaction_to_ddd_ledger');
-- Resultado esperado: tgenabled = 'D' (disabled)

-- 2. Verificar se coluna notes existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions' AND column_name = 'notes';
-- Resultado esperado: 1 linha retornada

-- 3. Testar função calculate_cash_flow
SELECT * FROM calculate_cash_flow(
    (SELECT id FROM auth.users WHERE deleted_at IS NULL LIMIT 1),
    2025
) LIMIT 3;
-- Resultado esperado: Retorna meses com income e expense

-- 4. Testar função get_receivables_payables
SELECT receivables, payables 
FROM get_receivables_payables(
    (SELECT id FROM auth.users WHERE deleted_at IS NULL LIMIT 1)
);
-- Resultado esperado: Retorna valores numéricos

-- 5. Testar criação de transação
INSERT INTO transactions (
    user_id, 
    description, 
    amount, 
    type, 
    category, 
    date, 
    account_id, 
    currency
) VALUES (
    (SELECT id FROM auth.users WHERE deleted_at IS NULL LIMIT 1),
    'Teste de correção',
    10.00,
    'DESPESA',
    'Alimentação',
    CURRENT_DATE,
    (SELECT id FROM accounts WHERE deleted = false LIMIT 1),
    'BRL'
);
-- Resultado esperado: INSERT 0 1 (sucesso, sem erro)

-- 6. Limpar teste
DELETE FROM transactions WHERE description = 'Teste de correção';
```

---

### Passo 4: Testar Frontend

#### 4.1. Verificar Transações Compartilhadas Aparecem

1. Abrir aplicação: http://localhost:5173 (ou URL de produção)
2. Navegar para lista de transações
3. Verificar se transações compartilhadas aparecem
4. Verificar se há badge "Compartilhado" nas transações

**Resultado Esperado:** Transações com `account_id = null` devem aparecer.

#### 4.2. Verificar Cálculo de Cash Flow

1. Criar transação compartilhada de R$ 100 (50/50)
2. Verificar dashboard
3. Verificar se despesa mostra R$ 50 (não R$ 100)

**Resultado Esperado:** Despesa = R$ 50 (sua parte)

#### 4.3. Verificar Criação de Transação

1. Criar transação normal
2. Verificar se não há erro "Conta de despesa não encontrada"
3. Verificar se transação aparece na lista

**Resultado Esperado:** Transação criada com sucesso.

---

### Passo 5: Implementar Melhorias no Frontend (Opcional)

#### 5.1. Adicionar Seção "A Receber" e "A Pagar"

**Arquivo:** `producao/src/core/services/supabaseService.ts`

```typescript
// Adicionar método
async getReceivablesPayables(): Promise<{
    receivables: number;
    payables: number;
    receivables_detail: any[];
    payables_detail: any[];
}> {
    const userId = await this.getUserId();
    const { data, error } = await this.supabase.rpc('get_receivables_payables', {
        p_user_id: userId
    });
    
    if (error) throw error;
    return data;
}
```

**Arquivo:** `producao/src/features/dashboard/Dashboard.tsx`

```typescript
// Adicionar no componente
const [receivablesPayables, setReceivablesPayables] = useState({
    receivables: 0,
    payables: 0,
    receivables_detail: [],
    payables_detail: []
});

useEffect(() => {
    const loadData = async () => {
        const data = await supabaseService.getReceivablesPayables();
        setReceivablesPayables(data);
    };
    loadData();
}, []);

// Adicionar cards no JSX
<div className="grid grid-cols-2 gap-4">
    <Card>
        <CardHeader>A Receber</CardHeader>
        <CardContent>
            <div className="text-2xl font-bold text-green-600">
                R$ {receivablesPayables.receivables.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">
                {receivablesPayables.receivables_detail.length} pendentes
            </div>
        </CardContent>
    </Card>
    
    <Card>
        <CardHeader>A Pagar</CardHeader>
        <CardContent>
            <div className="text-2xl font-bold text-red-600">
                R$ {receivablesPayables.payables.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">
                {receivablesPayables.payables_detail.length} pendentes
            </div>
        </CardContent>
    </Card>
</div>
```

#### 5.2. Usar RPC para Cash Flow

**Arquivo:** `producao/src/core/services/supabaseService.ts`

```typescript
// Adicionar método
async getMonthlyCashflow(year: number): Promise<{
    month: number;
    income: number;
    expense: number;
}[]> {
    const userId = await this.getUserId();
    const { data, error } = await this.supabase.rpc('calculate_cash_flow', {
        p_user_id: userId,
        p_year: year
    });
    
    if (error) throw error;
    return data;
}
```

**Arquivo:** `producao/src/features/dashboard/CashFlowChart.tsx`

```typescript
// Substituir cálculo local por RPC
useEffect(() => {
    const loadCashFlow = async () => {
        const data = await supabaseService.getMonthlyCashflow(2025);
        setCashFlowData(data);
    };
    loadCashFlow();
}, []);
```

---

## ✅ Checklist Final

### Backend
- [ ] Migration aplicada no banco de dados
- [ ] Triggers desabilitados verificados
- [ ] Coluna `notes` existe
- [ ] Funções RPC criadas e testadas
- [ ] Transação de teste criada com sucesso

### Frontend
- [x] Código corrigido (transactionFilters.ts)
- [x] Código corrigido (SafeFinancialCalculations.ts)
- [ ] Transações compartilhadas aparecem
- [ ] Cash flow calcula corretamente
- [ ] Criação de transação funciona
- [ ] (Opcional) Seção "A Receber/A Pagar" adicionada
- [ ] (Opcional) RPC de cash flow integrada

### Validação
- [ ] Teste 1: Criar transação normal - ✅ Sucesso
- [ ] Teste 2: Criar transação compartilhada - ✅ Sucesso
- [ ] Teste 3: Verificar receivables/payables - ✅ Valores corretos
- [ ] Teste 4: Verificar cash flow - ✅ Sem duplicação
- [ ] Teste 5: Transações aparecem no dashboard - ✅ Visíveis

---

## 🆘 Troubleshooting

### Erro: "function calculate_cash_flow does not exist"

**Causa:** Migration não foi aplicada.

**Solução:**
```bash
# Verificar migrations aplicadas
supabase db diff

# Aplicar migration
supabase db push
```

### Erro: "column notes does not exist"

**Causa:** Coluna não foi criada.

**Solução:**
```sql
ALTER TABLE transactions ADD COLUMN notes TEXT;
```

### Transações compartilhadas ainda não aparecem

**Causa:** Código frontend não foi atualizado ou cache do navegador.

**Solução:**
1. Verificar se arquivo `transactionFilters.ts` foi salvo
2. Limpar cache do navegador (Ctrl+Shift+R)
3. Reiniciar servidor de desenvolvimento

### Cash flow ainda mostra valores duplicados

**Causa:** Código frontend não foi atualizado ou cache.

**Solução:**
1. Verificar se arquivo `SafeFinancialCalculations.ts` foi salvo
2. Limpar cache do navegador
3. Verificar se está usando função RPC ou cálculo local

---

## 📞 Suporte

Se encontrar problemas:

1. Verificar logs do Supabase: https://app.supabase.com/project/YOUR_PROJECT/logs
2. Verificar console do navegador (F12)
3. Executar queries de validação acima
4. Consultar documentação em `producao/docs/`

---

**Documento Criado Por:** Kiro AI  
**Data:** 2024-12-24  
**Tempo Estimado:** 15 minutos  
**Dificuldade:** Baixa
