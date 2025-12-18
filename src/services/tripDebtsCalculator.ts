/**
 * Calculador de Dívidas de Viagem
 *
 * Calcula as dívidas entre participantes de uma viagem
 */

import { Transaction, TransactionType } from '../types';
import { FinancialPrecision } from './financialPrecision';
import { formatCurrency } from '../utils';

/**
 * Calcula as dívidas para uma viagem específica baseado nas transações.
 * Retorna uma lista de strings descrevendo o acerto (ex: "João deve R$ 50,00 para Maria").
 */
export const calculateTripDebts = (
  transactions: Transaction[],
  participants: { id: string; name: string }[]
): string[] => {
  // 1. Inicializar saldos (Positivo = Recebe, Negativo = Deve)
  const balances: { [id: string]: number } = {};
  const participantIds = participants.map((p) => p.id);

  balances['user'] = 0;
  participants.forEach((p) => (balances[p.id] = 0));

  // 2. Processar Transações
  transactions.forEach((t) => {
    if (t.deleted) return; // ✅ IGNORAR DELETADAS
    if (t.type !== TransactionType.EXPENSE) return; // Apenas despesas contam para dívidas

    // Verificar se a dívida principal (Eu -> Outro) está quitada
    if (t.payerId && t.isSettled) return;

    const amount = t.amount;
    const payerId = t.payerId || 'user'; // 'user' é o usuário principal

    // Debitar os Consumidores
    if (t.isShared && t.sharedWith && t.sharedWith.length > 0) {
      let totalSplitAmount = 0;

      // Split Explícito
      t.sharedWith.forEach((split) => {
        // Se eu paguei, e este split específico está quitado, pular (eles me pagaram de volta)
        if (payerId === 'user' && split.isSettled) return;

        if (balances[split.memberId] === undefined) balances[split.memberId] = 0;
        balances[split.memberId] = FinancialPrecision.subtract(
          balances[split.memberId],
          split.assignedAmount
        );
        totalSplitAmount = FinancialPrecision.sum([totalSplitAmount, split.assignedAmount]);
      });

      // Creditar o Pagador
      if (payerId === 'user') {
        if (balances[payerId] === undefined) balances[payerId] = 0;
        balances[payerId] = FinancialPrecision.sum([balances[payerId], totalSplitAmount]);
      } else {
        if (balances[payerId] === undefined) balances[payerId] = 0;
        balances[payerId] = FinancialPrecision.sum([balances[payerId], amount]);

        t.sharedWith.forEach((split) => {
          if (balances[split.memberId] === undefined) balances[split.memberId] = 0;
          balances[split.memberId] = FinancialPrecision.subtract(
            balances[split.memberId],
            split.assignedAmount
          );
        });

        const totalSplit = t.sharedWith.reduce((sum, s) => sum + s.assignedAmount, 0);
        const remainder = amount - totalSplit;
        if (remainder > 0.01) {
          balances['user'] = FinancialPrecision.subtract(balances['user'], remainder);
        }
      }
    } else {
      // Lógica de Split Implícito (mantido para suporte legado)
      if (!t.isShared) return;

      const allInvolved = ['user', ...participantIds];
      const splitAmount = FinancialPrecision.divide(amount, allInvolved.length);

      if (payerId === 'user') {
        let myCredit = 0;
        allInvolved.forEach((pid) => {
          if (pid === 'user') return;
          if (balances[pid] === undefined) balances[pid] = 0;
          balances[pid] = FinancialPrecision.subtract(balances[pid], splitAmount);
          myCredit = FinancialPrecision.sum([myCredit, splitAmount]);
        });
        if (balances['user'] === undefined) balances['user'] = 0;
        balances['user'] = FinancialPrecision.sum([balances['user'], myCredit]);
      } else {
        if (balances[payerId] === undefined) balances[payerId] = 0;
        balances[payerId] = FinancialPrecision.sum([balances[payerId], amount]);

        allInvolved.forEach((pid) => {
          if (balances[pid] === undefined) balances[pid] = 0;
          balances[pid] = FinancialPrecision.subtract(balances[pid], splitAmount);
        });
      }
    }
  });

  // 3. Algoritmo de Acerto
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  Object.entries(balances).forEach(([id, balance]) => {
    const val = FinancialPrecision.round(balance);
    if (val < -0.01) debtors.push({ id, amount: val }); // Saldo negativo
    if (val > 0.01) creditors.push({ id, amount: val }); // Saldo positivo
  });

  debtors.sort((a, b) => a.amount - b.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlementLines: string[] = [];
  const getName = (id: string) =>
    id === 'user' ? 'Você' : participants.find((p) => p.id === id)?.name || 'Desconhecido';

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    // Precisamos acertar o menor dos dois valores absolutos
    const amount = FinancialPrecision.round(Math.min(Math.abs(debtor.amount), creditor.amount));

    if (amount > 0) {
      settlementLines.push(
        `${getName(debtor.id)} deve pagar ${formatCurrency(amount, 'BRL')} para ${getName(creditor.id)}`
      );

      debtor.amount = FinancialPrecision.sum([debtor.amount, amount]);
      creditor.amount = FinancialPrecision.subtract(creditor.amount, amount);
    }

    if (Math.abs(debtor.amount) < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  if (settlementLines.length === 0) {
    return ['Tudo quitado! Nenhuma pendência em aberto.'];
  }

  return settlementLines;
};
