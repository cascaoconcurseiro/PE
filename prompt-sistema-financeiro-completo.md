# Prompt para Desenvolvimento de Sistema Financeiro Pessoal Completo

## Contexto e Objetivo

Você deve desenvolver um sistema financeiro pessoal completo e robusto, baseado em especificações detalhadas e lições aprendidas de implementações anteriores. O sistema deve ser profissional, escalável e livre de problemas comuns identificados em sistemas similares.

## Arquitetura Geral

### Stack Tecnológico Recomendado
- **Frontend**: React 18+ com TypeScript
- **Backend**: Node.js com Express ou Next.js API Routes
- **Banco de Dados**: PostgreSQL com Supabase
- **Autenticação**: Supabase Auth
- **UI**: Tailwind CSS + Headless UI ou shadcn/ui
- **Estado**: Zustand ou React Query
- **Formulários**: React Hook Form + Zod
- **Testes**: Vitest + Testing Library

### Estrutura de Dados Principal

```typescript
// Tipos principais do sistema
interface Account {
  id: string;
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'CASH' | 'INVESTMENT';
  balance: number;
  currency: string;
  initialBalance: number;
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
  isInternational?: boolean;
}

interface Transaction {
  id: string;
  userId: string;
  date: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  category: string;
  description: string;
  accountId?: string;
  destinationAccountId?: string;
  currency?: string;
  
  // Parcelamento
  isInstallment?: boolean;
  currentInstallment?: number;
  totalInstallments?: number;
  seriesId?: string;
  
  // Compartilhamento
  isShared?: boolean;
  sharedWith?: TransactionSplit[];
  payerId?: string;
  relatedMemberId?: string;
  
  // Viagem
  tripId?: string;
  
  // Liquidação
  isSettled?: boolean;
  settledAt?: string;
  
  // Conversão
  exchangeRate?: number;
  originalAmount?: number;
  
  // Metadados
  domain?: 'PERSONAL' | 'SHARED' | 'TRAVEL';
  createdAt: string;
  updatedAt: string;
}

interface TransactionSplit {
  memberId: string;
  percentage: number;
  assignedAmount: number;
  isSettled?: boolean;
  settledAt?: string;
}

interface FamilyMember {
  id: string;
  name: string;
  email?: string;
  linkedUserId?: string;
  role?: string;
}

interface Trip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  participants: TripParticipant[];
  currency: string;
  budget: number;
  imageUrl?: string;
}

interface InvoiceItem {
  id: string;
  originalTxId: string;
  description: string;
  date: string;
  category: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  isPaid: boolean;
  tripId?: string;
  memberId: string;
  currency?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  creatorUserId?: string;
}
```

## Funcionalidades Principais

### 1. Sistema de Contas e Transações Básicas

**Implementar:**
- CRUD completo de contas (corrente, poupança, cartão, dinheiro, investimentos)
- CRUD completo de transações com validação rigorosa
- Cálculo automático de saldos com precisão decimal
- Suporte a múltiplas moedas com conversão
- Categorização inteligente de transações
- Filtros avançados e busca

**Pontos Críticos:**
- Use bibliotecas de precisão decimal (como decimal.js) para cálculos financeiros
- Implemente validação de dados tanto no frontend quanto no backend
- Mantenha histórico de alterações para auditoria
- Use transações de banco de dados para operações críticas

### 2. Sistema de Parcelamento Inteligente

**Implementar:**
- Criação automática de parcelas futuras
- Edição individual de parcelas sem afetar a série
- Exclusão com opções (parcela única ou série completa)
- Cálculo correto de arredondamentos
- Visualização clara do progresso das parcelas

**Exemplo de Implementação:**
```typescript
const createInstallmentSeries = async (transaction: CreateTransactionInput) => {
  const { amount, totalInstallments, startDate } = transaction;
  const installmentAmount = Math.round((amount / totalInstallments) * 100) / 100;
  const remainder = amount - (installmentAmount * totalInstallments);
  
  const seriesId = generateId();
  const installments = [];
  
  for (let i = 0; i < totalInstallments; i++) {
    const installmentDate = addMonths(startDate, i);
    const finalAmount = i === 0 ? installmentAmount + remainder : installmentAmount;
    
    installments.push({
      ...transaction,
      id: generateId(),
      seriesId,
      amount: finalAmount,
      date: installmentDate,
      currentInstallment: i + 1,
      totalInstallments,
      isInstallment: true,
      description: `${transaction.description} (${i + 1}/${totalInstallments})`
    });
  }
  
  return await db.transaction().execute(async (trx) => {
    return await trx.insertInto('transactions').values(installments).execute();
  });
};
```

### 3. Sistema Compartilhado Robusto

