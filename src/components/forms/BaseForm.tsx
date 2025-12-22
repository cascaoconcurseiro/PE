import React, { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ArrowLeft, AlertCircle, X } from 'lucide-react';

// Tipos base para configuração de campos
export interface BaseFieldConfig {
    name: string;
    label: string;
    type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'custom';
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    validation?: (value: any) => string | null;
    className?: string;
    gridCols?: 1 | 2; // Para layout em grid
}

export interface SelectFieldConfig extends BaseFieldConfig {
    type: 'select';
    options: Array<{ value: string; label: string; group?: string }>;
    groups?: Array<{ label: string; options: Array<{ value: string; label: string }> }>;
}

export interface CustomFieldConfig extends BaseFieldConfig {
    type: 'custom';
    render: (props: {
        value: any;
        onChange: (value: any) => void;
        error?: string;
        disabled?: boolean;
    }) => ReactNode;
}

export type FieldConfig = BaseFieldConfig | SelectFieldConfig | CustomFieldConfig;

export interface BaseFormProps {
    title: string;
    subtitle?: string;
    fields: FieldConfig[];
    values: Record<string, any>;
    errors: Record<string, string>;
    onFieldChange: (name: string, value: any) => void;
    onSubmit: (e: React.FormEvent) => void;
    onCancel?: () => void;
    submitLabel?: string;
    cancelLabel?: string;
    isSubmitting?: boolean;
    isReadOnly?: boolean;
    showCard?: boolean;
    className?: string;
    headerActions?: ReactNode;
    footerActions?: ReactNode;
    globalError?: string;
    successMessage?: string;
    warningMessage?: string;
    children?: ReactNode; // Para conteúdo customizado adicional
}

/**
 * Componente base para formulários
 * Consolida padrões comuns de formulários do sistema
 * Reduz duplicação de código e garante consistência visual
 */
