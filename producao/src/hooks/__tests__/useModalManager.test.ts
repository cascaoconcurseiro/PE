import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useModalManager, useModal, useCommonModals, ModalConfigs } from '../useModalManager';

describe('useModalManager', () => {
  const basicConfigs = [
    { name: 'modal1', initialData: null },
    { name: 'modal2', initialData: { test: 'data' } },
    { name: 'modal3', defaultState: { customProp: 'value' } }
  ];

  describe('Initialization', () => {
    it('should initialize all modals as closed', () => {
      const { result } = renderHook(() => useModalManager(basicConfigs));

      expect(result.current.getModal('modal1').isOpen).toBe(false);
      expect(result.current.getModal('modal2').isOpen).toBe(false);
      expect(result.current.getModal('modal3').isOpen).toBe(false);
      expect(result.current.isAnyModalOpen).toBe(false);
    });

    it('should initialize with correct initial data', () => {
      const { result } = renderHook(() => useModalManager(basicConfigs));

      expect(result.current.getModal('modal1').data).toBeNull();
      expect(result.current.getModal('modal2').data).toEqual({ test: 'data' });
      expect(result.current.getModal('modal3').customProp).toBe('value');
    });

    it('should handle empty configs', () => {
      const { result } = renderHook(() => useModalManager([]));

      expect(result.current.modals).toEqual({});
      expect(result.current.isAnyModalOpen).toBe(false);
    });
  });

  describe('Modal Operations', () => {
    it('should open modal correctly', () => {
      const { result } = renderHook(() => useModalManager(basicConfigs));

      act(() => {
        result.current.openModal('modal1');
      });

      expect(result.current.getModal('modal1').isOpen).toBe(true);
      expect(result.current.isAnyModalOpen).toBe(true);
    });

    it('should open modal with data', () => {
      const { result } = renderHook(() => useModalManager(basicConfigs));
      const testData = { id: '123', name: 'Test' };

      act(() => {
        result.current.openModal('modal1', testData);
      });

      expect(result.current.getModal('modal1').isOpen).toBe(true);
      expect(result.current.getModal('modal1').data).toEqual(testData);
    });

    it('should close modal correctly', () => {
      const { result } = renderHook(() => useModalManager(basicConfigs));

      // Open modal first
      act(() => {
        result.current.openModal('modal1');
      });

      expect(result.current.getModal('modal1').isOpen).toBe(true);

      // Close modal
      act(() => {
        result.current.closeModal('modal1');
      });

      expect(result.current.getModal('modal1').isOpen).toBe(false);
      expect(result.current.isAnyModalOpen).toBe(false);
    });

    it('should close all modals', () => {
      const { result } = renderHook(() => useModalManager(basicConfigs));

      // Open multiple modals
      act(() => {
        result.current.openModal('modal1');
        result.current.openModal('modal2');
      });

      expect(result.current.getModal('modal1').isOpen).toBe(true);
      expect(result.current.getModal('modal2').isOpen).toBe(true);
      expect(result.current.isAnyModalOpen).toBe(true);

      // Close all
      act(() => {
        result.current.closeAllModals();
      });

      expect(result.current.getModal('modal1').isOpen).toBe(false);
      expect(result.current.getModal('modal2').isOpen).toBe(false);
      expect(result.current.isAnyModalOpen).toBe(false);
    });

    it('should handle non-existent modal gracefully', () => {
      const { result } = renderHook(() => useModalManager(basicConfigs));

      const nonExistentModal = result.current.getModal('nonexistent');
      expect(nonExistentModal.isOpen).toBe(false);

      // Should not throw error
      act(() => {
        result.current.openModal('nonexistent');
        result.current.closeModal('nonexistent');
      });
    });
  });

  describe('Modal Actions', () => {
    it('should provide correct actions for modal', () => {
      const { result } = renderHook(() => useModalManager(basicConfigs));
      const actions = result.current.getActions('modal1');

      expect(typeof actions.open).toBe('function');
      expect(typeof actions.close).toBe('function');
      expect(typeof actions.toggle).toBe('function');
      expect(typeof actions.update).toBe('function');
      expect(typeof actions.reset).toBe('function');
    });

    it('should toggle modal state', () => {
      const { result } = renderHook(() => useModalManager(basicConfigs));
      const actions = result.current.getActions('modal1');

      expect(result.current.getModal('modal1').isOpen).toBe(false);

      // Toggle to open
      act(() => {
        actions.toggle();
      });

      expect(result.current.getModal('modal1').isOpen).toBe(true);

      // Toggle to close
      act(() => {
        actions.toggle();
      });

      expect(result.current.getModal('modal1').isOpen).toBe(false);
    });

    it('should update modal state', () => {
      const { result } = renderHook(() => useModalManager(basicConfigs));
      const actions = result.current.getActions('modal1');

      act(() => {
        actions.update({ customField: 'updated', data: { new: 'data' } });
      });

      const modal = result.current.getModal('modal1');
      expect(modal.customField).toBe('updated');
      expect(modal.data).toEqual({ new: 'data' });
    });

    it('should reset modal to initial state', () => {
      const { result } = renderHook(() => useModalManager(basicConfigs));
      const actions = result.current.getActions('modal2');

      // Modify modal state
      act(() => {
        actions.open({ modified: 'data' });
        actions.update({ customField: 'added' });
      });

      expect(result.current.getModal('modal2').isOpen).toBe(true);
      expect(result.current.getModal('modal2').data).toEqual({ modified: 'data' });
      expect(result.current.getModal('modal2').customField).toBe('added');

      // Reset
      act(() => {
        actions.reset();
      });

      const modal = result.current.getModal('modal2');
      expect(modal.isOpen).toBe(false);
      expect(modal.data).toEqual({ test: 'data' }); // Back to initial data
      expect(modal.customField).toBeUndefined();
    });
  });

  describe('isAnyModalOpen', () => {
    it('should correctly track if any modal is open', () => {
      const { result } = renderHook(() => useModalManager(basicConfigs));

      expect(result.current.isAnyModalOpen).toBe(false);

      // Open one modal
      act(() => {
        result.current.openModal('modal1');
      });

      expect(result.current.isAnyModalOpen).toBe(true);

      // Open another modal
      act(() => {
        result.current.openModal('modal2');
      });

      expect(result.current.isAnyModalOpen).toBe(true);

      // Close one modal
      act(() => {
        result.current.closeModal('modal1');
      });

      expect(result.current.isAnyModalOpen).toBe(true); // modal2 still open

      // Close last modal
      act(() => {
        result.current.closeModal('modal2');
      });

      expect(result.current.isAnyModalOpen).toBe(false);
    });
  });
});

