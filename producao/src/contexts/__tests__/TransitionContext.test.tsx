import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { TransitionProvider, useTransition } from '../TransitionContext';
import React from 'react';

describe('TransitionContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('TransitionProvider', () => {
    it('should provide initial state', () => {
      const { result } = renderHook(() => useTransition(), {
        wrapper: ({ children }) => <TransitionProvider>{children}</TransitionProvider>,
      });

      expect(result.current.state.isTransitioning).toBe(false);
      expect(result.current.state.currentMonth).toMatch(/^\d{4}-\d{2}$/);
      expect(result.current.state.previousData).toBeNull();
    });

    it('should accept custom initial date', () => {
      const customDate = new Date(2024, 5, 15); // June 2024
      const { result } = renderHook(() => useTransition(), {
        wrapper: ({ children }) => (
          <TransitionProvider initialDate={customDate}>{children}</TransitionProvider>
        ),
      });

      expect(result.current.state.currentMonth).toBe('2024-06');
    });

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTransition());
      }).toThrow('useTransition must be used within a TransitionProvider');

      consoleError.mockRestore();
    });
  });

  describe('startTransition', () => {
    it('should set isTransitioning to true', () => {
      const { result } = renderHook(() => useTransition(), {
        wrapper: ({ children }) => <TransitionProvider>{children}</TransitionProvider>,
      });

      act(() => {
        result.current.startTransition(new Date(2024, 11, 1)); // December 2024
      });

      expect(result.current.state.isTransitioning).toBe(true);
      expect(result.current.isTransitioning).toBe(true);
    });

    it('should update currentMonth', () => {
      const { result } = renderHook(() => useTransition(), {
        wrapper: ({ children }) => <TransitionProvider>{children}</TransitionProvider>,
      });

      act(() => {
        result.current.startTransition(new Date(2024, 11, 1)); // December 2024
      });

      expect(result.current.state.currentMonth).toBe('2024-12');
    });

    it('should store previousData', () => {
      const { result } = renderHook(() => useTransition(), {
        wrapper: ({ children }) => <TransitionProvider>{children}</TransitionProvider>,
      });

      const previousData = { balance: 1000, income: 500 };

      act(() => {
        result.current.startTransition(new Date(2024, 11, 1), previousData);
      });

      expect(result.current.state.previousData).toEqual(previousData);
    });

    it('should clear previous timeout when called multiple times', () => {
      const { result } = renderHook(() => useTransition(), {
        wrapper: ({ children }) => <TransitionProvider>{children}</TransitionProvider>,
      });

      act(() => {
        result.current.startTransition(new Date(2024, 10, 1)); // November
      });

      act(() => {
        result.current.startTransition(new Date(2024, 11, 1)); // December
      });

      expect(result.current.state.currentMonth).toBe('2024-12');
      expect(result.current.state.isTransitioning).toBe(true);
    });
  });

  describe('endTransition', () => {
    it('should set isTransitioning to false', () => {
      const { result } = renderHook(() => useTransition(), {
        wrapper: ({ children }) => <TransitionProvider>{children}</TransitionProvider>,
      });

      act(() => {
        result.current.startTransition(new Date(2024, 11, 1));
      });

      expect(result.current.state.isTransitioning).toBe(true);

      act(() => {
        result.current.endTransition();
      });

      expect(result.current.state.isTransitioning).toBe(false);
      expect(result.current.isTransitioning).toBe(false);
    });

    it('should clear previousData', () => {
      const { result } = renderHook(() => useTransition(), {
        wrapper: ({ children }) => <TransitionProvider>{children}</TransitionProvider>,
      });

      const previousData = { balance: 1000 };

      act(() => {
        result.current.startTransition(new Date(2024, 11, 1), previousData);
      });

      expect(result.current.state.previousData).toEqual(previousData);

      act(() => {
        result.current.endTransition();
      });

      expect(result.current.state.previousData).toBeNull();
    });

    it('should maintain currentMonth after ending transition', () => {
      const { result } = renderHook(() => useTransition(), {
        wrapper: ({ children }) => <TransitionProvider>{children}</TransitionProvider>,
      });

      act(() => {
        result.current.startTransition(new Date(2024, 11, 1));
      });

      const monthBeforeEnd = result.current.state.currentMonth;

      act(() => {
        result.current.endTransition();
      });

      expect(result.current.state.currentMonth).toBe(monthBeforeEnd);
    });
  });

  describe('Transition timeout', () => {
    it('should auto-end transition after 5 seconds', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const { result } = renderHook(() => useTransition(), {
        wrapper: ({ children }) => <TransitionProvider>{children}</TransitionProvider>,
      });

      act(() => {
        result.current.startTransition(new Date(2024, 11, 1));
      });

      expect(result.current.state.isTransitioning).toBe(true);

      // Fast-forward 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.state.isTransitioning).toBe(false);
      expect(consoleWarn).toHaveBeenCalledWith('Transition timeout reached, forcing end transition');

      consoleWarn.mockRestore();
    });

    it('should not timeout if transition ends normally', () => {
      const { result } = renderHook(() => useTransition(), {
        wrapper: ({ children }) => <TransitionProvider>{children}</TransitionProvider>,
      });

      act(() => {
        result.current.startTransition(new Date(2024, 11, 1));
      });

      // End transition before timeout
      act(() => {
        vi.advanceTimersByTime(1000);
        result.current.endTransition();
      });

      expect(result.current.state.isTransitioning).toBe(false);

      // Advance past timeout
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should still be false, no double-end
      expect(result.current.state.isTransitioning).toBe(false);
    });
  });

  describe('Component coordination', () => {
    it('should share state across multiple consumers', () => {
      const Consumer1 = () => {
        const { state } = useTransition();
        return <div data-testid="consumer1">{state.isTransitioning ? 'transitioning' : 'idle'}</div>;
      };

      const Consumer2 = () => {
        const { state } = useTransition();
        return <div data-testid="consumer2">{state.currentMonth}</div>;
      };

      const { getByTestId } = render(
        <TransitionProvider initialDate={new Date(2024, 5, 1)}>
          <Consumer1 />
          <Consumer2 />
        </TransitionProvider>
      );

      expect(getByTestId('consumer1').textContent).toBe('idle');
      expect(getByTestId('consumer2').textContent).toBe('2024-06');
    });

    it('should update all consumers when transition starts', () => {
      let triggerTransition: ((date: Date) => void) | null = null;

      const Controller = () => {
        const { startTransition } = useTransition();
        triggerTransition = startTransition;
        return null;
      };

      const Consumer = () => {
        const { state } = useTransition();
        return <div data-testid="status">{state.isTransitioning ? 'transitioning' : 'idle'}</div>;
      };

      const { getByTestId } = render(
        <TransitionProvider>
          <Controller />
          <Consumer />
        </TransitionProvider>
      );

      expect(getByTestId('status').textContent).toBe('idle');

      act(() => {
        triggerTransition?.(new Date(2024, 11, 1));
      });

      expect(getByTestId('status').textContent).toBe('transitioning');
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid transition calls', () => {
      const { result } = renderHook(() => useTransition(), {
        wrapper: ({ children }) => <TransitionProvider>{children}</TransitionProvider>,
      });

      act(() => {
        result.current.startTransition(new Date(2024, 0, 1)); // January
        result.current.startTransition(new Date(2024, 1, 1)); // February
        result.current.startTransition(new Date(2024, 2, 1)); // March
      });

      // Should only reflect the last transition
      expect(result.current.state.currentMonth).toBe('2024-03');
      expect(result.current.state.isTransitioning).toBe(true);
    });

    it('should handle endTransition called without startTransition', () => {
      const { result } = renderHook(() => useTransition(), {
        wrapper: ({ children }) => <TransitionProvider>{children}</TransitionProvider>,
      });

      // Should not throw
      expect(() => {
        act(() => {
          result.current.endTransition();
        });
      }).not.toThrow();

      expect(result.current.state.isTransitioning).toBe(false);
    });
  });
});
