import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';

interface TransitionState {
  isTransitioning: boolean;
  currentMonth: string; // "YYYY-MM"
  previousData: any | null;
}

interface TransitionContextValue {
  state: TransitionState;
  startTransition: (newMonth: Date, previousData?: any) => void;
  endTransition: () => void;
  isTransitioning: boolean;
}

const TransitionContext = createContext<TransitionContextValue | undefined>(undefined);

interface TransitionProviderProps {
  children: ReactNode;
  initialDate?: Date;
}

export const TransitionProvider: React.FC<TransitionProviderProps> = ({ 
  children, 
  initialDate = new Date() 
}) => {
  const [state, setState] = useState<TransitionState>({
    isTransitioning: false,
    currentMonth: formatMonth(initialDate),
    previousData: null,
  });

  const transitionTimeoutRef = useRef<NodeJS.Timeout>();
  const MAX_TRANSITION_TIME = 5000; // 5 seconds timeout

  const startTransition = useCallback((newMonth: Date, previousData?: any) => {
    const monthKey = formatMonth(newMonth);
    
    // Clear any existing timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    setState({
      isTransitioning: true,
      currentMonth: monthKey,
      previousData: previousData || null,
    });

    // Safety timeout: force end transition after MAX_TRANSITION_TIME
    transitionTimeoutRef.current = setTimeout(() => {
      console.warn('Transition timeout reached, forcing end transition');
      setState(prev => ({
        ...prev,
        isTransitioning: false,
        previousData: null,
      }));
    }, MAX_TRANSITION_TIME);
  }, []);

  const endTransition = useCallback(() => {
    // Clear timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    setState(prev => ({
      ...prev,
      isTransitioning: false,
      previousData: null,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  const value: TransitionContextValue = {
    state,
    startTransition,
    endTransition,
    isTransitioning: state.isTransitioning,
  };

  return (
    <TransitionContext.Provider value={value}>
      {children}
    </TransitionContext.Provider>
  );
};

export const useTransition = (): TransitionContextValue => {
  const context = useContext(TransitionContext);
  if (!context) {
    throw new Error('useTransition must be used within a TransitionProvider');
  }
  return context;
};

// Helper function to format date as "YYYY-MM"
function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}
