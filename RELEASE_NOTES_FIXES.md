# Atualizações Críticas Realizadas

## 1. Saldo Bancário Histórico (Banking)
**Problema:** "Eu mudo o mês na conta e não muda o saldo."
**Solução:** Implementei uma nova função `calculateHistoricalBalance`.
*   **Antes:** O sistema mostrava sempre o saldo *atual* do banco de dados, ignorando a data selecionada.
*   **Agora:** O sistema reconstrói o saldo baseado no histórico. Se você voltar para "Janeiro/2024", ele pega o saldo inicial e soma/subtrai apenas as transações até o final de Janeiro de 2024.

## 2. Visibilidade de Importações (Cartão)
**Problema:** "Importações de dívidas sumindo."
**Solução:** Ajuste na lógica da Fatura (`getInvoiceData`).
*   **Ajuste:** Criei uma regra de "Inclusão Inteligente" para lançamentos do tipo `Saldo Inicial / Ajuste` (Importações).
*   **Como funciona:** Mesmo que a data da importação caia num "limbo" de dias (ex: dia do fechamento), o sistema agora força a exibição se o Mês e Ano forem compatíveis com a fatura visualizada.

## 3. Parcelamentos
**Problema:** "Parcelas não aparecem."
**Ações:**
*   **Correção de Dados:** O script de correção de órfãos já rodou (zerado).
*   **Correção de Visualização:** A lógica de data da fatura foi revisada.
*   **Nota:** Se as parcelas forem futuras, certifique-se de navegar para os meses seguintes. Se forem antigas, verifique se não foram arquivadas/deletadas.

---
**Instruções:**
1. Aguarde o Deploy na Vercel ( ~2 min).
2. Recarregue a página.
3. Teste a navegação de meses na Conta Bancária (o saldo deve mudar).
4. Verifique a fatura do cartão.
