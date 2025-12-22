import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useGenericForm, ValidationRules, FormFieldConfig } from '../useGenericForm';

describe('useGenericForm', () => {
  const mockOnSubmit = vi.fn();

  const basicFields: FormFieldConfig[] = [
    {
      name: 'name',
      type: 'text',
      defaultValue: '',
      validation: [ValidationRules.required('Nome é obrigatório')]
    },
    {
      name: 'email',
      type: 'text',
      defaultValue: '',
      validation: [ValidationRules.email()]
    },
    {
      name: 'age',
      type: 'number',
      defaultValue: 0,
      validation: [ValidationRules.min(18, 'Idade mínima: 18 anos')]
    }
  ];

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit
        })
      );

      expect(result.current.values).toEqual({
        name: '',
        email: '',
        age: 0
      });
      expect(result.current.errors).toEqual({});
      expect(result.current.isDirty).toBe(false);
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should initialize with initial data', () => {
      const initialData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25
      };

      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          initialData,
          onSubmit: mockOnSubmit
        })
      );

      expect(result.current.values).toEqual(initialData);
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('Value Management', () => {
    it('should update single value and mark as dirty', () => {
      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit
        })
      );

      act(() => {
        result.current.setValue('name', 'John');
      });

      expect(result.current.values.name).toBe('John');
      expect(result.current.isDirty).toBe(true);
    });

    it('should update multiple values', () => {
      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit
        })
      );

      act(() => {
        result.current.setValues({
          name: 'John',
          email: 'john@example.com'
        });
      });

      expect(result.current.values.name).toBe('John');
      expect(result.current.values.email).toBe('john@example.com');
      expect(result.current.isDirty).toBe(true);
    });

    it('should clear errors when value changes', () => {
      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit
        })
      );

      // Set an error
      act(() => {
        result.current.setError('name', 'Test error');
      });

      expect(result.current.errors.name).toBe('Test error');

      // Change value should clear error
      act(() => {
        result.current.setValue('name', 'John');
      });

      expect(result.current.errors.name).toBeUndefined();
    });
  });

  describe('Validation', () => {
    it('should validate required fields', () => {
      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit
        })
      );

      act(() => {
        const isValid = result.current.validate();
        expect(isValid).toBe(false);
      });

      expect(result.current.errors.name).toBe('Nome é obrigatório');
    });

    it('should validate email format', () => {
      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit
        })
      );

      act(() => {
        result.current.setValue('name', 'John');
        result.current.setValue('email', 'invalid-email');
        result.current.setValue('age', 25);
      });

      act(() => {
        const isValid = result.current.validate();
        expect(isValid).toBe(false);
      });

      expect(result.current.errors.email).toBe('Email inválido');
    });

    it('should validate minimum age', () => {
      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit
        })
      );

      act(() => {
        result.current.setValue('name', 'John');
        result.current.setValue('email', 'john@example.com');
        result.current.setValue('age', 16);
      });

      act(() => {
        const isValid = result.current.validate();
        expect(isValid).toBe(false);
      });

      expect(result.current.errors.age).toBe('Idade mínima: 18 anos');
    });

    it('should pass validation with valid data', () => {
      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit
        })
      );

      act(() => {
        result.current.setValue('name', 'John');
        result.current.setValue('email', 'john@example.com');
        result.current.setValue('age', 25);
      });

      act(() => {
        const isValid = result.current.validate();
        expect(isValid).toBe(true);
      });

      expect(result.current.errors).toEqual({});
    });
  });

  describe('Form Submission', () => {
    it('should not submit with validation errors', async () => {
      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit
        })
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(result.current.errors.name).toBe('Nome é obrigatório');
    });

    it('should submit with valid data', async () => {
      mockOnSubmit.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit
        })
      );

      act(() => {
        result.current.setValue('name', 'John');
        result.current.setValue('email', 'john@example.com');
        result.current.setValue('age', 25);
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockOnSubmit).toHaveBeenCalledWith(
        {
          name: 'John',
          email: 'john@example.com',
          age: 25
        },
        false // isEdit
      );
    });

    it('should handle submission errors', async () => {
      const error = new Error('Submission failed');
      mockOnSubmit.mockRejectedValue(error);

      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit
        })
      );

      act(() => {
        result.current.setValue('name', 'John');
        result.current.setValue('email', 'john@example.com');
        result.current.setValue('age', 25);
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.isSubmitting).toBe(false);
    });

    it('should prevent double submission', async () => {
      mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit
        })
      );

      act(() => {
        result.current.setValue('name', 'John');
        result.current.setValue('email', 'john@example.com');
        result.current.setValue('age', 25);
      });

      // Start first submission
      act(() => {
        result.current.handleSubmit();
      });

      expect(result.current.isSubmitting).toBe(true);

      // Try second submission while first is in progress
      await act(async () => {
        await result.current.handleSubmit();
      });

      // Should only be called once
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Transformers', () => {
    it('should transform data before submission', async () => {
      mockOnSubmit.mockResolvedValue(undefined);

      const transformers = {
        beforeSubmit: (values: any) => ({
          ...values,
          name: values.name.toUpperCase()
        })
      };

      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit,
          transformers
        })
      );

      act(() => {
        result.current.setValue('name', 'john');
        result.current.setValue('email', 'john@example.com');
        result.current.setValue('age', 25);
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockOnSubmit).toHaveBeenCalledWith(
        {
          name: 'JOHN', // Transformed
          email: 'john@example.com',
          age: 25
        },
        false
      );
    });

    it('should transform data after loading', () => {
      const initialData = {
        fullName: 'John Doe',
        emailAddress: 'john@example.com',
        userAge: 25
      };

      const transformers = {
        afterLoad: (data: any) => ({
          name: data.fullName,
          email: data.emailAddress,
          age: data.userAge
        })
      };

      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          initialData,
          onSubmit: mockOnSubmit,
          transformers
        })
      );

      expect(result.current.values).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        age: 25
      });
    });
  });

  describe('Reset Functionality', () => {
    it('should reset form to default values', () => {
      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit
        })
      );

      // Make changes
      act(() => {
        result.current.setValue('name', 'John');
        result.current.setError('email', 'Test error');
      });

      expect(result.current.values.name).toBe('John');
      expect(result.current.errors.email).toBe('Test error');
      expect(result.current.isDirty).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.values).toEqual({
        name: '',
        email: '',
        age: 0
      });
      expect(result.current.errors).toEqual({});
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('Duplicate Detection', () => {
    it('should show duplicate warning when enabled', () => {
      const { result } = renderHook(() =>
        useGenericForm({
          fields: basicFields,
          onSubmit: mockOnSubmit,
          enableDuplicateDetection: true,
          duplicateDetectionFields: ['name', 'email']
        })
      );

      // Simulate duplicate detection logic would be handled externally
      // This test just verifies the warning state management
      expect(result.current.duplicateWarning).toBe(false);
    });
  });
});

