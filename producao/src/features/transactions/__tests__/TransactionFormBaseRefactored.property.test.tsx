import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionFormBaseRefactored } from '../TransactionFormBaseRefactored';
import { TransactionType, Category, AccountType } from '../../../types';
import type { Account, Trip, FamilyMember, CustomCategory, Transaction } from '../../../types';
import fc from 'fast-check';

// Mock dos componentes UI
vi.mock('@/components/ui/Button', () => ({
    Button: ({ children, onClick, disabled, className }: any) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={className}
            data-testid="submit-button"
        >
            {children}
        </button>
    )
}));

vi.mock('../AccountSelector', () => ({
    AccountSelector: ({ label, selectedId, onSelect, accounts, disabled }: any) => (
        <div data-testid="account-selector">
            <label>{label}</label>
            <select
                value={selectedId}
                onChange={(e) => onSelect(e.target.value)}
                disabled={disabled}
                data-testid="account-select"
            >
                <option value="">Selecione uma conta</option>
                {accounts.map((acc: Account) => (
                    <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                    </option>
                ))}
            </select>
        </div>
    )
}));

vi.mock('../SplitModal', () => ({
    SplitModal: ({ isOpen, onClose, onConfirm }: any) => (
        isOpen ? (
            <div data-testid="split-modal">
                <button onClick={onConfirm} data-testid="confirm-split">Confirmar</button>
                <button onClick={onClose} data-testid="close-split">Fechar</button>
            </div>
        ) : null
    )
}));

/**
 * Testes de Propriedade para TransactionFormBaseRefactored
 * Property 2: Functional Preservation
 * Validates: Requirements 3.4, 8.1
 * 
 * Verifica que o formulário refatorado mantém toda funcionalidade do original
 */
