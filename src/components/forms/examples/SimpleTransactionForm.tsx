import React from 'react';
import { BaseForm, useBaseForm, FieldConfig } from '../BaseForm';
import { TransactionType, Category } from '../../../types';

interface SimpleTransactionFormData {
    amount: string;
    description: string;
    date: string;
    category: string;
    type: TransactionType;
}

interface SimpleTransactionFormProps {
    initialData?: Partial<SimpleTransactionFormData>;
    onSave: (data: SimpleTransactionFormData) => void;
    onCancel: () => void;
    isEditing?: boolean;
}

/**
 * Exemplo de formulário usando BaseForm
 * Demonstra como consolidar formulários repetitivos
 */
export const SimpleTransactionForm: React.FC<SimpleTransactionFormProps> = ({
    initialData,
    onSave,
    onCancel,
    isEditing = false
}) => {
    const {
        values,
        errors,
        isSubmitting,
        setIsSubmitting,
        handleFieldChange,
        validate
    } = useBaseForm<SimpleTransactionFormData>(
        {
            amount: initialData?.amount || '',
            description: initialData?.description || '',
            date: initialData?.date || new Date().toISOString().split('T')[0],
            category: initialData?.category || Category.OTHER,
            type: initialData?.type || TransactionType.EXPENSE
        },
        {
            amount: (value) => {
                if (!value || parseFloat(value) <= 0) {
                    return 'Valor deve ser maior que zero';
                }
                return null;
            },
            description: (value) => {
                if (!value?.trim()) {
                    return 'Descrição é obrigatória';
                }
                return null;
            },
            date: (value) => {
                if (!value) {
                    return 'Data é obrigatória';
                }
                return null;
            }
        }
    );

    const fields: FieldConfig[] = [
        {
            name: 'type',
            label: 'Tipo',
            type: 'select',
            required: true,
            options: [
                { value: TransactionType.EXPENSE, label: 'Despesa' },
                { value: TransactionType.INCOME, label: 'Receita' },
                { value: TransactionType.TRANSFER, label: 'Transferência' }
            ]
        },
        {
            name: 'amount',
            label: 'Valor',
            type: 'number',
            placeholder: '0,00',
            required: true
        },
        {
            name: 'description',
            label: 'Descrição',
            type: 'text',
            placeholder: 'Ex: Almoço, Uber, Salário',
            required: true,
            gridCols: 2
        },
        {
            name: 'date',
            label: 'Data',
            type: 'date',
            required: true
        },
        {
            name: 'category',
            label: 'Categoria',
            type: 'select',
            required: true,
            groups: [
                {
                    label: '🍽️ Alimentação',
                    options: [
                        { value: Category.FOOD, label: 'Alimentação' },
                        { value: Category.RESTAURANTS, label: 'Restaurantes' },
                        { value: Category.GROCERY, label: 'Mercado' }
                    ]
                },
                {
                    label: '🚗 Transporte',
                    options: [
                        { value: Category.TRANSPORTATION, label: 'Transporte' },
                        { value: Category.UBER, label: 'Uber/Taxi' },
                        { value: Category.FUEL, label: 'Combustível' }
                    ]
                },
                {
                    label: '📦 Outros',
                    options: [
                        { value: Category.OTHER, label: 'Outros' }
                    ]
                }
            ]
        }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validate()) {
            return;
        }

        setIsSubmitting(true);
        
        try {
            await onSave(values);
        } catch (error) {
            console.error('Erro ao salvar transação:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <BaseForm
            title={isEditing ? 'Editar Transação' : 'Nova Transação'}
            subtitle="Preencha os dados da transação"
            fields={fields}
            values={values}
            errors={errors}
            onFieldChange={handleFieldChange}
            onSubmit={handleSubmit}
            onCancel={onCancel}
            submitLabel={isEditing ? 'Salvar Alterações' : 'Criar Transação'}
            isSubmitting={isSubmitting}
            showCard={true}
        />
    );
};