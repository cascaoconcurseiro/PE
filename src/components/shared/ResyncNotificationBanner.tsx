/**
 * ResyncNotificationBanner - Banner para mostrar oportunidades de ressincronização
 * 
 * Exibe quando há usuários que podem ser readicionados após factory reset
 */

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { UserPlus, Users, MapPin, X, RefreshCw } from 'lucide-react';
import { useResyncNotifications, ResyncOpportunity } from '../../hooks/useResyncNotifications';
import { useToast } from '../ui/Toast';
import { Modal } from '../ui/Modal';

interface ResyncNotificationBannerProps {
  currentUserId?: string;
  onResyncComplete?: () => void;
}

export const ResyncNotificationBanner: React.FC<ResyncNotificationBannerProps> = ({
  currentUserId,
  onResyncComplete
}) => {
  const { addToast } = useToast();
  const {
    resyncOpportunities,
    isLoading,
    addUserBackToFamily,
    addUserBackToTrip,
    checkResyncOpportunities
  } = useResyncNotifications(currentUserId);

  const [selectedOpportunity, setSelectedOpportunity] = useState<ResyncOpportunity | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dismissedOpportunities, setDismissedOpportunities] = useState<Set<string>>(new Set());

  // Filtrar oportunidades não dispensadas
  const visibleOpportunities = resyncOpportunities.filter(
    opp => !dismissedOpportunities.has(opp.userId)
  );

  const handleAddBackToFamily = async (opportunity: ResyncOpportunity) => {
    setIsProcessing(true);
    try {
      const result = await addUserBackToFamily(opportunity.userId, 'Grupo Familiar');
      
      if (result.success) {
        addToast(`${opportunity.userName} foi readicionado ao grupo familiar e seus dados foram sincronizados!`, 'success');
        setSelectedOpportunity(null);
        onResyncComplete?.();
        await checkResyncOpportunities();
      } else {
        addToast(`Erro ao readicionar ${opportunity.userName}: ${result.error}`, 'error');
      }
    } catch (error) {
      addToast(`Erro inesperado: ${error}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddBackToTrip = async (opportunity: ResyncOpportunity, tripId: string) => {
    setIsProcessing(true);
    try {
      const result = await addUserBackToTrip(opportunity.userId, tripId);
      
      if (result.success) {
        addToast(`${opportunity.userName} foi readicionado à viagem e seus dados foram sincronizados!`, 'success');
        setSelectedOpportunity(null);
        onResyncComplete?.();
        await checkResyncOpportunities();
      } else {
        addToast(`Erro ao readicionar ${opportunity.userName}: ${result.error}`, 'error');
      }
    } catch (error) {
      addToast(`Erro inesperado: ${error}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = (userId: string) => {
    setDismissedOpportunities(prev => new Set([...prev, userId]));
  };

  if (isLoading || visibleOpportunities.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="p-4 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <UserPlus className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">
              Usuários Disponíveis para Ressincronização
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
              {visibleOpportunities.length} usuário(s) que fizeram reset do sistema podem ser readicionados aos seus grupos.
            </p>
            
            <div className="space-y-3">
              {visibleOpportunities.map((opportunity) => (
                <div key={opportunity.userId} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {opportunity.userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">
                        {opportunity.userName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Saiu em {new Date(opportunity.exitTimestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setSelectedOpportunity(opportunity)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Readicionar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDismiss(opportunity.userId)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Modal de Ressincronização */}
      <Modal
        isOpen={!!selectedOpportunity}
        onClose={() => setSelectedOpportunity(null)}
        title={`Readicionar ${selectedOpportunity?.userName}`}
      >
        {selectedOpportunity && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3 mb-3">
                <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h4 className="font-bold text-blue-800 dark:text-blue-300">
                  Ressincronização Automática
                </h4>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Quando você readicionar {selectedOpportunity.userName}, todos os dados compartilhados 
                serão automaticamente sincronizados. Isso inclui transações, viagens e configurações de grupo.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-slate-800 dark:text-white">
                Escolha como readicionar:
              </h4>

              <Button
                onClick={() => handleAddBackToFamily(selectedOpportunity)}
                disabled={isProcessing}
                className="w-full justify-start gap-3 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Users className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Adicionar ao Grupo Familiar</div>
                  <div className="text-sm opacity-90">
                    Readicionar como membro da família
                  </div>
                </div>
                {isProcessing && <RefreshCw className="w-4 h-4 animate-spin ml-auto" />}
              </Button>

              {selectedOpportunity.availableGroups
                .filter(group => group.type === 'TRIP')
                .map((trip) => (
                <Button
                  key={trip.id}
                  onClick={() => handleAddBackToTrip(selectedOpportunity, trip.id)}
                  disabled={isProcessing}
                  variant="secondary"
                  className="w-full justify-start gap-3"
                >
                  <MapPin className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">Adicionar à Viagem</div>
                    <div className="text-sm opacity-70">
                      {trip.name}
                    </div>
                  </div>
                  {isProcessing && <RefreshCw className="w-4 h-4 animate-spin ml-auto" />}
                </Button>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="secondary"
                onClick={() => setSelectedOpportunity(null)}
                className="flex-1"
                disabled={isProcessing}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};