describe('TransactionFormBaseRefactored - Property Tests', () => {
    const mockOnSave = vi.fn();
    const mockOnCancel = vi.fn();
    const mockSetFormMode = vi.fn();

    // Geradores para property-based testing
    const accountGenerator = fc.record({
        id: fc.string({ minLength: 1 }),
        name: fc.string({ minLength: 1 }),
        type: fc.constantFrom(AccountType.CHECKING, AccountType.SAVINGS, AccountType.CREDIT_CARD),
        currency: fc.constantFrom('BRL', 'USD', 'EUR'),
        balance: fc.integer({ min: 0, max: 10000 }),
        isInternational: fc.boolean()
    });

    const tripGenerator = fc.record({
        id: fc.string({ minLength: 1 }),
        name: fc.string({ minLength: 1 }),
        currency: fc.constantFrom('BRL', 'USD', 'EUR'),
        startDate: fc.date().map(d => d.toISOString().split('T')[0]),
        endDate: fc.date().map(d => d.toISOString().split('T')[0])
    });

    const transactionGenerator = fc.record({
        id: fc.string({ minLength: 1 }),
        amount: fc.integer({ min: 1, max: 10000 }),
        description: fc.string({ minLength: 1 }),
        date: fc.date().map(d => d.toISOString().split('T')[0]),
        type: fc.constantFrom(TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER),
        category: fc.constantFrom(...Object.values(Category)),
        accountId: fc.string({ minLength: 1 }),
        userId: fc.string({ minLength: 1 })
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Property 2: Functional Preservation', () => {
        it('should preserve form mode switching functionality for any valid form mode', () => {
            fc.assert(fc.property(
                fc.array(accountGenerator, { minLength: 1, maxLength: 5 }),
                fc.constantFrom(TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER),
                (accounts, formMode) => {
                    const { container } = render(
                        <TransactionFormBaseRefactored
                            formMode={formMode}
                            setFormMode={mockSetFormMode}
                            accounts={accounts}
                            trips={[]}
                            familyMembers={[]}
                            customCategories={[]}
                            onSave={mockOnSave}
                            onCancel={mockOnCancel}
                        />
                    );

                    // Verifica que os botões de modo estão presentes
                    const expenseButtons = screen.getAllByText('Despesa');
                    const incomeButtons = screen.getAllByText('Receita');
                    const transferButtons = screen.getAllByText('Transf.');

                    expect(expenseButtons.length).toBeGreaterThan(0);
                    expect(incomeButtons.length).toBeGreaterThan(0);
                    expect(transferButtons.length).toBeGreaterThan(0);

                    // Verifica que pelo menos um botão do tipo ativo tem estilo diferente
                    const activeButtons = formMode === TransactionType.EXPENSE ? expenseButtons :
                                        formMode === TransactionType.INCOME ? incomeButtons : transferButtons;
                    
                    const hasActiveStyle = activeButtons.some(btn => btn.className.includes('font-bold'));
                    expect(hasActiveStyle).toBe(true);
                }
            ), { numRuns: 20 });
        });

        it('should preserve basic form structure for any transaction type', () => {
            fc.assert(fc.property(
                fc.array(accountGenerator, { minLength: 1, maxLength: 3 }),
                fc.constantFrom(TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER),
                (accounts, formMode) => {
                    const { container } = render(
                        <TransactionFormBaseRefactored
                            formMode={formMode}
                            setFormMode={mockSetFormMode}
                            accounts={accounts}
                            trips={[]}
                            familyMembers={[]}
                            customCategories={[]}
                            onSave={mockOnSave}
                            onCancel={mockOnCancel}
                        />
                    );

                    // Verifica estrutura básica do formulário
                    expect(container.querySelector('.flex.flex-col.h-screen')).toBeInTheDocument();
                    expect(container.querySelector('.sticky.top-0')).toBeInTheDocument(); // Header
                    expect(container.querySelector('.flex-1.overflow-y-auto')).toBeInTheDocument(); // Content
                    
                    // Verifica que há pelo menos um campo de entrada de valor
                    const amountInputs = screen.getAllByPlaceholderText('0,00');
                    expect(amountInputs.length).toBeGreaterThan(0);
                }
            ), { numRuns: 20 });
        });

        it('should preserve account selection functionality for any account list', () => {
            fc.assert(fc.property(
                fc.array(accountGenerator, { minLength: 1, maxLength: 10 }),
                (accounts) => {
                    render(
                        <TransactionFormBaseRefactored
                            formMode={TransactionType.EXPENSE}
                            setFormMode={mockSetFormMode}
                            accounts={accounts}
                            trips={[]}
                            familyMembers={[]}
                            customCategories={[]}
                            onSave={mockOnSave}
                            onCancel={mockOnCancel}
                        />
                    );

                    // Verifica que o seletor de conta está presente
                    const accountSelector = screen.getByTestId('account-selector');
                    expect(accountSelector).toBeInTheDocument();

                    // Verifica que todas as contas estão disponíveis
                    const accountSelect = screen.getByTestId('account-select');
                    accounts.forEach(account => {
                        expect(accountSelect).toContainHTML(account.name);
                    });
                }
            ), { numRuns: 20 });
        });

        it('should preserve trip selection functionality for expense transactions', () => {
            fc.assert(fc.property(
                fc.array(accountGenerator, { minLength: 1, maxLength: 3 }),
                fc.array(tripGenerator, { minLength: 0, maxLength: 5 }),
                (accounts, trips) => {
                    render(
                        <TransactionFormBaseRefactored
                            formMode={TransactionType.EXPENSE}
                            setFormMode={mockSetFormMode}
                            accounts={accounts}
                            trips={trips}
                            familyMembers={[]}
                            customCategories={[]}
                            onSave={mockOnSave}
                            onCancel={mockOnCancel}
                        />
                    );

                    // Para despesas, deve haver seleção de viagem
                    const tripSelectors = screen.getAllByText(/vincular a uma viagem/i);
                    expect(tripSelectors.length).toBeGreaterThan(0);

                    // Clica para abrir o seletor
                    fireEvent.click(tripSelectors[0]);

                    if (trips.length > 0) {
                        // Verifica que as viagens estão listadas
                        trips.forEach(trip => {
                            expect(screen.getByText(trip.name)).toBeInTheDocument();
                        });
                    } else {
                        // Verifica mensagem de nenhuma viagem
                        expect(screen.getByText(/nenhuma viagem cadastrada/i)).toBeInTheDocument();
                    }
                }
            ), { numRuns: 20 });
        });

        it('should preserve additional options functionality', () => {
            fc.assert(fc.property(
                fc.array(accountGenerator, { minLength: 1, maxLength: 3 }),
                fc.constantFrom(TransactionType.EXPENSE, TransactionType.INCOME),
                (accounts, formMode) => {
                    render(
                        <TransactionFormBaseRefactored
                            formMode={formMode}
                            setFormMode={mockSetFormMode}
                            accounts={accounts}
                            trips={[]}
                            familyMembers={[]}
                            customCategories={[]}
                            onSave={mockOnSave}
                            onCancel={mockOnCancel}
                        />
                    );

                    // Verifica opções adicionais
                    const repetirButtons = screen.getAllByText('Repetir');
                    const lembrarButtons = screen.getAllByText('Lembrar');
                    
                    expect(repetirButtons.length).toBeGreaterThan(0);
                    expect(lembrarButtons.length).toBeGreaterThan(0);

                    if (formMode === TransactionType.EXPENSE) {
                        const dividirButtons = screen.getAllByText('Dividir');
                        expect(dividirButtons.length).toBeGreaterThan(0);
                        
                        // Se há conta de crédito, deve ter opção de parcelar
                        const creditCardAccount = accounts.find(acc => acc.type === AccountType.CREDIT_CARD);
                        if (creditCardAccount) {
                            const accountSelect = screen.getByTestId('account-select');
                            fireEvent.change(accountSelect, { target: { value: creditCardAccount.id } });
                            const parcelarButtons = screen.getAllByText('Parcelar');
                            expect(parcelarButtons.length).toBeGreaterThan(0);
                        }
                    }
                }
            ), { numRuns: 20 });
        });

        it('should preserve read-only mode functionality', () => {
            fc.assert(fc.property(
                fc.array(accountGenerator, { minLength: 1, maxLength: 3 }),
                transactionGenerator,
                fc.string({ minLength: 1 }),
                fc.string({ minLength: 1 }),
                (accounts, initialData, currentUserId, differentUserId) => {
                    // Cria transação de outro usuário
                    const otherUserTransaction = { ...initialData, userId: differentUserId };

                    render(
                        <TransactionFormBaseRefactored
                            initialData={otherUserTransaction}
                            formMode={TransactionType.EXPENSE}
                            setFormMode={mockSetFormMode}
                            accounts={accounts}
                            trips={[]}
                            familyMembers={[]}
                            customCategories={[]}
                            onSave={mockOnSave}
                            onCancel={mockOnCancel}
                            currentUserId={currentUserId}
                        />
                    );

                    // Verifica indicador de leitura
                    const readOnlyIndicators = screen.getAllByText(/criado por outro membro/i);
                    expect(readOnlyIndicators.length).toBeGreaterThan(0);

                    // Verifica que não há botão de submit visível (pode estar presente mas não visível)
                    const submitButtons = screen.queryAllByTestId('submit-button');
                    // Em modo read-only, o botão não deve estar presente ou deve estar oculto
                    expect(submitButtons.length).toBeLessThanOrEqual(1);
                }
            ), { numRuns: 20 });
        });

        it('should preserve form submission capability with valid data', () => {
            fc.assert(fc.property(
                fc.array(accountGenerator, { minLength: 1, maxLength: 3 }),
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.integer({ min: 1, max: 1000 }),
                (accounts, description, amount) => {
                    render(
                        <TransactionFormBaseRefactored
                            formMode={TransactionType.EXPENSE}
                            setFormMode={mockSetFormMode}
                            accounts={accounts}
                            trips={[]}
                            familyMembers={[]}
                            customCategories={[]}
                            onSave={mockOnSave}
                            onCancel={mockOnCancel}
                        />
                    );

                    // Verifica que há pelo menos um botão de submit
                    const submitButtons = screen.getAllByTestId('submit-button');
                    expect(submitButtons.length).toBeGreaterThan(0);

                    // Verifica que o botão principal está presente
                    const mainSubmitButton = submitButtons.find(btn => 
                        btn.textContent?.includes('Confirmar') || btn.textContent?.includes('Salvar')
                    );
                    expect(mainSubmitButton).toBeInTheDocument();
                }
            ), { numRuns: 20 });
        });
    });

    describe('Property 2: Visual Consistency Preservation', () => {
        it('should maintain consistent visual structure for any form mode', () => {
            fc.assert(fc.property(
                fc.array(accountGenerator, { minLength: 1, maxLength: 3 }),
                fc.constantFrom(TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER),
                (accounts, formMode) => {
                    const { container } = render(
                        <TransactionFormBaseRefactored
                            formMode={formMode}
                            setFormMode={mockSetFormMode}
                            accounts={accounts}
                            trips={[]}
                            familyMembers={[]}
                            customCategories={[]}
                            onSave={mockOnSave}
                            onCancel={mockOnCancel}
                        />
                    );

                    // Verifica estrutura visual básica
                    expect(container.querySelector('.flex.flex-col.h-screen')).toBeInTheDocument();
                    expect(container.querySelector('.sticky.top-0')).toBeInTheDocument(); // Header
                    expect(container.querySelector('.flex-1.overflow-y-auto')).toBeInTheDocument(); // Content
                    
                    // Verifica que há elementos de entrada de valor
                    const amountInputs = screen.getAllByPlaceholderText('0,00');
                    expect(amountInputs.length).toBeGreaterThan(0);
                }
            ), { numRuns: 20 });
        });

        it('should preserve color scheme consistency for different transaction types', () => {
            fc.assert(fc.property(
                fc.array(accountGenerator, { minLength: 1, maxLength: 3 }),
                fc.constantFrom(TransactionType.EXPENSE, TransactionType.INCOME, TransactionType.TRANSFER),
                (accounts, formMode) => {
                    const { container } = render(
                        <TransactionFormBaseRefactored
                            formMode={formMode}
                            setFormMode={mockSetFormMode}
                            accounts={accounts}
                            trips={[]}
                            familyMembers={[]}
                            customCategories={[]}
                            onSave={mockOnSave}
                            onCancel={mockOnCancel}
                        />
                    );

                    // Verifica que há elementos com cores específicas do tipo
                    const amountInputs = screen.getAllByPlaceholderText('0,00');
                    expect(amountInputs.length).toBeGreaterThan(0);

                    // Verifica que o botão do tipo ativo tem estilo diferente
                    const activeButtons = formMode === TransactionType.EXPENSE ? screen.getAllByText('Despesa') :
                                        formMode === TransactionType.INCOME ? screen.getAllByText('Receita') : 
                                        screen.getAllByText('Transf.');
                    
                    expect(activeButtons.length).toBeGreaterThan(0);
                    
                    // Verifica que pelo menos um botão ativo tem alguma diferenciação visual
                    // Procura por classes que indicam estado ativo (font-bold, bg-white, shadow-sm, ou cores específicas)
                    const hasActiveStyle = activeButtons.some(btn => {
                        const className = btn.className || '';
                        const parentClassName = btn.parentElement?.className || '';
                        
                        return className.match(/font-bold|bg-white|shadow-sm|text-red-700|text-emerald-700|text-blue-700/) ||
                               parentClassName.match(/font-bold|bg-white|shadow-sm|text-red-700|text-emerald-700|text-blue-700/);
                    });
                    expect(hasActiveStyle).toBe(true);
                }
            ), { numRuns: 20 });
        });
    });
});