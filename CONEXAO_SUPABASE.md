# Análise da Conexão com Supabase

## Arquitetura Atual
Após analisar todo o código do sistema, confirmo que a arquitetura atual é **Local-First (Armazenamento Local)**.

### Como funciona a conexão:
1.  **Autenticação (Login/Senha):**
    *   O sistema conecta ao **Supabase** apenas para verificar seu e-mail e senha.
    *   Arquivos envolvidos: `components/Auth.tsx` e `index.tsx`.
    *   Isso garante que apenas você entre no app.

2.  **Dados Financeiros (Transações, Contas, etc.):**
    *   **NÃO** são enviados para o Supabase.
    *   São salvos exclusivamente no **banco de dados interno do seu navegador** (chamado IndexedDB, gerenciado pela biblioteca Dexie.js).
    *   Arquivos envolvidos: `services/db.ts` e `hooks/useDataStore.ts`.

## O que isso significa para você?
*   **Velocidade:** O sistema é extremamente rápido porque não precisa esperar a internet para salvar ou ler dados.
*   **Privacidade:** Seus dados financeiros não saem do seu dispositivo.
*   **Backup:** Como os dados estão apenas no seu computador/celular, é **CRUCIAL** usar a função de "Exportar Backup" regularmente em Configurações, especialmente antes de limpar dados de navegação.
*   **Sincronização:** Se você abrir o sistema em outro celular ou computador, os dados **NÃO** estarão lá automaticamente. Você precisaria restaurar um backup manualmente.

## Sobre a exclusão de itens
Como o banco de dados é local, quando você exclui uma transação, ela é marcada como deletada instantaneamente no seu dispositivo. Se você notar que algo não sumiu dos relatórios:
1.  Verifique se não é uma transação parcelada (onde você excluiu apenas uma parcela e não a série toda).
2.  Tente recarregar a página (F5), pois pode ser apenas uma questão visual momentânea.
