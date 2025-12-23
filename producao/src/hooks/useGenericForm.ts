import { useState, useEffect, useCallback } from 'react';

// Tipos genéricos para configuração de formulário
export interface FormFieldConfig<T = any> {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'array';
  defaultValue: T;
  validation?: ValidationRule<T>[];
  options?: { value: any; label: string }[]; // Para campos select
  dependencies?: string[]; // Campos que afetam este campo
}

export interface ValidationRule<T = any> {
  validate: (value: T, allValues: Record<string, any>) => boolean;
  message: string;
}

export interface FormTransformers<T = any> {
  beforeSubmit?: (values: Record<string, any>) => T;
  afterLoad?: (data: T) => Record<string, any>;
}

export interface GenericFormConfig<T = any> {
  fields: FormFieldConfig[];
  initialData?: T | null;
  validationRules?: ValidationRule[];
  onSubmit: (data: T, isEdit: boolean) => Promise<void>;
  transformers?: FormTransformers<T>;
  enableDuplicateDetection?: boolean;
  duplicateDetectionFields?: string[];
}

export interface UseGenericFormReturn {
  values: Record<string, any>;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isDirty: boolean;
  duplicateWarning: boolean;
  setValue: (name: string, value: any) => void;
  setValues: (values: Record<string, any>) => void;
  setError: (name: string, error: string) => void;
  clearErrors: () => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  reset: () => void;
  validate: () => boolean;
}

/**
 * Hook genérico para gerenciamento de formulários
 * Consolida padrões comuns de useState, validação e submissão
 */
export const useGenericForm = <T = any>(config: GenericFormConfig<T>): UseGenericFormReturn => {
  const {
    fields,
    initialData,
    validationRules = [],
    onSubmit,
    transformers,
    enableDuplicateDetection = false,
    duplicateDetectionFields = []
  } = config;

  // Criar valores iniciais baseados na configuração dos campos
  const createInitialValues = useCallback(() => {
    const initialValues: Record<string, any> = {};
    
    fields.forEach(field => {
      initialValues[field.name] = field.defaultValue;
    });
    
    return initialValues;
  }, [fields]);

  // Estados do formulário
  const [values, setValues] = useState<Record<string, any>>(createInitialValues());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [initialValues, setInitialValues] = useState<Record<string, any>>(createInitialValues());

  // Carregar dados iniciais
  useEffect(() => {
    if (initialData) {
      const loadedValues = transformers?.afterLoad 
        ? transformers.afterLoad(initialData)
        : initialData as Record<string, any>;
      
      setValues(loadedValues);
      setInitialValues(loadedValues);
      setIsDirty(false);
    } else {
      const defaultValues = createInitialValues();
      setValues(defaultValues);
      setInitialValues(defaultValues);
      setIsDirty(false);
    }
  }, [initialData, transformers, createInitialValues]);

  // Detectar mudanças no formulário
  useEffect(() => {
    const hasChanges = Object.keys(values).some(key => 
      values[key] !== initialValues[key]
    );
    setIsDirty(hasChanges);
  }, [values, initialValues]);

  // Limpar aviso de duplicata quando campos relevantes mudam
  useEffect(() => {
    if (enableDuplicateDetection && duplicateDetectionFields.length > 0) {
      const hasRelevantChanges = duplicateDetectionFields.some(field => 
        values[field] !== initialValues[field]
      );
      
      if (hasRelevantChanges) {
        setDuplicateWarning(false);
      }
    }
  }, [values, initialValues, enableDuplicateDetection, duplicateDetectionFields]);

  // Função para definir um valor específico
  const setValue = useCallback((name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    // Limpar erro do campo quando valor muda
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [errors]);

  // Função para definir múltiplos valores
  const setValuesMultiple = useCallback((newValues: Record<string, any>) => {
    setValues(prev => ({ ...prev, ...newValues }));
    
    // Limpar erros dos campos que mudaram
    const changedFields = Object.keys(newValues);
    if (changedFields.some(field => errors[field])) {
      setErrors(prev => {
        const newErrors = { ...prev };
        changedFields.forEach(field => delete newErrors[field]);
        return newErrors;
      });
    }
  }, [errors]);

  // Função para definir erro específico
  const setError = useCallback((name: string, error: string) => {
    setErrors(prev => ({ ...prev, [name]: error }));
  }, []);

  // Função para limpar todos os erros
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Validação do formulário
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    // Validar cada campo
    fields.forEach(field => {
      const value = values[field.name];
      
      if (field.validation) {
        for (const rule of field.validation) {
          if (!rule.validate(value, values)) {
            newErrors[field.name] = rule.message;
            isValid = false;
            break; // Parar no primeiro erro
          }
        }
      }
    });

    // Validações globais
    validationRules.forEach(rule => {
      if (!rule.validate(values, values)) {
        newErrors.form = rule.message;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, fields, validationRules]);

  // Submissão do formulário
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (isSubmitting) return;

    // Validar formulário
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Transformar dados antes da submissão
      const dataToSubmit = transformers?.beforeSubmit 
        ? transformers.beforeSubmit(values)
        : values as T;

      const isEdit = !!initialData;
      await onSubmit(dataToSubmit, isEdit);

      // Resetar estado após sucesso
      if (!isEdit) {
        reset();
      } else {
        setInitialValues(values);
        setIsDirty(false);
      }
    } catch (error) {
      // Erro será tratado pelo onSubmit
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, initialData, transformers, onSubmit, validate, isSubmitting]);

  // Reset do formulário
  const reset = useCallback(() => {
    const defaultValues = createInitialValues();
    setValues(defaultValues);
    setInitialValues(defaultValues);
    setErrors({});
    setIsDirty(false);
    setDuplicateWarning(false);
  }, [createInitialValues]);

  return {
    values,
    errors,
    isSubmitting,
    isDirty,
    duplicateWarning,
    setValue,
    setValues: setValuesMultiple,
    setError,
    clearErrors,
    handleSubmit,
    reset,
    validate
  };
};

// Utilitários para validação comum
export const ValidationRules = {
  required: <T>(message = 'Campo obrigatório'): ValidationRule<T> => ({
    validate: (value) => {
      if (typeof value === 'string') return value.trim() !== '';
      if (typeof value === 'number') return value > 0;
      if (Array.isArray(value)) return value.length > 0;
      return value != null && value !== '';
    },
    message
  }),

  minLength: (min: number, message?: string): ValidationRule<string> => ({
    validate: (value) => !value || value.length >= min,
    message: message || `Mínimo ${min} caracteres`
  }),

  maxLength: (max: number, message?: string): ValidationRule<string> => ({
    validate: (value) => !value || value.length <= max,
    message: message || `Máximo ${max} caracteres`
  }),

  min: (min: number, message?: string): ValidationRule<number> => ({
    validate: (value) => value == null || value >= min,
    message: message || `Valor mínimo: ${min}`
  }),

  max: (max: number, message?: string): ValidationRule<number> => ({
    validate: (value) => !value || value <= max,
    message: message || `Valor máximo: ${max}`
  }),

  email: (message = 'Email inválido'): ValidationRule<string> => ({
    validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message
  }),

  custom: <T>(validator: (value: T, allValues: Record<string, any>) => boolean, message: string): ValidationRule<T> => ({
    validate: validator,
    message
  })
};