**Implementar:**
- Gestão de membros familiares com vinculação de usuários
- Divisão flexível de gastos (valor fixo ou percentual)
- Cálculo automático de débitos e créditos
- Sistema de faturas mensais por membro
- Acertos com suporte a múltiplas moedas
- Sincronização automática entre usuários

**Lógica de Compartilhamento:**
```typescript
const calculateSharedInvoice = (transactions: Transaction[], memberId: string) => {
  const items: InvoiceItem[] = [];
  
  transactions.forEach(tx => {
    if (!tx.isShared) return;
    
    // CREDIT: Eu paguei, outros me devem
    if (tx.payerId === 'me' && tx.sharedWith) {
      tx.sharedWith.forEach(split => {
        if (split.memberId === memberId) {
          items.push({
            id: `${tx.id}-credit-${split.memberId}`,
            originalTxId: tx.id,
            description: tx.description,
            date: tx.date,
            amount: split.assignedAmount,
            type: 'CREDIT',
            isPaid: split.isSettled || false,
            memberId: split.memberId,
            currency: tx.currency || 'BRL'
          });
        }
      });
    }
    
    // DEBIT: Outro pagou, eu devo
    if (tx.payerId && tx.payerId !== 'me') {
      const myShare = tx.amount - (tx.sharedWith?.reduce((sum, s) => sum + s.assignedAmount, 0) || 0);
      if (myShare > 0) {
        items.push({
          id: `${tx.id}-debit-${memberId}`,
          originalTxId: tx.id,
          description: tx.description,
          date: tx.date,
          amount: myShare,
          type: 'DEBIT',
          isPaid: tx.isSettled || false,
          memberId,
          currency: tx.currency || 'BRL'
        });
      }
    }
  });
  
  return items;
};
```

### 4. Sistema de Viagens Completo

**Implementar:**
- Criação de viagens com participantes e orçamento
- Isolamento de gastos por viagem
- Divisão automática entre participantes
- Controle de câmbio para viagens internacionais
- Relatórios de gastos e acertos
- Itinerário e lista de compras integrados

**Funcionalidades Especiais:**
- Modo offline para uso durante viagens
- Sincronização automática quando conectado
- Exportação de relatórios em PDF
- Fotos de comprovantes

### 5. Sistema de Acertos e Liquidação

**Implementar:**
- Visualização clara de saldos líquidos por membro
- Acertos totais ou parciais
- Suporte a múltiplas moedas com conversão
- Histórico completo de acertos
- Desfazer acertos quando necessário

**Modal de Acerto:**
```typescript
const SettlementModal = ({ member, items, onConfirm }) => {
  const [method, setMethod] = useState<'SAME_CURRENCY' | 'CONVERT'>('SAME_CURRENCY');
  const [account, setAccount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [isPartial, setIsPartial] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  
  const handleConfirm = () => {
    const finalAmount = isPartial ? parseFloat(customAmount) : totalAmount;
    const rate = method === 'CONVERT' ? parseFloat(exchangeRate) : 1;
    
    onConfirm({
      accountId: account,
      amount: finalAmount,
      exchangeRate: rate,
      method,
      isPartial
    });
  };
  
  // ... resto da implementação
};
```

### 6. Formulários Inteligentes

**Implementar:**
- Formulário unificado para todas as transações
- Validação em tempo real
- Auto-complete inteligente
- Suporte a diferentes tipos de transação
- Modo rápido para transações frequentes

**Exemplo de Formulário Base:**
```typescript
const TransactionForm = ({ onSubmit, initialData }) => {
  const form = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues: initialData
  });
  
  const transactionType = form.watch('type');
  const isShared = form.watch('isShared');
  const isInstallment = form.watch('isInstallment');
  
  return (
    <BaseForm
      title="Nova Transação"
      fields={[
        {
          name: 'description',
          label: 'Descrição',
          type: 'text',
          required: true,
          placeholder: 'Ex: Compra no supermercado'
        },
        {
          name: 'amount',
          label: 'Valor',
          type: 'number',
          required: true,
          validation: (value) => value > 0 ? null : 'Valor deve ser maior que zero'
        },
        {
          name: 'type',
          label: 'Tipo',
          type: 'select',
          options: [
            { value: 'EXPENSE', label: 'Despesa' },
            { value: 'INCOME', label: 'Receita' },
            { value: 'TRANSFER', label: 'Transferência' }
          ]
        },
        // ... campos condicionais baseados no tipo
      ]}
      values={form.getValues()}
      errors={form.formState.errors}
      onFieldChange={form.setValue}
      onSubmit={form.handleSubmit(onSubmit)}
    />
  );
};
```

### 7. Dashboard e Relatórios

**Implementar:**
- Dashboard com resumo financeiro
- Gráficos de gastos por categoria
- Projeções de fluxo de caixa
- Relatórios personalizáveis
- Exportação em múltiplos formatos

