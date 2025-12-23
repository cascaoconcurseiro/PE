import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseForm, FieldConfig } from '../BaseForm';
import React from 'react';

// Mock dos componentes UI
vi.mock('@/components/ui/Button', () => ({
    Button: ({ children, onClick, disabled, type, variant, className }: any) => (
        <button
            onClick={onClick}
            disabled={disabled}
            type={type}
            className={`btn ${variant} ${className}`}
            data-testid="button"
        >
            {children}
        </button>
    )
}));

vi.mock('@/components/ui/Card', () => ({
    Card: ({ children, className }: any) => (
        <div className={`card ${className}`} data-testid="card">
            {children}
        </div>
    )
}));

/**
 * Testes Visuais para BaseForm
 * Validam a consistência visual e preservação de layouts
 * Property 4: Visual Consistency Preservation
 * Validates: Requirements 3.2, 3.5
 */
describe('BaseForm - Testes Visuais', () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();
    const mockOnFieldChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Layout e Estrutura Visual', () => {
        it('deve manter estrutura visual consistente com card', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text', required: true }
            ];

            const { container } = render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ name: '' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                    showCard={true}
                />
            );

            // Verifica estrutura do card
            expect(screen.getByTestId('card')).toBeInTheDocument();
            
            // Verifica estrutura do header
            const title = screen.getByText('Formulário Teste');
            expect(title).toBeInTheDocument();
            expect(title).toHaveClass('text-xl', 'font-bold');

            // Verifica estrutura do formulário
            const form = container.querySelector('form');
            expect(form).toBeInTheDocument();
            expect(form).toHaveClass('space-y-6');

            // Verifica grid de campos
            const grid = container.querySelector('.grid');
            expect(grid).toBeInTheDocument();
            expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'gap-4');
        });

        it('deve manter estrutura visual consistente sem card', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text' }
            ];

            const { container } = render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ name: '' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                    showCard={false}
                />
            );

            // Não deve ter card
            expect(screen.queryByTestId('card')).not.toBeInTheDocument();
            
            // Mas deve manter estrutura do formulário
            const form = container.querySelector('form');
            expect(form).toBeInTheDocument();
        });

        it('deve aplicar classes CSS corretas para diferentes tipos de campo', () => {
            const fields: FieldConfig[] = [
                { name: 'text', label: 'Texto', type: 'text' },
                { name: 'email', label: 'Email', type: 'email' },
                { name: 'number', label: 'Número', type: 'number' },
                { name: 'date', label: 'Data', type: 'date' },
                { name: 'textarea', label: 'Textarea', type: 'textarea' },
                { name: 'checkbox', label: 'Checkbox', type: 'checkbox' }
            ];

            const { container } = render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{
                        text: '',
                        email: '',
                        number: '',
                        date: '',
                        textarea: '',
                        checkbox: false
                    }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                />
            );

            // Verifica classes base para inputs de texto
            const textInput = container.querySelector('input[type="text"]');
            expect(textInput).toHaveClass('w-full', 'text-base', 'font-medium');

            const emailInput = container.querySelector('input[type="email"]');
            expect(emailInput).toHaveClass('w-full', 'text-base', 'font-medium');

            const numberInput = container.querySelector('input[type="number"]');
            expect(numberInput).toHaveClass('w-full', 'text-base', 'font-medium');

            // Verifica classes específicas para textarea
            const textarea = container.querySelector('textarea');
            expect(textarea).toHaveClass('min-h-[80px]', 'resize-y');

            // Verifica classes para checkbox
            const checkbox = container.querySelector('input[type="checkbox"]');
            expect(checkbox).toHaveClass('w-4', 'h-4', 'rounded');
        });

        it('deve aplicar layout de grid corretamente', () => {
            const fields: FieldConfig[] = [
                { name: 'field1', label: 'Campo 1', type: 'text', gridCols: 1 },
                { name: 'field2', label: 'Campo 2', type: 'text', gridCols: 2 },
                { name: 'field3', label: 'Campo 3', type: 'text' } // default gridCols: 1
            ];

            const { container } = render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ field1: '', field2: '', field3: '' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                />
            );

            const fieldContainers = container.querySelectorAll('.grid > div');
            
            // Campo 1: col-span-1
            expect(fieldContainers[0]).toHaveClass('col-span-1');
            
            // Campo 2: col-span-2
            expect(fieldContainers[1]).toHaveClass('col-span-2');
            
            // Campo 3: col-span-1 (default)
            expect(fieldContainers[2]).toHaveClass('col-span-1');
        });
    });

    describe('Estados Visuais', () => {
        it('deve aplicar estilos visuais corretos para estado de erro', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text' }
            ];

            const { container } = render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ name: 'valor' }}
                    errors={{ name: 'Erro de validação' }}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                />
            );

            // Verifica input com erro
            const input = container.querySelector('input[type="text"]');
            expect(input).toHaveClass('border-red-500');

            // Verifica mensagem de erro
            const errorMessage = screen.getByText('Erro de validação');
            expect(errorMessage).toBeInTheDocument();
            expect(errorMessage).toHaveClass('text-red-600', 'text-xs', 'font-bold');
        });

        it('deve aplicar estilos visuais corretos para estado desabilitado', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text', disabled: true }
            ];

            const { container } = render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ name: 'valor' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                />
            );

            const input = container.querySelector('input[type="text"]');
            expect(input).toHaveClass('opacity-50', 'cursor-not-allowed');
            expect(input).toBeDisabled();
        });

        it('deve aplicar estilos visuais corretos para modo somente leitura', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text' }
            ];

            render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ name: 'valor' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                    isReadOnly={true}
                />
            );

            // Não deve mostrar botão de submit em modo somente leitura
            expect(screen.queryByRole('button', { name: /salvar/i })).not.toBeInTheDocument();
        });

        it('deve aplicar estilos visuais corretos para estado de carregamento', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text' }
            ];

            render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ name: 'valor' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                    isSubmitting={true}
                />
            );

            const submitButton = screen.getByRole('button', { name: /salvando/i });
            expect(submitButton).toBeInTheDocument();
            expect(submitButton).toBeDisabled();
        });
    });

    describe('Mensagens e Alertas Visuais', () => {
        it('deve renderizar mensagem de erro global com estilos corretos', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text' }
            ];

            render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ name: '' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                    globalError="Erro global de teste"
                />
            );

            const errorAlert = screen.getByText('Erro global de teste');
            expect(errorAlert).toBeInTheDocument();
            
            // Verifica o container da mensagem de erro
            const errorContainer = errorAlert.closest('div');
            expect(errorContainer).toHaveClass(
                'bg-red-50',
                'border-red-200',
                'text-red-800'
            );
        });

        it('deve renderizar mensagem de sucesso com estilos corretos', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text' }
            ];

            render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ name: '' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                    successMessage="Sucesso!"
                />
            );

            const successAlert = screen.getByText('Sucesso!');
            expect(successAlert).toBeInTheDocument();
            
            // Verifica o container da mensagem de sucesso
            const successContainer = successAlert.closest('div');
            expect(successContainer).toHaveClass(
                'bg-green-50',
                'border-green-200',
                'text-green-800'
            );
        });

        it('deve renderizar mensagem de aviso com estilos corretos', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text' }
            ];

            render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ name: '' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                    warningMessage="Aviso importante"
                />
            );

            const warningAlert = screen.getByText('Aviso importante');
            expect(warningAlert).toBeInTheDocument();
            
            // Verifica o container da mensagem de aviso
            const warningContainer = warningAlert.closest('div');
            expect(warningContainer).toHaveClass(
                'bg-amber-50',
                'border-amber-200',
                'text-amber-800'
            );
        });
    });

    describe('Campos Especiais - Consistência Visual', () => {
        it('deve renderizar campo select com estilos visuais corretos', () => {
            const fields: FieldConfig[] = [
                {
                    name: 'category',
                    label: 'Categoria',
                    type: 'select',
                    options: [
                        { value: 'food', label: 'Alimentação' },
                        { value: 'transport', label: 'Transporte' }
                    ]
                }
            ];

            const { container } = render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ category: 'food' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                />
            );

            const selectContainer = container.querySelector('.bg-slate-50');
            expect(selectContainer).toBeInTheDocument();
            expect(selectContainer).toHaveClass(
                'rounded-xl',
                'h-10',
                'flex',
                'items-center',
                'px-3'
            );

            // Verifica ícone de dropdown
            const dropdownIcon = container.querySelector('svg');
            expect(dropdownIcon).toBeInTheDocument();
            expect(dropdownIcon).toHaveClass('w-4', 'h-4', 'text-slate-400');
        });

        it('deve renderizar campo de data com estilos visuais corretos', () => {
            const fields: FieldConfig[] = [
                { name: 'date', label: 'Data', type: 'date' }
            ];

            const { container } = render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ date: '2024-01-01' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                />
            );

            const dateContainer = container.querySelector('.bg-slate-50');
            expect(dateContainer).toBeInTheDocument();
            expect(dateContainer).toHaveClass(
                'rounded-xl',
                'h-10',
                'flex',
                'items-center',
                'px-3'
            );

            const dateInput = container.querySelector('input[type="date"]');
            expect(dateInput).toHaveClass(
                'bg-transparent',
                'font-bold',
                'text-slate-700'
            );
        });

        it('deve renderizar labels com estilos consistentes', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text', required: true },
                { name: 'email', label: 'Email', type: 'email' }
            ];

            const { container } = render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ name: '', email: '' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                />
            );

            const labels = container.querySelectorAll('label');
            
            // Verifica estilos dos labels
            labels.forEach(label => {
                if (!label.querySelector('input[type="checkbox"]')) { // Não é checkbox
                    expect(label).toHaveClass(
                        'text-xs',
                        'font-bold',
                        'text-slate-500',
                        'uppercase',
                        'tracking-wider'
                    );
                }
            });

            // Verifica asterisco para campo obrigatório
            const requiredIndicator = container.querySelector('.text-red-500');
            expect(requiredIndicator).toBeInTheDocument();
            expect(requiredIndicator).toHaveTextContent('*');
        });
    });

    describe('Responsividade Visual', () => {
        it('deve aplicar classes responsivas corretas no grid', () => {
            const fields: FieldConfig[] = [
                { name: 'field1', label: 'Campo 1', type: 'text' },
                { name: 'field2', label: 'Campo 2', type: 'text' }
            ];

            const { container } = render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ field1: '', field2: '' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                />
            );

            const grid = container.querySelector('.grid');
            expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2');
        });

        it('deve manter espaçamento consistente', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text' }
            ];

            const { container } = render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ name: '' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                />
            );

            // Verifica espaçamento do container principal
            const mainContainer = container.querySelector('.space-y-6');
            expect(mainContainer).toBeInTheDocument();

            // Verifica espaçamento do formulário
            const form = container.querySelector('form');
            expect(form).toHaveClass('space-y-6');

            // Verifica gap do grid
            const grid = container.querySelector('.grid');
            expect(grid).toHaveClass('gap-4');
        });
    });

    describe('Botões e Ações Visuais', () => {
        it('deve renderizar botões com estilos corretos', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text' }
            ];

            render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ name: '' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                    onCancel={mockOnCancel}
                />
            );

            const submitButton = screen.getByRole('button', { name: /salvar/i });
            const cancelButton = screen.getByRole('button', { name: /cancelar/i });

            expect(submitButton).toBeInTheDocument();
            expect(cancelButton).toBeInTheDocument();

            // Verifica que os botões têm classes corretas (via mock)
            expect(submitButton).toHaveClass('btn');
            expect(cancelButton).toHaveClass('btn', 'secondary');
        });

        it('deve renderizar botão de voltar quando onCancel é fornecido', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text' }
            ];

            render(
                <BaseForm
                    title="Formulário Teste"
                    fields={fields}
                    values={{ name: '' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                    onCancel={mockOnCancel}
                />
            );

            // Deve ter botão de voltar no header
            const backButtons = screen.getAllByTestId('button');
            const headerBackButton = backButtons.find(btn => 
                btn.className.includes('ghost') && btn.className.includes('p-2')
            );
            expect(headerBackButton).toBeInTheDocument();
        });
    });

    describe('Snapshot de Estrutura Visual', () => {
        it('deve manter estrutura DOM consistente para formulário básico', () => {
            const fields: FieldConfig[] = [
                { name: 'name', label: 'Nome', type: 'text', required: true },
                { name: 'email', label: 'Email', type: 'email' }
            ];

            const { container } = render(
                <BaseForm
                    title="Formulário de Teste"
                    subtitle="Subtítulo do formulário"
                    fields={fields}
                    values={{ name: 'João', email: 'joao@test.com' }}
                    errors={{}}
                    onFieldChange={mockOnFieldChange}
                    onSubmit={mockOnSubmit}
                    onCancel={mockOnCancel}
                />
            );

            // Verifica estrutura básica esperada
            expect(container.querySelector('[data-testid="card"]')).toBeInTheDocument();
            expect(container.querySelector('h2')).toHaveTextContent('Formulário de Teste');
            expect(container.querySelector('p')).toHaveTextContent('Subtítulo do formulário');
            expect(container.querySelector('form')).toBeInTheDocument();
            expect(container.querySelector('.grid')).toBeInTheDocument();
            expect(container.querySelectorAll('input')).toHaveLength(2);
            expect(container.querySelectorAll('label')).toHaveLength(2);
            expect(container.querySelectorAll('[data-testid="button"]')).toHaveLength(3); // back, cancel, submit
        });
    });
});