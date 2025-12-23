/**
 * SharedDataExitManager - Gerencia saída automática de dados compartilhados durante reset
 * 
 * Este serviço coordena a saída do usuário de:
 * - Viagens compartilhadas
 * - Grupos familiares
 * - Notifica outros usuários sobre a saída
 * - Prepara dados para ressincronização futura
 */

import { supabase } from '../../integrations/supabase/client'

export interface SharedDataExitResult {
  success: boolean
  tripsExited: number
  familyGroupsExited: number
  notificationsSent: number
  errors: string[]
  exitedData: {
    trips: Array<{
      id: string
      name: string
      participants: string[]
    }>
    familyGroups: Array<{
      id: string
      name: string
      members: string[]
    }>
  }
}

export interface ExitNotification {
  type: 'TRIP_EXIT' | 'FAMILY_EXIT'
  targetUserId: string
  message: string
  metadata: Record<string, any>
}

export class SharedDataExitManager {
  /**
   * Executa saída completa de todos os dados compartilhados
   */
  async exitAllSharedData(userId: string): Promise<SharedDataExitResult> {
    const result: SharedDataExitResult = {
      success: false,
      tripsExited: 0,
      familyGroupsExited: 0,
      notificationsSent: 0,
      errors: [],
      exitedData: {
        trips: [],
        familyGroups: []
      }
    }

    try {
      // 1. Sair de viagens compartilhadas
      const tripExitResult = await this.exitSharedTrips(userId)
      result.tripsExited = tripExitResult.tripsExited
      result.exitedData.trips = tripExitResult.exitedTrips
      result.errors.push(...tripExitResult.errors)

      // 2. Sair de grupos familiares
      const familyExitResult = await this.exitFamilyGroups(userId)
      result.familyGroupsExited = familyExitResult.groupsExited
      result.exitedData.familyGroups = familyExitResult.exitedGroups
      result.errors.push(...familyExitResult.errors)

      // 3. Enviar notificações para outros usuários
      const notifications = await this.generateExitNotifications(userId, result.exitedData)
      const notificationResult = await this.sendExitNotifications(notifications)
      result.notificationsSent = notificationResult.sent
      result.errors.push(...notificationResult.errors)

      // 4. Criar registros de ressincronização
      await this.createResyncRecords(userId, result.exitedData)

      result.success = result.errors.length === 0
      return result

    } catch (error) {
      result.errors.push(`Erro geral na saída de dados compartilhados: ${error}`)
      return result
    }
  }

  /**
   * Remove usuário de todas as viagens compartilhadas
   */
  private async exitSharedTrips(userId: string) {
    try {
      const { data, error } = await supabase.rpc('exit_user_from_shared_trips', {
        target_user_id: userId
      })

      if (error) {
        throw new Error(`Erro ao sair de viagens: ${error.message}`)
      }

      return {
        tripsExited: data?.trips_exited || 0,
        exitedTrips: data?.exited_trips || [],
        errors: []
      }
    } catch (error) {
      return {
        tripsExited: 0,
        exitedTrips: [],
        errors: [`Erro ao sair de viagens: ${error}`]
      }
    }
  }

  /**
   * Remove usuário de todos os grupos familiares
   */
  private async exitFamilyGroups(userId: string) {
    try {
      const { data, error } = await supabase.rpc('exit_user_from_family_groups', {
        target_user_id: userId
      })

      if (error) {
        throw new Error(`Erro ao sair de grupos familiares: ${error.message}`)
      }

      return {
        groupsExited: data?.groups_exited || 0,
        exitedGroups: data?.exited_groups || [],
        errors: []
      }
    } catch (error) {
      return {
        groupsExited: 0,
        exitedGroups: [],
        errors: [`Erro ao sair de grupos familiares: ${error}`]
      }
    }
  }

