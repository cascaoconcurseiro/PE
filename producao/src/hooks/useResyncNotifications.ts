/**
 * useResyncNotifications - Hook para gerenciar notificações de ressincronização
 * 
 * Detecta quando um usuário pode ser ressincronizado após factory reset
 * e oferece funcionalidades para readicionar usuários a grupos/viagens
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { sharedDataExitManager } from '../services/factory-reset/SharedDataExitManager';
import { logger } from '../services/logger';

export interface ResyncOpportunity {
  userId: string;
  userName: string;
  userEmail: string;
  canResync: boolean;
  exitTimestamp: string;
  availableGroups: Array<{
    type: 'TRIP' | 'FAMILY';
    id: string;
    name: string;
  }>;
}

export const useResyncNotifications = (currentUserId?: string) => {
  const [resyncOpportunities, setResyncOpportunities] = useState<ResyncOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Verifica se há usuários que podem ser ressincronizados
   */
  const checkResyncOpportunities = useCallback(async () => {
    if (!currentUserId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_resync_opportunities', {
        current_user_id: currentUserId
      });

      if (error) {
        logger.error('Erro ao verificar oportunidades de ressincronização:', error);
        return;
      }

      if (data && data.length > 0) {
        const opportunities: ResyncOpportunity[] = data.map((item: any) => ({
          userId: item.user_id,
          userName: item.user_name,
          userEmail: item.user_email,
          canResync: item.can_resync,
          exitTimestamp: item.exit_timestamp,
          availableGroups: item.available_groups || []
        }));

        setResyncOpportunities(opportunities);
      }
    } catch (error) {
      logger.error('Erro ao processar oportunidades de ressincronização:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  /**
   * Executa ressincronização para um usuário específico
   */
  const executeResync = useCallback(async (
    targetUserId: string, 
    groupType: 'TRIP' | 'FAMILY', 
    groupId: string
  ) => {
    try {
      const result = await sharedDataExitManager.executeResync(targetUserId, groupType, groupId);
      
      if (result.success) {
        // Remover da lista de oportunidades
        setResyncOpportunities(prev => 
          prev.filter(opp => opp.userId !== targetUserId)
        );
        
        // Recarregar oportunidades
        await checkResyncOpportunities();
        
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error('Erro ao executar ressincronização:', error);
      return { success: false, error: error.toString() };
    }
  }, [checkResyncOpportunities]);

  /**
   * Verifica se um usuário específico pode ser ressincronizado
   */
  const canResyncWithUser = useCallback(async (targetUserId: string): Promise<boolean> => {
    if (!currentUserId) return false;
    
    try {
      return await sharedDataExitManager.canResyncWithUser(currentUserId, targetUserId);
    } catch (error) {
      logger.error('Erro ao verificar possibilidade de ressincronização:', error);
      return false;
    }
  }, [currentUserId]);

  /**
   * Adiciona usuário de volta a um grupo familiar
   */
  const addUserBackToFamily = useCallback(async (targetUserId: string, familyGroupName?: string) => {
    try {
      // Primeiro, adicionar o usuário de volta ao grupo familiar
      const { error: addError } = await supabase
        .from('family_members')
        .insert({
          user_id: currentUserId,
          invited_user_id: targetUserId,
          name: familyGroupName || 'Grupo Familiar',
          role: 'member'
        });

      if (addError) {
        throw new Error(`Erro ao adicionar usuário ao grupo familiar: ${addError.message}`);
      }

      // Executar ressincronização
      const resyncResult = await executeResync(targetUserId, 'FAMILY', 'default');
      
      return resyncResult;
    } catch (error) {
      logger.error('Erro ao adicionar usuário de volta ao grupo familiar:', error);
      return { success: false, error: error.toString() };
    }
  }, [currentUserId, executeResync]);

  /**
   * Adiciona usuário de volta a uma viagem
   */
  const addUserBackToTrip = useCallback(async (targetUserId: string, tripId: string) => {
    try {
      // Verificar se a viagem ainda existe
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError || !trip) {
        throw new Error('Viagem não encontrada');
      }

      // Criar uma transação compartilhada na viagem para readicionar o usuário
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: targetUserId,
          trip_id: tripId,
          description: 'Readicionado à viagem',
          amount: 0,
          type: 'EXPENSE',
          category: 'Outros',
          date: new Date().toISOString().split('T')[0],
          deleted: false
        });

      if (transactionError) {
        throw new Error(`Erro ao readicionar usuário à viagem: ${transactionError.message}`);
      }

      // Executar ressincronização
      const resyncResult = await executeResync(targetUserId, 'TRIP', tripId);
      
      return resyncResult;
    } catch (error) {
      logger.error('Erro ao adicionar usuário de volta à viagem:', error);
      return { success: false, error: error.toString() };
    }
  }, [executeResync]);

  // Verificar oportunidades ao montar o componente
  useEffect(() => {
    if (currentUserId) {
      checkResyncOpportunities();
    }
  }, [currentUserId, checkResyncOpportunities]);

  return {
    resyncOpportunities,
    isLoading,
    checkResyncOpportunities,
    executeResync,
    canResyncWithUser,
    addUserBackToFamily,
    addUserBackToTrip
  };
};