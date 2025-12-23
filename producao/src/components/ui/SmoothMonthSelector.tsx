import React, { useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTransition } from '../../contexts/TransitionContext';

interface SmoothMonthSelectorProps {
    currentDate: Date;
    onDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMonthChange: (direction: 'prev' | 'next') => void;
}

export const SmoothMonthSelector: React.FC<SmoothMonthSelectorProps> = ({
    currentDate,
    onDateChange,
    onMonthChange
}) => {
    const { isTransitioning } = useTransition();
    const [displayDate, setDisplayDate] = useState(currentDate);
    const debounceTimeoutRef = useRef<NodeJS.Timeout>();

    const getMonthInputValue = (date: Date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    };

    const handleMonthChange = useCallback((direction: 'prev' | 'next') => {
        if (isTransitioning) return; // Previne cliques múltiplos

        // Atualiza a data de exibição imediatamente para feedback visual
        const newDate = new Date(currentDate);
        newDate.setDate(1);
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        setDisplayDate(newDate);

        // Chama a função original imediatamente (sem delay)
        onMonthChange(direction);
    }, [currentDate, onMonthChange, isTransitioning]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (isTransitioning) return;

        // Atualiza display imediatamente
        if (e.target.value) {
            const [year, month] = e.target.value.split('-');
            const newDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            setDisplayDate(newDate);
        }

        // Debounce apenas para cliques rápidos (50ms)
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(() => {
            onDateChange(e);
        }, 50);
    }, [onDateChange, isTransitioning]);

    // Sincroniza displayDate com currentDate quando não está em transição
    React.useEffect(() => {
        if (!isTransitioning) {
            setDisplayDate(currentDate);
        }
    }, [currentDate, isTransitioning]);

    // Cleanup do timeout
    React.useEffect(() => {
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className={`flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-slate-200 dark:border-slate-700 mx-2 flex-1 justify-center max-w-[200px] md:max-w-[220px] transition-all duration-150 ${isTransitioning ? 'opacity-90' : 'opacity-100'}`}>
            <button 
                onClick={() => handleMonthChange('prev')} 
                disabled={isTransitioning}
                className="relative z-30 p-3 md:p-1.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-full transition-all text-slate-600 dark:text-slate-400 active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center justify-center relative group cursor-pointer h-8 px-2 min-w-[70px]">
                <span className={`text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 pointer-events-none leading-none pt-0.5 truncate transition-opacity duration-150 ${isTransitioning ? 'opacity-70' : 'opacity-100'}`}>
                    {displayDate.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()}/{displayDate.getFullYear().toString().slice(2)}
                </span>
                <input
                    type="month"
                    value={getMonthInputValue(displayDate)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                    onChange={handleInputChange}
                    disabled={isTransitioning}
                />
            </div>
            
            <button 
                onClick={() => handleMonthChange('next')} 
                disabled={isTransitioning}
                className="relative z-30 p-3 md:p-1.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-full transition-all text-slate-600 dark:text-slate-400 active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
};