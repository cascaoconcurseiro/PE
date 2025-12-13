# ARQUITETURA DE SINCRONIZAÇÃO FINANCEIRA (MOTOR COMPARTILHADO)

Este documento define o contrato técnico e as regras de segurança para o sistema de espelhamento de transações.

## 1. Princípios Absolutos ("No Loopholes")

### 1.1 Segurança e RLS
- Todas as funções de escrita cross-tenant usam `SECURITY DEFINER`.
- `SET search_path = public` é obrigatório para evitar sequestro de sessão.

### 1.2 Esterilidade (Loop Breaker)
- Transações "Sombra" (que possuem `mirror_transaction_id`) são estéreis.
- Elas **NUNCA** disparam gatilhos para criar novas sombras.
- Isso previne loops infinitos (A -> B -> A).

### 1.3 Isolamento Financeiro
- A transação sombra tem `account_id = NULL`.
- O usuário B não tem acesso à conta bancária do Usuário A.
- O campo `is_settled` (Pago) não é sincronizado. Cada um baixa a sua.

### 1.4 Auditoria e Recuperação (Section 4)
- **Log de Sistema**: Tabela `system_logs` registra erros críticos e eventos de auditoria.
- **Ferramenta de Reprocessamento**: Função `rebuild_mirrored_transactions(user_id)` permite forçar a recriação de sombras caso algo dê errado ou seja apagado acidentalmente.


## 2. Ciclo de Vida de Conexão (Smart Lifecycle)

### 2.1 Auto-Conexão (Onboarding)
- Quando A adiciona B (email): 
  - O sistema verifica se B existe.
  - Se sim, o sistema **CRIA AUTOMATICAMENTE** o registro de A na lista de B.
  - Vínculo bidirecional imediato.

### 2.2 Deduplicação (Smart Match)
- Se B já tinha A cadastrado apenas por e-mail (sem link), o sistema faz UPDATE e conecta, em vez de criar duplicata.

### 2.3 Bloqueio (Offboarding)
- Se B bloquear A (`connection_status = 'BLOCKED'`), qualquer tentativa de A compartilhar algo gera um **ERRO EXPLÍCITO** na tela. Nada de falha silenciosa.

## 3. Checklist de QA (Testes Humanos)

Executar antes de liberar para produção:

- [ ] **Teste de Criação**: Criar despesa compartilhada. Verificar se apareceu na conta destino.
- [ ] **Teste de Valor**: O valor e a moeda devem estar idênticos.
- [ ] **Teste de Edição**: Editar a original. A sombra deve atualizar.
- [ ] **Teste de Exclusão**: Apagar a original. A sombra deve sumir.
- [ ] **Teste de Proibição**: Tentar editar o VALOR da sombra na conta destino. Deve ser ignorado ou bloqueado.
- [ ] **Teste de Bloqueio**: Bloquear usuário na tabela `family_members`. Tentar compartilhar. Deve dar erro vermelho.

---
*Gerado automaticamente pelo Assistente de Arquitetura em 13/12/2025.*
