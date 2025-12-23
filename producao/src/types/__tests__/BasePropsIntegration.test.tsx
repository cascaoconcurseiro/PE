/**
 * Testes de integração para Props consolidadas
 * Valida compatibilidade real com componentes React
 * Validates: Requirements 3.5
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
    BaseModalProps,
    BaseListProps,
    BaseSelectorProps,
    BaseFormProps
} from '../BaseProps';

// Componentes de teste usando as props consolidadas
const TestModal: React.FC<BaseModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div data-testid="modal">
            <h1>{title}</h1>
            <button onClick={onClose}>Close</button>
            {children}
        </div>
    );
};

interface TestItem {
    id: string;
    name: string;
}

const TestList: React.FC<BaseListProps<TestItem>> = ({ 
    items, 
    onItemClick, 
    searchTerm, 
    onSearchChange,
    emptyMessage 
}) => {
    return (
        <div>
            {onSearchChange && (
                <input
                    data-testid="search"
                    value={searchTerm || ''}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search..."
                />
            )}
            {items.length === 0 ? (
                <div data-testid="empty">{emptyMessage}</div>
            ) : (
                <ul>
                    {items.map(item => (
                        <li 
                            key={item.id}
                            data-testid={`item-${item.id}`}
                            onClick={() => onItemClick?.(item)}
                        >
                            {item.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const TestSelector: React.FC<BaseSelectorProps<TestItem>> = ({
    label,
    options,
    selectedId,
    onSelect,
    disabled,
    emptyMessage
}) => {
    return (
        <div>
            <label>{label}</label>
            {options.length === 0 ? (
                <div data-testid="empty-selector">{emptyMessage}</div>
            ) : (
                <select
                    data-testid="selector"
                    value={selectedId || ''}
                    onChange={(e) => onSelect(e.target.value)}
                    disabled={disabled}
                >
                    <option value="">Select...</option>
                    {options.map(option => (
                        <option key={option.id} value={option.id}>
                            {option.name}
                        </option>
                    ))}
                </select>
            )}
        </div>
    );
};

const TestForm: React.FC<BaseFormProps<TestItem>> = ({
    isOpen,
    onClose,
    onSave,
    onCancel,
    initialData,
    isSubmitting,
    isReadOnly
}) => {
    const [name, setName] = React.useState(initialData?.name || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: initialData?.id || '', name });
    };

    if (!isOpen) return null;

    return (
        <form data-testid="form" onSubmit={handleSubmit}>
            <input
                data-testid="name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isReadOnly}
            />
            <button 
                type="submit" 
                disabled={isSubmitting}
                data-testid="save-btn"
            >
                {isSubmitting ? 'Saving...' : 'Save'}
            </button>
            <button 
                type="button" 
                onClick={onCancel}
                data-testid="cancel-btn"
            >
                Cancel
            </button>
            <button 
                type="button" 
                onClick={onClose}
                data-testid="close-btn"
            >
                Close
            </button>
        </form>
    );
};

describe('BaseProps - Testes de Integração', () => {
    describe('BaseModalProps Integration', () => {
        it('deve renderizar modal quando isOpen é true', () => {
            render(
                <TestModal 
                    isOpen={true} 
                    onClose={vi.fn()} 
                    title="Test Modal"
                >
                    <p>Modal content</p>
                </TestModal>
            );

            expect(screen.getByTestId('modal')).toBeInTheDocument();
            expect(screen.getByText('Test Modal')).toBeInTheDocument();
            expect(screen.getByText('Modal content')).toBeInTheDocument();
        });

        it('não deve renderizar modal quando isOpen é false', () => {
            render(
                <TestModal 
                    isOpen={false} 
                    onClose={vi.fn()} 
                    title="Test Modal"
                >
                    <p>Modal content</p>
                </TestModal>
            );

            expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
        });

        it('deve chamar onClose quando botão close é clicado', () => {
            const onClose = vi.fn();
            render(
                <TestModal 
                    isOpen={true} 
                    onClose={onClose} 
                    title="Test Modal"
                />
            );

            fireEvent.click(screen.getByText('Close'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('BaseListProps Integration', () => {
        const mockItems: TestItem[] = [
            { id: '1', name: 'Item 1' },
            { id: '2', name: 'Item 2' }
        ];

        it('deve renderizar lista de itens', () => {
            render(
                <TestList 
                    items={mockItems}
                    onItemClick={vi.fn()}
                />
            );

            expect(screen.getByTestId('item-1')).toBeInTheDocument();
            expect(screen.getByTestId('item-2')).toBeInTheDocument();
            expect(screen.getByText('Item 1')).toBeInTheDocument();
            expect(screen.getByText('Item 2')).toBeInTheDocument();
        });

        it('deve mostrar mensagem vazia quando não há itens', () => {
            render(
                <TestList 
                    items={[]}
                    emptyMessage="No items found"
                />
            );

            expect(screen.getByTestId('empty')).toBeInTheDocument();
            expect(screen.getByText('No items found')).toBeInTheDocument();
        });

        it('deve chamar onItemClick quando item é clicado', () => {
            const onItemClick = vi.fn();
            render(
                <TestList 
                    items={mockItems}
                    onItemClick={onItemClick}
                />
            );

            fireEvent.click(screen.getByTestId('item-1'));
            expect(onItemClick).toHaveBeenCalledWith(mockItems[0]);
        });

        it('deve gerenciar busca corretamente', () => {
            const onSearchChange = vi.fn();
            render(
                <TestList 
                    items={mockItems}
                    searchTerm="test"
                    onSearchChange={onSearchChange}
                />
            );

            const searchInput = screen.getByTestId('search');
            expect(searchInput).toHaveValue('test');

            fireEvent.change(searchInput, { target: { value: 'new search' } });
            expect(onSearchChange).toHaveBeenCalledWith('new search');
        });
    });

    describe('BaseSelectorProps Integration', () => {
        const mockOptions: TestItem[] = [
            { id: '1', name: 'Option 1' },
            { id: '2', name: 'Option 2' }
        ];

        it('deve renderizar seletor com opções', () => {
            render(
                <TestSelector
                    label="Test Selector"
                    options={mockOptions}
                    selectedId="1"
                    onSelect={vi.fn()}
                />
            );

            expect(screen.getByText('Test Selector')).toBeInTheDocument();
            expect(screen.getByTestId('selector')).toHaveValue('1');
            expect(screen.getByText('Option 1')).toBeInTheDocument();
            expect(screen.getByText('Option 2')).toBeInTheDocument();
        });

        it('deve mostrar mensagem vazia quando não há opções', () => {
            render(
                <TestSelector
                    label="Test Selector"
                    options={[]}
                    onSelect={vi.fn()}
                    emptyMessage="No options available"
                />
            );

            expect(screen.getByTestId('empty-selector')).toBeInTheDocument();
            expect(screen.getByText('No options available')).toBeInTheDocument();
        });

        it('deve chamar onSelect quando opção é selecionada', () => {
            const onSelect = vi.fn();
            render(
                <TestSelector
                    label="Test Selector"
                    options={mockOptions}
                    onSelect={onSelect}
                />
            );

            fireEvent.change(screen.getByTestId('selector'), { target: { value: '2' } });
            expect(onSelect).toHaveBeenCalledWith('2');
        });

        it('deve desabilitar seletor quando disabled é true', () => {
            render(
                <TestSelector
                    label="Test Selector"
                    options={mockOptions}
                    onSelect={vi.fn()}
                    disabled={true}
                />
            );

            expect(screen.getByTestId('selector')).toBeDisabled();
        });
    });

    describe('BaseFormProps Integration', () => {
        const mockData: TestItem = { id: '1', name: 'Test Item' };

        it('deve renderizar formulário quando isOpen é true', () => {
            render(
                <TestForm
                    isOpen={true}
                    onClose={vi.fn()}
                    onSave={vi.fn()}
                    onCancel={vi.fn()}
                    initialData={mockData}
                />
            );

            expect(screen.getByTestId('form')).toBeInTheDocument();
            expect(screen.getByTestId('name-input')).toHaveValue('Test Item');
        });

        it('não deve renderizar formulário quando isOpen é false', () => {
            render(
                <TestForm
                    isOpen={false}
                    onClose={vi.fn()}
                    onSave={vi.fn()}
                    onCancel={vi.fn()}
                />
            );

            expect(screen.queryByTestId('form')).not.toBeInTheDocument();
        });

        it('deve chamar onSave quando formulário é submetido', () => {
            const onSave = vi.fn();
            render(
                <TestForm
                    isOpen={true}
                    onClose={vi.fn()}
                    onSave={onSave}
                    onCancel={vi.fn()}
                    initialData={mockData}
                />
            );

            fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Updated Item' } });
            fireEvent.click(screen.getByTestId('save-btn'));

            expect(onSave).toHaveBeenCalledWith({ id: '1', name: 'Updated Item' });
        });

        it('deve chamar onCancel quando botão cancel é clicado', () => {
            const onCancel = vi.fn();
            render(
                <TestForm
                    isOpen={true}
                    onClose={vi.fn()}
                    onSave={vi.fn()}
                    onCancel={onCancel}
                />
            );

            fireEvent.click(screen.getByTestId('cancel-btn'));
            expect(onCancel).toHaveBeenCalledTimes(1);
        });

        it('deve desabilitar input quando isReadOnly é true', () => {
            render(
                <TestForm
                    isOpen={true}
                    onClose={vi.fn()}
                    onSave={vi.fn()}
                    onCancel={vi.fn()}
                    isReadOnly={true}
                />
            );

            expect(screen.getByTestId('name-input')).toBeDisabled();
        });

        it('deve mostrar estado de loading no botão', () => {
            render(
                <TestForm
                    isOpen={true}
                    onClose={vi.fn()}
                    onSave={vi.fn()}
                    onCancel={vi.fn()}
                    isSubmitting={true}
                />
            );

            expect(screen.getByTestId('save-btn')).toBeDisabled();
            expect(screen.getByText('Saving...')).toBeInTheDocument();
        });
    });

    describe('Compatibilidade com Componentes Reais', () => {
        it('deve ser compatível com padrões de props existentes', () => {
            // Simula migração de componente existente
            interface LegacyModalProps {
                isOpen: boolean;
                onClose: () => void;
                title: string;
                children: React.ReactNode;
            }

            const LegacyModal: React.FC<LegacyModalProps> = (props) => {
                // Componente pode usar props consolidadas diretamente
                return <TestModal {...props} />;
            };

            const onClose = vi.fn();
            render(
                <LegacyModal
                    isOpen={true}
                    onClose={onClose}
                    title="Legacy Modal"
                >
                    <p>Legacy content</p>
                </LegacyModal>
            );

            expect(screen.getByText('Legacy Modal')).toBeInTheDocument();
            expect(screen.getByText('Legacy content')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Close'));
            expect(onClose).toHaveBeenCalled();
        });

        it('deve permitir extensão de props base', () => {
            interface ExtendedModalProps extends BaseModalProps {
                size?: 'sm' | 'md' | 'lg';
                closable?: boolean;
            }

            const ExtendedModal: React.FC<ExtendedModalProps> = ({ 
                size = 'md', 
                closable = true, 
                ...baseProps 
            }) => {
                return (
                    <div data-testid="extended-modal" data-size={size}>
                        <TestModal {...baseProps} />
                        {closable && <button data-testid="extended-close">X</button>}
                    </div>
                );
            };

            render(
                <ExtendedModal
                    isOpen={true}
                    onClose={vi.fn()}
                    title="Extended Modal"
                    size="lg"
                    closable={false}
                />
            );

            const modal = screen.getByTestId('extended-modal');
            expect(modal).toHaveAttribute('data-size', 'lg');
            expect(screen.queryByTestId('extended-close')).not.toBeInTheDocument();
        });
    });
});