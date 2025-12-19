import React, { useState, useRef, useEffect } from 'react';
import { Mail } from 'lucide-react';

// Domínios de email mais comuns no Brasil
const EMAIL_DOMAINS = [
    'gmail.com',
    'hotmail.com',
    'outlook.com',
    'yahoo.com',
    'yahoo.com.br',
    'icloud.com',
    'live.com',
    'uol.com.br',
    'bol.com.br',
    'terra.com.br',
    'globo.com',
    'ig.com.br',
    'msn.com',
    'protonmail.com',
];

interface EmailInputProps {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    required?: boolean;
    autoComplete?: string;
    className?: string;
    inputClassName?: string;
    showIcon?: boolean;
    rightElement?: React.ReactNode;
}

export const EmailInput: React.FC<EmailInputProps> = ({
    value,
    onChange,
    onBlur,
    placeholder = 'seu@email.com',
    required = false,
    autoComplete = 'username',
    className = '',
    inputClassName = '',
    showIcon = true,
    rightElement,
}) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Gerar sugestões baseadas no input
    useEffect(() => {
        if (!value) {
            setSuggestions([]);
            return;
        }

        const atIndex = value.indexOf('@');
        
        if (atIndex === -1) {
            // Usuário ainda não digitou @, não mostrar sugestões
            setSuggestions([]);
        } else {
            // Usuário digitou @, mostrar sugestões de domínio
            const localPart = value.substring(0, atIndex);
            const domainPart = value.substring(atIndex + 1).toLowerCase();
            
            if (localPart.length > 0) {
                // Filtrar domínios que começam com o que foi digitado
                const filtered = EMAIL_DOMAINS
                    .filter(domain => domain.toLowerCase().startsWith(domainPart))
                    .map(domain => `${localPart}@${domain}`)
                    .slice(0, 5);
                
                setSuggestions(filtered);
            } else {
                setSuggestions([]);
            }
        }
        setSelectedIndex(-1);
    }, [value]);

    // Fechar sugestões ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                suggestionsRef.current && 
                !suggestionsRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => 
                    prev < suggestions.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => 
                    prev > 0 ? prev - 1 : suggestions.length - 1
                );
                break;
            case 'Enter':
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    e.preventDefault();
                    onChange(suggestions[selectedIndex]);
                    setShowSuggestions(false);
                }
                break;
            case 'Tab':
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    e.preventDefault();
                    onChange(suggestions[selectedIndex]);
                    setShowSuggestions(false);
                } else if (suggestions.length > 0) {
                    e.preventDefault();
                    onChange(suggestions[0]);
                    setShowSuggestions(false);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                break;
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        onChange(suggestion);
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    return (
        <div className="relative">
            {showIcon && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                </div>
            )}
            <input
                ref={inputRef}
                type="email"
                required={required}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                    // Delay para permitir clique nas sugestões
                    setTimeout(() => setShowSuggestions(false), 150);
                    onBlur?.();
                }}
                onKeyDown={handleKeyDown}
                className={`w-full ${showIcon ? 'pl-10' : 'pl-4'} ${rightElement ? 'pr-10' : 'pr-4'} py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-slate-900 dark:text-white font-medium transition-all ${inputClassName}`}
                placeholder={placeholder}
                autoComplete={autoComplete}
            />
            
            {/* Elemento à direita (ex: indicador de status) */}
            {rightElement && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {rightElement}
                </div>
            )}
            
            {/* Sugestões */}
            {showSuggestions && suggestions.length > 0 && (
                <div 
                    ref={suggestionsRef}
                    className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    {suggestions.map((suggestion, index) => {
                        const atIndex = suggestion.indexOf('@');
                        const localPart = suggestion.substring(0, atIndex);
                        const domainPart = suggestion.substring(atIndex);
                        
                        return (
                            <button
                                key={suggestion}
                                type="button"
                                onClick={() => handleSuggestionClick(suggestion)}
                                className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-2 ${
                                    index === selectedIndex 
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' 
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                            >
                                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                                <span>
                                    <span className="text-slate-900 dark:text-white">{localPart}</span>
                                    <span className="text-emerald-600 dark:text-emerald-400">{domainPart}</span>
                                </span>
                            </button>
                        );
                    })}
                    <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                            ↑↓ navegar • Tab/Enter selecionar
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
