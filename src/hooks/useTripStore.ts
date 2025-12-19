/**
 * Hook para gerenciamento de viagens
 * Extraído do useDataStore para melhor separação de responsabilidades
 */

import { useState, useCallback } from 'react';
import { Trip } from '../types';
import { supabaseService } from '../services/supabaseService';
import { logger } from '../services/logger';

interface UseTripStoreProps {
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
    isOnline: boolean;
}

export const useTripStore = ({ onSuccess, onError, isOnline }: UseTripStoreProps) => {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchTrips = useCallback(async () => {
        try {
            const data = await supabaseService.getTrips();
            setTrips(data);
            return data;
        } catch (error) {
            logger.error('Erro ao carregar viagens', error);
            throw error;
        }
    }, []);

    const addTrip = useCallback(async (trip: Omit<Trip, 'id'>) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            await supabaseService.create('trips', { id: crypto.randomUUID(), ...trip });
            await fetchTrips();
            onSuccess('Viagem criada!');
        } catch (error) {
            logger.error('Erro ao criar viagem', error);
            onError((error as Error).message || 'Erro ao criar viagem');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, fetchTrips, onSuccess, onError]);

    const updateTrip = useCallback(async (trip: Trip) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            await supabaseService.update('trips', trip);
            setTrips(prev => prev.map(t => t.id === trip.id ? trip : t));
            onSuccess('Viagem atualizada!');
        } catch (error) {
            logger.error('Erro ao atualizar viagem', error);
            onError((error as Error).message || 'Erro ao atualizar viagem');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, onSuccess, onError]);

    const deleteTrip = useCallback(async (id: string, setTransactions?: React.Dispatch<React.SetStateAction<any[]>>) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            await supabaseService.deleteTripCascade(id);
            setTrips(prev => prev.filter(t => t.id !== id));
            
            // Remover transações vinculadas à viagem
            if (setTransactions) {
                setTransactions(prev => prev.filter(t => t.tripId !== id));
            }
            
            onSuccess('Viagem e despesas excluídas.');
        } catch (error) {
            logger.error('Erro ao excluir viagem', error);
            onError((error as Error).message || 'Erro ao excluir viagem');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, onSuccess, onError]);

    return {
        trips,
        setTrips,
        isLoading,
        fetchTrips,
        addTrip,
        updateTrip,
        deleteTrip
    };
};