describe('useModal (single modal hook)', () => {
  it('should manage single modal correctly', () => {
    const { result } = renderHook(() => useModal('testModal', { initial: 'data' }));

    // Initial state
    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toEqual({ initial: 'data' });

    // Open modal
    act(() => {
      result.current.open({ new: 'data' });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toEqual({ new: 'data' });

    // Close modal
    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
  });
});

describe('useCommonModals', () => {
  it('should provide common modal configurations', () => {
    const { result } = renderHook(() => useCommonModals());

    expect(result.current.deleteModal).toBeDefined();
    expect(result.current.confirmModal).toBeDefined();
    expect(result.current.inputModal).toBeDefined();
    expect(result.current.importModal).toBeDefined();

    expect(result.current.delete).toBeDefined();
    expect(result.current.confirm).toBeDefined();
    expect(result.current.input).toBeDefined();
    expect(result.current.import).toBeDefined();
  });

  it('should manage delete modal correctly', () => {
    const { result } = renderHook(() => useCommonModals());

    expect(result.current.deleteModal.isOpen).toBe(false);
    expect(result.current.deleteModal.id).toBeNull();
    expect(result.current.deleteModal.isSeries).toBe(false);

    // Open delete modal
    act(() => {
      result.current.delete.open({ id: '123', isSeries: true });
    });

    expect(result.current.deleteModal.isOpen).toBe(true);
    expect(result.current.deleteModal.data).toEqual({ id: '123', isSeries: true });
  });

  it('should manage confirm modal correctly', () => {
    const { result } = renderHook(() => useCommonModals());
    const mockConfirm = vi.fn();

    expect(result.current.confirmModal.isOpen).toBe(false);

    // Open confirm modal
    act(() => {
      result.current.confirm.open({
        title: 'Confirm Action',
        message: 'Are you sure?',
        onConfirm: mockConfirm
      });
    });

    expect(result.current.confirmModal.isOpen).toBe(true);
    expect(result.current.confirmModal.data).toEqual({
      title: 'Confirm Action',
      message: 'Are you sure?',
      onConfirm: mockConfirm
    });
  });

  it('should close all modals', () => {
    const { result } = renderHook(() => useCommonModals());

    // Open multiple modals
    act(() => {
      result.current.delete.open({ id: '123' });
      result.current.confirm.open({ title: 'Test', message: 'Test', onConfirm: () => {} });
    });

    expect(result.current.isAnyModalOpen).toBe(true);

    // Close all
    act(() => {
      result.current.closeAllModals();
    });

    expect(result.current.isAnyModalOpen).toBe(false);
    expect(result.current.deleteModal.isOpen).toBe(false);
    expect(result.current.confirmModal.isOpen).toBe(false);
  });
});

describe('ModalConfigs utilities', () => {
  it('should create correct confirm config', () => {
    const config = ModalConfigs.confirm('testConfirm');

    expect(config.name).toBe('testConfirm');
    expect(config.defaultState).toEqual({
      title: '',
      message: '',
      onConfirm: expect.any(Function)
    });
  });

  it('should create correct delete config', () => {
    const config = ModalConfigs.delete('testDelete');

    expect(config.name).toBe('testDelete');
    expect(config.defaultState).toEqual({
      id: null,
      isSeries: false
    });
  });

  it('should create correct edit config', () => {
    const initialData = { id: '123', name: 'Test' };
    const config = ModalConfigs.edit('testEdit', initialData);

    expect(config.name).toBe('testEdit');
    expect(config.initialData).toEqual(initialData);
    expect(config.defaultState).toEqual({
      data: initialData
    });
  });

  it('should create correct input config', () => {
    const config = ModalConfigs.input('testInput');

    expect(config.name).toBe('testInput');
    expect(config.defaultState).toEqual({
      title: '',
      value: '',
      onConfirm: expect.any(Function)
    });
  });

  it('should create correct custom config', () => {
    const customState = { customProp: 'value' };
    const initialData = { test: 'data' };
    const config = ModalConfigs.custom('testCustom', customState, initialData);

    expect(config.name).toBe('testCustom');
    expect(config.initialData).toEqual(initialData);
    expect(config.defaultState).toEqual(customState);
  });
});