  /**
   * Gera notificações para outros usuários sobre a saída
   */
  private async generateExitNotifications(
    userId: string, 
    exitedData: SharedDataExitResult['exitedData']
  ): Promise<ExitNotification[]> {
    const notifications: ExitNotification[] = []

    try {
      // Obter nome do usuário que está saindo
      const { data: userData } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single()

      const userName = userData?.full_name || userData?.email || 'Usuário'

      // Notificações para viagens
      for (const trip of exitedData.trips) {
        for (const participantId of trip.participants) {
          if (participantId !== userId) {
            notifications.push({
              type: 'TRIP_EXIT',
              targetUserId: participantId,
              message: `${userName} saiu da viagem "${trip.name}" devido a um reset do sistema.`,
              metadata: {
                tripId: trip.id,
                tripName: trip.name,
                exitedUserId: userId,
                exitedUserName: userName,
                canReinvite: true
              }
            })
          }
        }
      }

      // Notificações para grupos familiares
      for (const group of exitedData.familyGroups) {
        for (const memberId of group.members) {
          if (memberId !== userId) {
            notifications.push({
              type: 'FAMILY_EXIT',
              targetUserId: memberId,
              message: `${userName} saiu do grupo familiar "${group.name}" devido a um reset do sistema. Você pode readicioná-lo quando desejar.`,
              metadata: {
                groupId: group.id,
                groupName: group.name,
                exitedUserId: userId,
                exitedUserName: userName,
                canReinvite: true,
                willResync: true
              }
            })
          }
        }
      }

      return notifications

    } catch (error) {
      console.error('Erro ao gerar notificações de saída:', error)
      return []
    }
  }

  /**
   * Envia notificações para outros usuários
   */
  private async sendExitNotifications(notifications: ExitNotification[]) {
    let sent = 0
    const errors: string[] = []

    for (const notification of notifications) {
      try {
        const { error } = await supabase
          .from('user_notifications')
          .insert({
            user_id: notification.targetUserId,
            type: notification.type,
            title: notification.type === 'TRIP_EXIT' ? 'Usuário saiu da viagem' : 'Usuário saiu do grupo familiar',
            message: notification.message,
            metadata: notification.metadata,
            is_read: false
          })

        if (error) {
          errors.push(`Erro ao enviar notificação para ${notification.targetUserId}: ${error.message}`)
        } else {
          sent++
        }
      } catch (error) {
        errors.push(`Erro ao processar notificação: ${error}`)
      }
    }

    return { sent, errors }
  }

  /**
   * Cria registros para ressincronização futura
   */
  private async createResyncRecords(
    userId: string, 
    exitedData: SharedDataExitResult['exitedData']
  ) {
    try {
      const resyncData = {
        user_id: userId,
        exited_trips: exitedData.trips,
        exited_family_groups: exitedData.familyGroups,
        exit_timestamp: new Date().toISOString(),
        can_resync: true
      }

      const { error } = await supabase
        .from('user_resync_records')
        .insert(resyncData)

      if (error) {
        console.error('Erro ao criar registros de ressincronização:', error)
      }
    } catch (error) {
      console.error('Erro ao processar registros de ressincronização:', error)
    }
  }

  /**
   * Verifica se usuário pode ser readicionado a grupos/viagens
   */
  async canResyncWithUser(currentUserId: string, targetUserId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_resync_records')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('can_resync', true)
        .order('exit_timestamp', { ascending: false })
        .limit(1)

      if (error || !data || data.length === 0) {
        return false
      }

      // Verificar se o usuário atual estava nos grupos/viagens que o target saiu
      const resyncRecord = data[0]
      const wasInTrips = resyncRecord.exited_trips?.some((trip: any) => 
        trip.participants?.includes(currentUserId)
      )
      const wasInFamilyGroups = resyncRecord.exited_family_groups?.some((group: any) => 
        group.members?.includes(currentUserId)
      )

      return wasInTrips || wasInFamilyGroups
    } catch (error) {
      console.error('Erro ao verificar possibilidade de ressincronização:', error)
      return false
    }
  }

  /**
   * Executa ressincronização quando usuário é readicionado
   */
  async executeResync(targetUserId: string, groupType: 'TRIP' | 'FAMILY', groupId: string) {
    try {
      const { error } = await supabase.rpc('execute_user_resync', {
        target_user_id: targetUserId,
        group_type: groupType,
        group_id: groupId
      })

      if (error) {
        throw new Error(`Erro na ressincronização: ${error.message}`)
      }

      // Notificar usuário sobre ressincronização bem-sucedida
      await supabase
        .from('user_notifications')
        .insert({
          user_id: targetUserId,
          type: 'RESYNC_SUCCESS',
          title: 'Dados sincronizados',
          message: `Seus dados foram ressincronizados com sucesso após ser readicionado ao ${groupType === 'TRIP' ? 'viagem' : 'grupo familiar'}.`,
          metadata: { groupType, groupId },
          is_read: false
        })

      return { success: true }
    } catch (error) {
      console.error('Erro na ressincronização:', error)
      return { success: false, error: error.toString() }
    }
  }
}

export const sharedDataExitManager = new SharedDataExitManager()