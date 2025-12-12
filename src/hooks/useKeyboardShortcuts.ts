import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    action: () => void;
    description: string;
}

export const useKeyboardShortcuts = (shortcuts: ShortcutConfig[], enabled: boolean = true) => {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled) return;

        // Ignore if typing in input/textarea
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            // Allow Escape in inputs
            if (event.key !== 'Escape') return;
        }

        for (const shortcut of shortcuts) {
            const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
            const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
            const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
            const altMatch = shortcut.alt ? event.altKey : !event.altKey;

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                event.preventDefault();
                shortcut.action();
                return;
            }
        }
    }, [shortcuts, enabled]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
};

// Default shortcuts for the app
export const getDefaultShortcuts = (actions: {
    openNewTransaction?: () => void;
    openTransfer?: () => void;
    openSearch?: () => void;
    closeModal?: () => void;
    toggleDarkMode?: () => void;
}): ShortcutConfig[] => [
        {
            key: 'n',
            action: actions.openNewTransaction || (() => { }),
            description: 'Nova transação'
        },
        {
            key: 't',
            action: actions.openTransfer || (() => { }),
            description: 'Nova transferência'
        },
        {
            key: 'k',
            ctrl: true,
            action: actions.openSearch || (() => { }),
            description: 'Busca global'
        },
        {
            key: 'Escape',
            action: actions.closeModal || (() => { }),
            description: 'Fechar modal'
        },
        {
            key: 'd',
            ctrl: true,
            shift: true,
            action: actions.toggleDarkMode || (() => { }),
            description: 'Alternar modo escuro'
        }
    ];
