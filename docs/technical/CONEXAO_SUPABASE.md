# Status da Conexão com Supabase

## Arquitetura Atual: **Híbrida / Cloud Sync**

O sistema evoluiu de uma arquitetura puramente local para uma arquitetura conectada à nuvem (Supabase), mantendo a performance local.

### Como funciona a conexão:

1.  **Autenticação:**
    *   Gerenciada pelo Supabase Auth.
    *   Usuários fazem login para acessar seus dados específicos.

2.  **Dados Financeiros (Sincronização):**
    *   **Leitura:** Ao iniciar, o app busca os dados mais recentes do Supabase (`hooks/useDataStore.ts`).
    *   **Escrita:** As operações (criar, editar, excluir) são enviadas para o Supabase através do `services/supabaseService.ts`.
    *   **Tabelas:** O banco de dados possui 18 tabelas principais, incluindo:
        *   `transactions`, `accounts`, `assets`
        *   `budgets`, `goals`, `trips`
        *   `family_members`, `profiles`
        *   `snapshots`, `audit_logs`, `custom_categories`
        *   Tabelas auxiliares (`credit_cards`, `invoices`, etc.)

### Segurança e Privacidade
*   **Row Level Security (RLS):** O banco de dados está configurado para que cada usuário só possa ler e editar seus próprios dados. Mesmo com 18 tabelas compartilhadas, seus dados estão isolados.

### Backup
*   Embora os dados estejam na nuvem, o sistema ainda mantém funcionalidades de backup local (`services/backupService.ts`) como uma camada extra de segurança e para facilitar migrações ou cópias de segurança pessoais.