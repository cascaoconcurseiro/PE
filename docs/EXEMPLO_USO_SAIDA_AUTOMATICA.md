# Exemplo de Uso: Sistema de Saída Automática

## Cenário 1: Usuário Faz Factory Reset

### Situação Inicial
- João está em um grupo familiar com Maria
- João participa de uma viagem "Férias 2024" com Maria e Pedro
- João tem 50 transações compartilhadas

### Ação: João Faz Factory Reset

```typescript
// No componente Settings, quando João clica em "Resetar Tudo"
const handleFactoryReset = async (unlinkFamily: boolean) => {
  // O sistema automaticamente:
  // 1. Remove João de todas as viagens
  // 2. Remove João do grupo familiar
  // 3. Notifica Maria e Pedro
  // 4. Cria registros de ressincronização
  // 5. Limpa os dados de João
  
  await supabaseService.performSmartReset(unlinkFamily);
};
```

### Resultado

**Para João:**
- ✅ Todos os dados foram apagados
- ✅ Saiu automaticamente de todas as viagens
- ✅ Saiu do grupo familiar
- ✅ Pode ser readicionado depois

**Para Maria:**
- 📧 Recebe notificação: "João saiu da viagem 'Férias 2024' devido a um reset do sistema."
- 📧 Recebe notificação: "João saiu do grupo familiar devido a um reset do sistema. Você pode readicioná-lo quando desejar."
- 👁️ Vê banner na tela de Compartilhados oferecendo readicionar João

**Para Pedro:**
- 📧 Recebe notificação: "João saiu da viagem 'Férias 2024' devido a um reset do sistema."

## Cenário 2: Readicionar Usuário ao Grupo Familiar

### Situação
- Maria vê o banner de ressincronização
- Banner mostra: "João - Saiu em 21/12/2024"

### Ação: Maria Readiciona João

```typescript
// Maria clica em "Readicionar" no banner
// Escolhe "Adicionar ao Grupo Familiar"

const handleAddBackToFamily = async () => {
  const result = await addUserBackToFamily(joaoUserId, 'Grupo Familiar');
  
  if (result.success) {
    // ✅ João foi readicionado
    // ✅ Dados foram sincronizados automaticamente
    // ✅ João recebe notificação de sucesso
  }
};
```

### Resultado

**Para João:**
- ✅ Está de volta ao grupo familiar
- ✅ Todas as transações compartilhadas foram restauradas
- ✅ Configurações de grupo aplicadas
- 📧 Recebe notificação: "Seus dados foram ressincronizados com sucesso após ser readicionado ao grupo familiar."

**Para Maria:**
- ✅ João aparece novamente na lista de membros
- ✅ Pode ver as transações compartilhadas com João
- ✅ Banner de ressincronização desaparece

## Cenário 3: Readicionar Usuário a uma Viagem

### Situação
- Pedro vê o banner de ressincronização
- Banner mostra: "João - Saiu em 21/12/2024"
- Pedro tem a viagem "Férias 2024" ativa

### Ação: Pedro Readiciona João à Viagem

```typescript
// Pedro clica em "Readicionar" no banner
// Escolhe "Adicionar à Viagem: Férias 2024"

const handleAddBackToTrip = async () => {
  const result = await addUserBackToTrip(joaoUserId, 'trip-id-123');
  
  if (result.success) {
    // ✅ João foi readicionado à viagem
    // ✅ Transações da viagem foram sincronizadas
    // ✅ João recebe notificação de sucesso
  }
};
```

### Resultado

**Para João:**
- ✅ Está de volta à viagem "Férias 2024"
- ✅ Todas as transações da viagem foram restauradas
- ✅ Pode ver e adicionar novas transações
- 📧 Recebe notificação: "Seus dados foram ressincronizados com sucesso após ser readicionado à viagem."

**Para Pedro:**
- ✅ João aparece novamente na lista de participantes
- ✅ Pode ver as transações compartilhadas com João na viagem
- ✅ Banner de ressincronização desaparece

## Cenário 4: Verificar Oportunidades de Ressincronização

### Código de Exemplo

