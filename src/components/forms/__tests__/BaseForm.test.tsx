import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BaseForm, useBaseForm, FieldConfig } from '../BaseForm';
import React from 'react';

// Mock dos componentes UI
vi.mock('@/components/ui/Button', () => ({
    Button: ({ children, onClick, disabled, type, variant, className }: any) => (
        <button
            onClick={onClick}
            disabled={disabled}
            type={type}
            className={`btn ${variant} ${className}`}
        >
            {children}
        </button>
    )
}));

vi.mock('@/components/ui/Card', () => ({
    Card: ({ children, className }: any) => (
        <div className={`card ${className}`}>{children}</div>
    )
}));

describe('BaseForm', () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();
    const mockOnFieldChange = vi.fn();

    const basicFields: FieldConfig[] = [
        {
            name: 'name',
            label: 'Nome',
            type: 'text',
            placeholder: 'Digite seu nome',
            required: true
        },
        {
            name: 'email',
            label: 'Email',
            type: 'email',
            placeholder: 'Digite seu email',
            required: true
        },
        {
            name: 'age',
            label: 'Idade',
            type: 'number',
            placeholder: '0'
        }
    ];

    const basicValues = {
        name: 'João',
        email: 'joao@example.com',
        age: '30'
    };

    const basicErrors = {
        name: '',
        email: '',
        age: ''
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve renderizar o formulário com campos básicos', () => {
        render(
            <BaseForm
                title="Formulário Teste"
                fields={basicFields}
                values={basicValues}
                errors={basicErrors}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
            />
        );

        expect(screen.getByText('Formulário Teste')).toBeInTheDocument();
        expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/idade/i)).toBeInTheDocument();
    });

    it('deve exibir valores nos campos', () => {
        render(
            <BaseForm
                title="Formulário Teste"
                fields={basicFields}
                values={basicValues}
                errors={basicErrors}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
            />
        );

        expect(screen.getByDisplayValue('João')).toBeInTheDocument();
        expect(screen.getByDisplayValue('joao@example.com')).toBeInTheDocument();
        expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    });

    it('deve chamar onFieldChange quando campo é alterado', async () => {
        render(
            <BaseForm
                title="Formulário Teste"
                fields={basicFields}
                values={basicValues}
                errors={basicErrors}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
            />
        );

        const nameInput = screen.getByDisplayValue('João');
        fireEvent.change(nameInput, { target: { value: 'Maria' } });

        expect(mockOnFieldChange).toHaveBeenCalledWith('name', 'Maria');
    });

    it('deve chamar onSubmit quando formulário é enviado', async () => {
        render(
            <BaseForm
                title="Formulário Teste"
                fields={basicFields}
                values={basicValues}
                errors={basicErrors}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
            />
        );

        const submitButton = screen.getByRole('button', { name: /salvar/i });
        fireEvent.click(submitButton);

        expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('deve exibir mensagens de erro', () => {
        const errorsWithMessages = {
            name: 'Nome é obrigatório',
            email: 'Email inválido',
            age: ''
        };

        render(
            <BaseForm
                title="Formulário Teste"
                fields={basicFields}
                values={basicValues}
                errors={errorsWithMessages}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
            />
        );

        expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument();
        expect(screen.getByText('Email inválido')).toBeInTheDocument();
    });

    it('deve renderizar campo select com opções', () => {
        const selectField: FieldConfig[] = [
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

        render(
            <BaseForm
                title="Formulário Teste"
                fields={selectField}
                values={{ category: 'food' }}
                errors={{}}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
            />
        );

        expect(screen.getByText('Alimentação')).toBeInTheDocument();
    });

    it('deve renderizar campo select com grupos', () => {
        const selectFieldWithGroups: FieldConfig[] = [
            {
                name: 'category',
                label: 'Categoria',
                type: 'select',
                groups: [
                    {
                        label: 'Essenciais',
                        options: [
                            { value: 'food', label: 'Alimentação' },
                            { value: 'transport', label: 'Transporte' }
                        ]
                    },
                    {
                        label: 'Lazer',
                        options: [
                            { value: 'entertainment', label: 'Entretenimento' }
                        ]
                    }
                ]
            }
        ];

        render(
            <BaseForm
                title="Formulário Teste"
                fields={selectFieldWithGroups}
                values={{ category: 'food' }}
                errors={{}}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
            />
        );

        expect(screen.getByText('Alimentação')).toBeInTheDocument();
    });

    it('deve renderizar campo de data', () => {
        const dateField: FieldConfig[] = [
            {
                name: 'date',
                label: 'Data',
                type: 'date',
                required: true
            }
        ];

        render(
            <BaseForm
                title="Formulário Teste"
                fields={dateField}
                values={{ date: '2024-01-01' }}
                errors={{}}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
            />
        );

        const dateInput = screen.getByDisplayValue('2024-01-01');
        expect(dateInput).toBeInTheDocument();
        expect(dateInput).toHaveAttribute('type', 'date');
    });

    it('deve renderizar campo checkbox', () => {
        const checkboxField: FieldConfig[] = [
            {
                name: 'agree',
                label: 'Concordo com os termos',
                type: 'checkbox'
            }
        ];

        render(
            <BaseForm
                title="Formulário Teste"
                fields={checkboxField}
                values={{ agree: true }}
                errors={{}}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
            />
        );

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).toBeChecked();
    });

    it('deve renderizar campo textarea', () => {
        const textareaField: FieldConfig[] = [
            {
                name: 'description',
                label: 'Descrição',
                type: 'textarea',
                placeholder: 'Digite a descrição'
            }
        ];

        render(
            <BaseForm
                title="Formulário Teste"
                fields={textareaField}
                values={{ description: 'Texto de teste' }}
                errors={{}}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
            />
        );

        const textarea = screen.getByDisplayValue('Texto de teste');
        expect(textarea).toBeInTheDocument();
        expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('deve renderizar campo customizado', () => {
        const customField: FieldConfig[] = [
            {
                name: 'custom',
                label: 'Campo Customizado',
                type: 'custom',
                render: ({ value, onChange }) => (
                    <div data-testid="custom-field">
                        <input
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder="Campo customizado"
                        />
                    </div>
                )
            }
        ];

        render(
            <BaseForm
                title="Formulário Teste"
                fields={customField}
                values={{ custom: 'valor customizado' }}
                errors={{}}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
            />
        );

        expect(screen.getByTestId('custom-field')).toBeInTheDocument();
        expect(screen.getByDisplayValue('valor customizado')).toBeInTheDocument();
    });

    it('deve desabilitar campos quando isReadOnly é true', () => {
        render(
            <BaseForm
                title="Formulário Teste"
                fields={basicFields}
                values={basicValues}
                errors={basicErrors}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
                isReadOnly={true}
            />
        );

        const nameInput = screen.getByDisplayValue('João');
        expect(nameInput).toBeDisabled();
    });

    it('deve exibir botão de cancelar quando onCancel é fornecido', () => {
        render(
            <BaseForm
                title="Formulário Teste"
                fields={basicFields}
                values={basicValues}
                errors={basicErrors}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
                onCancel={mockOnCancel}
            />
        );

        const cancelButton = screen.getByRole('button', { name: /cancelar/i });
        expect(cancelButton).toBeInTheDocument();

        fireEvent.click(cancelButton);
        expect(mockOnCancel).toHaveBeenCalled();
    });

    it('deve exibir mensagem de erro global', () => {
        render(
            <BaseForm
                title="Formulário Teste"
                fields={basicFields}
                values={basicValues}
                errors={basicErrors}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
                globalError="Erro global de teste"
            />
        );

        expect(screen.getByText('Erro global de teste')).toBeInTheDocument();
    });

    it('deve exibir mensagem de sucesso', () => {
        render(
            <BaseForm
                title="Formulário Teste"
                fields={basicFields}
                values={basicValues}
                errors={basicErrors}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
                successMessage="Operação realizada com sucesso"
            />
        );

        expect(screen.getByText('Operação realizada com sucesso')).toBeInTheDocument();
    });

    it('deve exibir mensagem de aviso', () => {
        render(
            <BaseForm
                title="Formulário Teste"
                fields={basicFields}
                values={basicValues}
                errors={basicErrors}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
                warningMessage="Aviso importante"
            />
        );

        expect(screen.getByText('Aviso importante')).toBeInTheDocument();
    });

    it('deve aplicar gridCols corretamente', () => {
        const fieldsWithGrid: FieldConfig[] = [
            {
                name: 'field1',
                label: 'Campo 1',
                type: 'text',
                gridCols: 1
            },
            {
                name: 'field2',
                label: 'Campo 2',
                type: 'text',
                gridCols: 2
            }
        ];

        const { container } = render(
            <BaseForm
                title="Formulário Teste"
                fields={fieldsWithGrid}
                values={{ field1: '', field2: '' }}
                errors={{}}
                onFieldChange={mockOnFieldChange}
                onSubmit={mockOnSubmit}
            />
        );

        const field1Container = container.querySelector('[class*="col-span-1"]');
        const field2Container = container.querySelector('[class*="col-span-2"]');

        expect(field1Container).toBeInTheDocument();
        expect(field2Container).toBeInTheDocument();
    });
});

describe('useBaseForm', () => {
    const TestComponent = () => {
        const {
            values,
            errors,
            handleFieldChange,
            validate,
            reset
        } = useBaseForm(
            { name: '', email: '' },
            {
                name: (value) => value ? null : 'Nome é obrigatório',
                email: (value) => value.includes('@') ? null : 'Email inválido'
            }
        );

        return (
            <div>
                <input
                    data-testid="name-input"
                    value={values.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                />
                <input
                    data-testid="email-input"
                    value={values.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                />
                <div data-testid="name-error">{errors.name}</div>
                <div data-testid="email-error">{errors.email}</div>
                <button onClick={() => validate()} data-testid="validate-btn">
                    Validar
                </button>
                <button onClick={reset} data-testid="reset-btn">
                    Reset
                </button>
            </div>
        );
    };

    it('deve gerenciar valores do formulário', () => {
        render(<TestComponent />);

        const nameInput = screen.getByTestId('name-input');
        fireEvent.change(nameInput, { target: { value: 'João' } });

        expect(nameInput).toHaveValue('João');
    });

    it('deve validar campos e exibir erros', async () => {
        render(<TestComponent />);

        const validateBtn = screen.getByTestId('validate-btn');
        fireEvent.click(validateBtn);

        await waitFor(() => {
            expect(screen.getByTestId('name-error')).toHaveTextContent('Nome é obrigatório');
            expect(screen.getByTestId('email-error')).toHaveTextContent('Email inválido');
        });
    });

    it('deve limpar erros quando campo é alterado', async () => {
        render(<TestComponent />);

        // Primeiro, gerar erros
        const validateBtn = screen.getByTestId('validate-btn');
        fireEvent.click(validateBtn);

        await waitFor(() => {
            expect(screen.getByTestId('name-error')).toHaveTextContent('Nome é obrigatório');
        });

        // Depois, alterar campo para limpar erro
        const nameInput = screen.getByTestId('name-input');
        fireEvent.change(nameInput, { target: { value: 'João' } });

        await waitFor(() => {
            expect(screen.getByTestId('name-error')).toHaveTextContent('');
        });
    });

    it('deve resetar formulário', async () => {
        render(<TestComponent />);

        const nameInput = screen.getByTestId('name-input');
        const resetBtn = screen.getByTestId('reset-btn');

        // Alterar valor
        fireEvent.change(nameInput, { target: { value: 'João' } });
        expect(nameInput).toHaveValue('João');

        // Resetar
        fireEvent.click(resetBtn);

        await waitFor(() => {
            expect(nameInput).toHaveValue('');
        });
    });
});