// Property-based tests using a simple property testing approach
describe('useGenericForm - Property Tests', () => {
  /**
   * Feature: refatoracao-sistema-complexo, Property 6: Abstraction Correctness
   * Validates: Requirements 2.1
   */
  it('Property: Form state consistency - for any valid field configuration, the form should maintain consistent state', () => {
    const testConfigurations = [
      // Simple text field
      [{ name: 'text', type: 'text' as const, defaultValue: '' }],
      // Number field
      [{ name: 'num', type: 'number' as const, defaultValue: 0 }],
      // Boolean field
      [{ name: 'bool', type: 'boolean' as const, defaultValue: false }],
      // Multiple fields
      [
        { name: 'field1', type: 'text' as const, defaultValue: 'default1' },
        { name: 'field2', type: 'number' as const, defaultValue: 42 }
      ]
    ];

    testConfigurations.forEach((fields) => {
      const { result } = renderHook(() =>
        useGenericForm({
          fields,
          onSubmit: vi.fn()
        })
      );

      // Property: Initial values should match field defaults
      fields.forEach(field => {
        expect(result.current.values[field.name]).toBe(field.defaultValue);
      });

      // Property: Setting a value should update only that field
      if (fields.length > 0) {
        const firstField = fields[0];
        const newValue = firstField.type === 'text' ? 'new value' : 
                        firstField.type === 'number' ? 999 : true;

        act(() => {
          result.current.setValue(firstField.name, newValue);
        });

        expect(result.current.values[firstField.name]).toBe(newValue);
        
        // Other fields should remain unchanged
        fields.slice(1).forEach(field => {
          expect(result.current.values[field.name]).toBe(field.defaultValue);
        });
      }
    });
  });

  /**
   * Feature: refatoracao-sistema-complexo, Property 6: Abstraction Correctness  
   * Validates: Requirements 2.1
   */
  it('Property: Validation consistency - for any validation rule, it should be applied consistently', () => {
    const validationTestCases = [
      {
        rule: ValidationRules.required('Required'),
        validValues: ['test', 'any string', '123'],
        invalidValues: ['', '   ']
      },
      {
        rule: ValidationRules.min(10, 'Min 10'),
        validValues: [10, 15, 100],
        invalidValues: [0, 5, 9, -1]
      },
      {
        rule: ValidationRules.email('Invalid email'),
        validValues: ['test@example.com', 'user@domain.org', 'a@b.co'],
        invalidValues: ['invalid', '@domain.com', 'user@', 'user@domain']
      }
    ];

    validationTestCases.forEach(({ rule, validValues, invalidValues }) => {
      // Test valid values
      validValues.forEach(value => {
        const result = rule.validate(value, {});
        expect(result).toBe(true);
      });

      // Test invalid values
      invalidValues.forEach(value => {
        const result = rule.validate(value, {});
        if (!result === false) {
          console.log(`Validation failed for value: ${JSON.stringify(value)}, rule: ${rule.message}`);
        }
        expect(result).toBe(false);
      });
    });
  });

  /**
   * Feature: refatoracao-sistema-complexo, Property 6: Abstraction Correctness
   * Validates: Requirements 2.1
   */
  it('Property: State transitions - form state should transition correctly through all operations', () => {
    const fields = [
      { name: 'test', type: 'text' as const, defaultValue: 'initial' }
    ];

    const { result } = renderHook(() =>
      useGenericForm({
        fields,
        onSubmit: vi.fn().mockResolvedValue(undefined)
      })
    );

    // Property: Initial state
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isSubmitting).toBe(false);

    // Property: After value change, should be dirty
    act(() => {
      result.current.setValue('test', 'changed');
    });
    expect(result.current.isDirty).toBe(true);

    // Property: After reset, should return to initial state
    act(() => {
      result.current.reset();
    });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.values.test).toBe('initial');
  });
});