```typescript
import { useResyncNotifications } from '../hooks/useResyncNotifications';

function SharedComponent() {
  const {
    resyncOpportunities,
    isLoading,
    canResyncWithUser,
    addUserBackToFamily,
    addUserBackToTrip
  } = useResyncNotifications(currentUserId);

  // Verificar se há oportunidades
  useEffect(() => {
    if (resyncOpportunities.length > 0) {
      console.log('Usuários disponíveis para ressincronização:', resyncOpportunities);
    }
  }, [resyncOpportunities]);

  // Verificar se pode ressincronizar com usuário específico
  const checkUser = async (targetUserId: string) => {
    const canResync = await canResyncWithUser(targetUserId);
    console.log('Pode ressincronizar?', canResync);
  };

  return (
    <div>
      {resyncOpportunities.map(opportunity => (
        <div key={opportunity.userId}>
          <h3>{opportunity.userName}</h3>
          <p>Saiu em: {new Date(opportunity.exitTimestamp).toLocaleDateString()}</p>
          <button onClick={() => addUserBackToFamily(opportunity.userId)}>
            Readicionar ao Grupo Familiar
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Cenário 5: Notificações Personalizadas

### Tipos de Notificações

#### 1. Notificação de Saída de Viagem
```json
{
  "type": "TRIP_EXIT",
  "title": "Usuário saiu da viagem",
  "message": "João saiu da viagem 'Férias 2024' devido a um reset do sistema.",
  "metadata": {
    "tripId": "trip-id-123",
    "tripName": "Férias 2024",
    "exitedUserId": "user-id-456",
    "exitedUserName": "João",
    "canReinvite": true
  }
}
```

#### 2. Notificação de Saída de Grupo Familiar
```json
{
  "type": "FAMILY_EXIT",
  "title": "Usuário saiu do grupo familiar",
  "message": "João saiu do grupo familiar 'Família Silva' devido a um reset do sistema. Você pode readicioná-lo quando desejar.",
  "metadata": {
    "groupId": "family-id-789",
    "groupName": "Família Silva",
    "exitedUserId": "user-id-456",
    "exitedUserName": "João",
    "canReinvite": true,
    "willResync": true
  }
}
```

#### 3. Notificação de Ressincronização Bem-Sucedida
```json
{
  "type": "RESYNC_SUCCESS",
  "title": "Dados sincronizados",
  "message": "Seus dados foram ressincronizados com sucesso após ser readicionado ao grupo familiar.",
  "metadata": {
    "groupType": "FAMILY",
    "groupId": "family-id-789"
  }
}
```

## Cenário 6: Tratamento de Erros

### Erro: Usuário Não Pode Ser Ressincronizado

```typescript
const handleResync = async (userId: string) => {
  try {
    const result = await addUserBackToFamily(userId);
    
    if (!result.success) {
      // Mostrar erro para o usuário
      showToast(`Erro ao readicionar usuário: ${result.error}`, 'error');
    }
  } catch (error) {
    // Erro inesperado
    showToast('Erro inesperado ao ressincronizar', 'error');
    console.error(error);
  }
};
```

### Erro: Registro de Ressincronização Não Encontrado

```typescript
// O sistema verifica automaticamente
const canResync = await canResyncWithUser(targetUserId);

if (!canResync) {
  showToast('Este usuário não pode ser ressincronizado no momento', 'warning');
  return;
}
```

## Cenário 7: Interface do Usuário

### Banner de Ressincronização

```tsx
<ResyncNotificationBanner 
  currentUserId={currentUserId}
  onResyncComplete={() => {
    // Recarregar dados após ressincronização
    window.location.reload();
  }}
/>
```

### Modal de Confirmação

```tsx
<Modal
  isOpen={showResyncModal}
  onClose={() => setShowResyncModal(false)}
  title="Readicionar João"
>
  <div>
    <p>Quando você readicionar João, todos os dados compartilhados serão automaticamente sincronizados.</p>
    
    <Button onClick={() => handleAddBackToFamily(joaoUserId)}>
      Adicionar ao Grupo Familiar
    </Button>
    
    <Button onClick={() => handleAddBackToTrip(joaoUserId, tripId)}>
      Adicionar à Viagem
    </Button>
  </div>
</Modal>
```

## Boas Práticas

### 1. Sempre Verificar Possibilidade de Ressincronização
```typescript
const canResync = await canResyncWithUser(targetUserId);
if (!canResync) {
  return; // Não mostrar opção de ressincronização
}
```

### 2. Fornecer Feedback Visual
```typescript
const [isProcessing, setIsProcessing] = useState(false);

const handleResync = async () => {
  setIsProcessing(true);
  try {
    await addUserBackToFamily(userId);
    showToast('Usuário readicionado com sucesso!', 'success');
  } finally {
    setIsProcessing(false);
  }
};
```

### 3. Recarregar Dados Após Ressincronização
```typescript
const handleResyncComplete = async () => {
  // Recarregar dados
  await fetchTransactions();
  await fetchFamilyMembers();
  await checkResyncOpportunities();
};
```

---

**Dica:** Use o hook `useResyncNotifications` para gerenciar todas as operações de ressincronização de forma consistente em toda a aplicação.