export const BaseForm: React.FC<BaseFormProps> = ({
    title,
    subtitle,
    fields,
    values,
    errors,
    onFieldChange,
    onSubmit,
    onCancel,
    submitLabel = 'Salvar',
    cancelLabel = 'Cancelar',
    isSubmitting = false,
    isReadOnly = false,
    showCard = true,
    className = '',
    headerActions,
    footerActions,
    globalError,
    successMessage,
    warningMessage,
    children
}) => {
    const renderField = (field: FieldConfig) => {
        const value = values[field.name] || '';
        const error = errors[field.name];
        const isDisabled = field.disabled || isReadOnly;

        const baseInputClasses = `
            w-full text-base font-medium text-slate-900 dark:text-white 
            border-b border-slate-200 dark:border-slate-700 pb-1 outline-none 
            focus:border-indigo-500 bg-transparent 
            placeholder:text-slate-300 dark:placeholder:text-slate-600 
            transition-colors rounded-none px-0
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${error ? 'border-red-500 dark:border-red-400' : ''}
        `;

        const selectClasses = `
            bg-slate-50 dark:bg-slate-800 rounded-xl h-10 flex items-center px-3 
            border border-slate-200 dark:border-slate-700 relative
            ${isDisabled ? 'opacity-50' : ''}
            ${error ? 'border-red-500 dark:border-red-400' : ''}
        `;

        const renderFieldContent = () => {
            switch (field.type) {
                case 'text':
                case 'email':
                case 'password':
                    return (
                        <input
                            type={field.type}
                            placeholder={field.placeholder}
                            value={value}
                            onChange={(e) => onFieldChange(field.name, e.target.value)}
                            className={`${baseInputClasses} ${field.className || ''}`}
                            disabled={isDisabled}
                            required={field.required}
                        />
                    );

                case 'number':
                    return (
                        <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            placeholder={field.placeholder}
                            value={value}
                            onChange={(e) => onFieldChange(field.name, e.target.value)}
                            className={`${baseInputClasses} ${field.className || ''}`}
                            disabled={isDisabled}
                            required={field.required}
                        />
                    );

                case 'date':
                    return (
                        <div className={selectClasses}>
                            <input
                                type="date"
                                value={value}
                                onClick={(e) => {
                                    if (!isDisabled) {
                                        try {
                                            e.currentTarget.showPicker();
                                        } catch (e) {
                                            // Ignore picker errors
                                        }
                                    }
                                }}
                                onChange={(e) => onFieldChange(field.name, e.target.value)}
                                className="bg-transparent font-bold text-slate-700 dark:text-slate-200 text-sm outline-none w-full h-full disabled:cursor-not-allowed"
                                disabled={isDisabled}
                                required={field.required}
                            />
                        </div>
                    );

                case 'select':
                    const selectField = field as SelectFieldConfig;
                    return (
                        <div className={selectClasses}>
                            <select
                                value={value}
                                onChange={(e) => onFieldChange(field.name, e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer text-slate-900 disabled:cursor-not-allowed"
                                disabled={isDisabled}
                                required={field.required}
                            >
                                {selectField.groups ? (
                                    selectField.groups.map((group) => (
                                        <optgroup key={group.label} label={group.label}>
                                            {group.options.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))
                                ) : (
                                    selectField.options?.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))
                                )}
                            </select>
                            <span className="pointer-events-none truncate text-sm font-bold text-slate-700 dark:text-slate-200 flex-1">
                                {selectField.options?.find(opt => opt.value === value)?.label || value}
                            </span>
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    );

                case 'textarea':
                    return (
                        <textarea
                            placeholder={field.placeholder}
                            value={value}
                            onChange={(e) => onFieldChange(field.name, e.target.value)}
                            className={`${baseInputClasses} min-h-[80px] resize-y ${field.className || ''}`}
                            disabled={isDisabled}
                            required={field.required}
                        />
                    );

                case 'checkbox':
                    return (
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!value}
                                onChange={(e) => onFieldChange(field.name, e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                disabled={isDisabled}
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {field.label}
                            </span>
                        </label>
                    );

                case 'custom':
                    const customField = field as CustomFieldConfig;
                    return customField.render({
                        value,
                        onChange: (newValue) => onFieldChange(field.name, newValue),
                        error,
                        disabled: isDisabled
                    });

                default:
                    return null;
            }
        };

        return (
            <div
                key={field.name}
                className={`${field.gridCols === 2 ? 'col-span-2' : 'col-span-1'} ${field.type === 'checkbox' ? 'flex items-center' : ''}`}
            >
                {field.type !== 'checkbox' && (
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block uppercase tracking-wider">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
                {renderFieldContent()}
                {error && (
                    <p className="text-red-600 dark:text-red-400 text-xs font-bold mt-1 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                        {error}
                    </p>
                )}
            </div>
        );
    };

    const formContent = (
        <div className={`space-y-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {onCancel && (
                        <Button variant="ghost" onClick={onCancel} className="p-2">
                            <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                        </Button>
                    )}
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                            {title}
                        </h2>
                        {subtitle && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>
                {headerActions}
            </div>

            {/* Global Messages */}
            {globalError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3 rounded-xl text-sm font-bold flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    {globalError}
                </div>
            )}

            {successMessage && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 p-3 rounded-xl text-sm font-bold flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {successMessage}
                </div>
            )}

            {warningMessage && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-3 rounded-xl text-sm font-bold flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    {warningMessage}
                </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-6">
                {/* Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fields.map(renderField)}
                </div>

                {/* Custom Content */}
                {children}

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-4">
                    <div className="flex-1">
                        {footerActions}
                    </div>
                    <div className="flex items-center gap-3">
                        {onCancel && (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={onCancel}
                                disabled={isSubmitting}
                            >
                                {cancelLabel}
                            </Button>
                        )}
                        {!isReadOnly && (
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="min-w-[120px]"
                            >
                                {isSubmitting ? 'Salvando...' : submitLabel}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );

    if (showCard) {
        return (
            <Card className="bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-lg">
                {formContent}
            </Card>
        );
    }

    return formContent;
};

// Hook auxiliar para gerenciar estado de formulário
export const useBaseForm = <T extends Record<string, any>>(
    initialValues: T,
    validationRules?: Partial<Record<keyof T, (value: any) => string | null>>
) => {
    const [values, setValues] = React.useState<T>(initialValues);
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleFieldChange = React.useCallback((name: string, value: any) => {
        setValues(prev => ({ ...prev, [name]: value }));
        
        // Clear error when field changes
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }

        // Run validation if provided
        if (validationRules?.[name as keyof T]) {
            const error = validationRules[name as keyof T]!(value);
            if (error) {
                setErrors(prev => ({ ...prev, [name]: error }));
            }
        }
    }, [errors, validationRules]);

    const validate = React.useCallback(() => {
        if (!validationRules) return true;

        const newErrors: Record<string, string> = {};
        let isValid = true;

        Object.keys(validationRules).forEach(key => {
            const validator = validationRules[key as keyof T];
            if (validator) {
                const error = validator(values[key as keyof T]);
                if (error) {
                    newErrors[key] = error;
                    isValid = false;
                }
            }
        });

        setErrors(newErrors);
        return isValid;
    }, [values, validationRules]);

    const reset = React.useCallback(() => {
        setValues(initialValues);
        setErrors({});
        setIsSubmitting(false);
    }, [initialValues]);

    return {
        values,
        errors,
        isSubmitting,
        setIsSubmitting,
        handleFieldChange,
        validate,
        reset,
        setValues,
        setErrors
    };
};