### 8. Sincronização e Consistência

**Implementar:**
- Sistema de sincronização em tempo real
- Resolução automática de conflitos
- Queue de operações offline
- Reconciliação automática de dados
- Circuit breaker para operações críticas

## Problemas Críticos a Evitar

### 1. Problemas de Precisão Decimal
```typescript
// ❌ ERRADO - Problemas de precisão
const total = 10.1 + 10.2; // 20.299999999999997

// ✅ CORRETO - Use biblioteca de precisão decimal
import Decimal from 'decimal.js';
const total = new Decimal(10.1).plus(10.2).toNumber(); // 20.3
```

### 2. Problemas de Sincronização
```typescript
// ❌ ERRADO - Operações sem transação
await updateAccount(accountId, newBalance);
await createTransaction(transaction);

// ✅ CORRETO - Use transações de banco
await db.transaction().execute(async (trx) => {
  await trx.updateTable('accounts').set({ balance: newBalance }).where('id', '=', accountId).execute();
  await trx.insertInto('transactions').values(transaction).execute();
});
```

### 3. Problemas de Validação
```typescript
// ❌ ERRADO - Validação apenas no frontend
const createTransaction = async (data) => {
  return await api.post('/transactions', data);
};

// ✅ CORRETO - Validação dupla
const transactionSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
  accountId: z.string().uuid()
});

const createTransaction = async (data) => {
  const validated = transactionSchema.parse(data); // Frontend
  return await api.post('/transactions', validated); // Backend também valida
};
```

### 4. Problemas de Performance
```typescript
// ❌ ERRADO - Consultas N+1
const transactions = await getTransactions();
for (const tx of transactions) {
  tx.account = await getAccount(tx.accountId);
}

// ✅ CORRETO - Join ou batch loading
const transactions = await db
  .selectFrom('transactions')
  .leftJoin('accounts', 'accounts.id', 'transactions.accountId')
  .selectAll()
  .execute();
```

## Estrutura de Arquivos Recomendada

```
src/
├── components/
│   ├── ui/                 # Componentes base (Button, Input, etc.)
│   ├── forms/              # Formulários reutilizáveis
│   ├── shared/             # Componentes do sistema compartilhado
│   ├── trips/              # Componentes de viagens
│   └── dashboard/          # Componentes da dashboard
├── hooks/                  # Custom hooks
├── services/               # Lógica de negócio e API
├── utils/                  # Utilitários e helpers
├── types/                  # Definições de tipos TypeScript
├── stores/                 # Estado global (Zustand)
└── pages/                  # Páginas da aplicação
```

## Checklist de Implementação

### Fase 1: Base
- [ ] Configuração do projeto e dependências
- [ ] Autenticação e autorização
- [ ] CRUD de contas
- [ ] CRUD de transações básicas
- [ ] Cálculo de saldos

### Fase 2: Funcionalidades Avançadas
- [ ] Sistema de parcelamento
- [ ] Categorização e filtros
- [ ] Múltiplas moedas
- [ ] Dashboard básica

### Fase 3: Sistema Compartilhado
- [ ] Gestão de membros familiares
- [ ] Transações compartilhadas
- [ ] Cálculo de faturas
- [ ] Sistema de acertos

### Fase 4: Sistema de Viagens
- [ ] CRUD de viagens
- [ ] Gastos isolados por viagem
- [ ] Divisão entre participantes
- [ ] Relatórios de viagem

### Fase 5: Polimento
- [ ] Sincronização robusta
- [ ] Testes automatizados
- [ ] Performance optimization
- [ ] UI/UX refinements

## Considerações de Segurança

1. **Autenticação**: Use JWT com refresh tokens
2. **Autorização**: Implemente RBAC (Role-Based Access Control)
3. **Validação**: Sempre valide dados no backend
4. **Sanitização**: Sanitize todas as entradas do usuário
5. **Rate Limiting**: Implemente rate limiting nas APIs
6. **Auditoria**: Mantenha logs de todas as operações críticas

## Testes Recomendados

1. **Unitários**: Todas as funções de cálculo financeiro
2. **Integração**: Fluxos completos de transações
3. **E2E**: Cenários críticos do usuário
4. **Performance**: Testes de carga nas APIs
5. **Segurança**: Testes de penetração básicos

## Conclusão

Este sistema deve ser implementado de forma incremental, com foco na qualidade e robustez. Priorize a correção dos cálculos financeiros e a consistência dos dados acima de funcionalidades avançadas. Use as especificações detalhadas como guia e implemente testes abrangentes para garantir a confiabilidade do sistema.

Lembre-se: um sistema financeiro deve ser 100% confiável. É melhor ter menos funcionalidades que funcionem perfeitamente do que muitas funcionalidades com bugs.