import { useState, useCallback } from 'react';

// Tipos para configuração de modais
export interface ModalConfig<T = any> {
  name: string;
  initialData?: T;
  defaultState?: Partial<ModalState<T>>;
}

export interface ModalState<T = any> {
  isOpen: boolean;
  data?: T;
  [key: string]: any;
}

export interface ModalActions<T = any> {
  open: (data?: T) => void;
  close: () => void;
  toggle: () => void;
  update: (updates: Partial<ModalState<T>>) => void;
  reset: () => void;
}

export interface UseModalManagerReturn {
  modals: Record<string, ModalState>;
  getModal: <T = any>(name: string) => ModalState<T>;
  getActions: <T = any>(name: string) => ModalActions<T>;
  openModal: <T = any>(name: string, data?: T) => void;
  closeModal: (name: string) => void;
  closeAllModals: () => void;
  isAnyModalOpen: boolean;
}

/**
 * Hook unificado para gerenciamento de múltiplos modais
 * Consolida padrões repetitivos de useState para modais
 */
export const useModalManager = (configs: ModalConfig[]): UseModalManagerReturn => {
  // Criar estado inicial baseado nas configurações
  const createInitialState = useCallback(() => {
    const initialState: Record<string, ModalState> = {};
    
    configs.forEach(config => {
      initialState[config.name] = {
        isOpen: false,
        data: config.initialData,
        ...config.defaultState
      };
    });
    
    return initialState;
  }, [configs]);

  const [modals, setModals] = useState<Record<string, ModalState>>(createInitialState());

  // Verificar se algum modal está aberto
  const isAnyModalOpen = Object.values(modals).some(modal => modal.isOpen);

  // Obter estado de um modal específico
  const getModal = useCallback(<T = any>(name: string): ModalState<T> => {
    return modals[name] as ModalState<T> || { isOpen: false };
  }, [modals]);

  // Abrir modal
  const openModal = useCallback(<T = any>(name: string, data?: T) => {
    setModals(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        isOpen: true,
        data
      }
    }));
  }, []);

  // Fechar modal
  const closeModal = useCallback((name: string) => {
    setModals(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        isOpen: false
      }
    }));
  }, []);

  // Fechar todos os modais
  const closeAllModals = useCallback(() => {
    setModals(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(name => {
        newState[name] = {
          ...newState[name],
          isOpen: false
        };
      });
      return newState;
    });
  }, []);

  // Alternar estado do modal
  const toggleModal = useCallback((name: string) => {
    setModals(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        isOpen: !prev[name]?.isOpen
      }
    }));
  }, []);

  // Atualizar estado do modal
  const updateModal = useCallback(<T = any>(name: string, updates: Partial<ModalState<T>>) => {
    setModals(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        ...updates
      }
    }));
  }, []);

  // Resetar modal para estado inicial
  const resetModal = useCallback((name: string) => {
    const config = configs.find(c => c.name === name);
    if (config) {
      setModals(prev => ({
        ...prev,
        [name]: {
          isOpen: false,
          data: config.initialData,
          ...config.defaultState
        }
      }));
    }
  }, [configs]);

  // Obter ações para um modal específico
  const getActions = useCallback(<T = any>(name: string): ModalActions<T> => ({
    open: (data?: T) => openModal(name, data),
    close: () => closeModal(name),
    toggle: () => toggleModal(name),
    update: (updates: Partial<ModalState<T>>) => updateModal(name, updates),
    reset: () => resetModal(name)
  }), [openModal, closeModal, toggleModal, updateModal, resetModal]);

  return {
    modals,
    getModal,
    getActions,
    openModal,
    closeModal,
    closeAllModals,
    isAnyModalOpen
  };
};

// Utilitários para configurações comuns de modais
export const ModalConfigs = {
  // Modal simples de confirmação
  confirm: (name: string): ModalConfig<{ title: string; message: string; onConfirm: () => void }> => ({
    name,
    defaultState: {
      title: '',
      message: '',
      onConfirm: () => {}
    }
  }),

  // Modal de delete com opções
  delete: (name: string): ModalConfig<{ id: string | null; isSeries?: boolean }> => ({
    name,
    defaultState: {
      id: null,
      isSeries: false
    }
  }),

  // Modal de edição com dados
  edit: <T>(name: string, initialData?: T): ModalConfig<T> => ({
    name,
    initialData,
    defaultState: {
      data: initialData
    }
  }),

  // Modal de importação
  import: <T>(name: string): ModalConfig<T[]> => ({
    name,
    defaultState: {
      data: []
    }
  }),

  // Modal de input com valor
  input: (name: string): ModalConfig<{ title: string; value: string; onConfirm: (value: string) => void }> => ({
    name,
    defaultState: {
      title: '',
      value: '',
      onConfirm: () => {}
    }
  }),

  // Modal genérico customizável
  custom: <T>(name: string, defaultState?: Partial<ModalState<T>>, initialData?: T): ModalConfig<T> => ({
    name,
    initialData,
    defaultState
  })
};

// Hook simplificado para um único modal
export const useModal = <T = any>(name: string, initialData?: T) => {
  const manager = useModalManager([{ name, initialData }]);
  const modal = manager.getModal<T>(name);
  const actions = manager.getActions<T>(name);

  return {
    ...modal,
    ...actions
  };
};

// Hook para modais comuns (delete, confirm, etc.)
export const useCommonModals = () => {
  const configs = [
    ModalConfigs.delete('delete'),
    ModalConfigs.confirm('confirm'),
    ModalConfigs.input('input'),
    ModalConfigs.import('import')
  ];

  const manager = useModalManager(configs);

  return {
    // Estados dos modais
    deleteModal: manager.getModal('delete'),
    confirmModal: manager.getModal('confirm'),
    inputModal: manager.getModal('input'),
    importModal: manager.getModal('import'),

    // Ações específicas
    delete: manager.getActions('delete'),
    confirm: manager.getActions('confirm'),
    input: manager.getActions('input'),
    import: manager.getActions('import'),

    // Ações globais
    closeAllModals: manager.closeAllModals,
    isAnyModalOpen: manager.isAnyModalOpen
  };
};