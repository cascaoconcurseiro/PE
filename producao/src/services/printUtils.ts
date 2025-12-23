import { Transaction, Account, Asset, Trip, TransactionType } from '../types';
import { formatCurrency } from '../utils';

const getBaseStyles = () => `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
    body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 40px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header h1 { font-size: 24px; font-weight: 800; margin: 0; color: #0f172a; }
    .header p { font-size: 12px; color: #64748b; margin: 5px 0 0 0; }
    .meta { display: flex; gap: 40px; margin-bottom: 30px; }
    .meta-item h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 4px 0; }
    .meta-item p { font-size: 16px; font-weight: 600; color: #334155; margin: 0; }
    table { w-full: 100%; width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 12px 8px; border-bottom: 1px solid #cbd5e1; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 10px; }
    td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .amount { font-family: 'Monaco', 'Consolas', monospace; font-weight: 600; text-align: right; }
    .text-right { text-align: right; }
    .income { color: #059669; }
    .expense { color: #dc2626; }
    .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 10px; color: #94a3b8; }
    .logo { width: 30px; height: 30px; background: #0f172a; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin-bottom: 10px; }
`;

const openPrintWindow = (title: string, content: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
        <html>
        <head>
            <title>${title}</title>
            <style>${getBaseStyles()}</style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="logo">P</div>
                    <h1>${title}</h1>
                    <p>Relatório gerado em ${new Date().toLocaleString('pt-BR')}</p>
                </div>
                <div class="text-right">
                    <p>Pé de Meia</p>
                    <p>Sistema de Gestão Financeira</p>
                </div>
            </div>
            ${content}
            <div class="footer">
                <p>Documento gerado automaticamente pelo sistema Pé de Meia. A conferência dos dados é de responsabilidade do usuário.</p>
            </div>
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};

export const printAccountStatement = (account: Account, transactions: Transaction[]) => {
    const income = transactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + (t.isRefund ? -t.amount : t.amount), 0);
    const expense = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + (t.isRefund ? -t.amount : t.amount), 0);
    const balance = income - expense;

    const rows = transactions.map(t => {
        const isPositive = (t.type === TransactionType.INCOME && !t.isRefund) || (t.type === TransactionType.EXPENSE && t.isRefund);
        return `
            <tr>
                <td>${new Date(t.date).toLocaleDateString('pt-BR')}</td>
                <td>
                    <strong>${t.description}</strong><br/>
                    <span style="color: #64748b">${t.category}</span>
                </td>
                <td>${t.type}</td>
                <td class="amount ${isPositive ? 'income' : 'expense'}">
                    ${isPositive ? '+' : '-'} ${formatCurrency(t.amount, account.currency)}
                </td>
            </tr>
        `;
    }).join('');

    const content = `
        <div class="meta">
            <div class="meta-item">
                <h3>Conta / Cartão</h3>
                <p>${account.name}</p>
            </div>
            <div class="meta-item">
                <h3>Moeda</h3>
                <p>${account.currency}</p>
            </div>
            <div class="meta-item">
                <h3>Entradas</h3>
                <p class="income">${formatCurrency(income, account.currency)}</p>
            </div>
            <div class="meta-item">
                <h3>Saídas</h3>
                <p class="expense">${formatCurrency(expense, account.currency)}</p>
            </div>
            <div class="meta-item">
                <h3>Saldo do Período</h3>
                <p>${formatCurrency(balance, account.currency)}</p>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th style="width: 15%">Data</th>
                    <th style="width: 45%">Descrição</th>
                    <th style="width: 15%">Tipo</th>
                    <th class="text-right" style="width: 25%">Valor</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;

    openPrintWindow(`Extrato - ${account.name}`, content);
};

export const printAssetsReport = (assets: Asset[]) => {
    const totalInvested = assets.reduce((acc, a) => acc + (a.quantity * a.averagePrice), 0);
    const currentTotal = assets.reduce((acc, a) => acc + (a.quantity * a.currentPrice), 0);
    const profit = currentTotal - totalInvested;
    const profitPercent = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

    const rows = assets.map(a => {
        const total = a.quantity * a.currentPrice;
        const gain = total - (a.quantity * a.averagePrice);
        const gainPercent = (gain / (a.quantity * a.averagePrice)) * 100;
        const isPos = gain >= 0;

        return `
            <tr>
                <td><strong>${a.ticker}</strong><br/><span style="color:#64748b">${a.type}</span></td>
                <td>${a.name}</td>
                <td class="text-right">${a.quantity}</td>
                <td class="text-right">${formatCurrency(a.averagePrice, a.currency)}</td>
                <td class="text-right">${formatCurrency(a.currentPrice, a.currency)}</td>
                <td class="amount">${formatCurrency(total, a.currency)}</td>
                <td class="amount ${isPos ? 'income' : 'expense'}">
                    ${isPos ? '+' : ''}${gainPercent.toFixed(2)}%
                </td>
            </tr>
        `;
    }).join('');

    const content = `
        <div class="meta">
            <div class="meta-item">
                <h3>Total Investido</h3>
                <p>${formatCurrency(totalInvested)}</p>
            </div>
            <div class="meta-item">
                <h3>Valor Atual</h3>
                <p>${formatCurrency(currentTotal)}</p>
            </div>
            <div class="meta-item">
                <h3>Rentabilidade Global</h3>
                <p class="${profit >= 0 ? 'income' : 'expense'}">
                    ${profit >= 0 ? '+' : ''}${formatCurrency(profit)} (${profitPercent.toFixed(2)}%)
                </p>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Ativo</th>
                    <th>Nome</th>
                    <th class="text-right">Qtd</th>
                    <th class="text-right">P. Médio</th>
                    <th class="text-right">P. Atual</th>
                    <th class="text-right">Total</th>
                    <th class="text-right">Rentab.</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;

    openPrintWindow('Relatório de Investimentos', content);
};

export const printIRReport = (assets: Asset[]) => {
    const rows = assets.map(a => {
        const total = a.quantity * a.averagePrice; // IR uses ACQUISITION COST (Average Price), not current market value
        return `
            <tr>
                <td>
                    <strong>${a.ticker} - ${a.name}</strong><br/>
                    <span style="font-size: 10px; color: #64748b">${a.type}</span>
                </td>
                <td>
                    <div style="font-size: 11px; line-height: 1.4;">
                        ${a.quantity} unidades de ${a.name} (${a.ticker}), ao custo médio de ${formatCurrency(a.averagePrice, a.currency)}.
                    </div>
                </td>
                <td class="amount">
                    ${formatCurrency(total, a.currency)}
                </td>
            </tr>
        `;
    }).join('');

    const content = `
        <div class="meta">
            <div class="meta-item" style="width: 100%">
                <h3>Declaração de Bens e Direitos</h3>
                <p>Posição Consolidada (Custo de Aquisição)</p>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th style="width: 25%">Bem</th>
                    <th style="width: 55%">Discriminação</th>
                    <th class="text-right" style="width: 20%">Situação em 31/12</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
        <div style="margin-top: 20px; font-size: 10px; color: #64748b; font-style: italic;">
            Nota: Os valores apresentados referem-se ao Custo de Aquisição (Preço Médio), conforme exigido pela Receita Federal para a declaração de Bens e Direitos, e não ao valor de mercado atual.
        </div>
    `;

    openPrintWindow('Relatório Auxiliar para Imposto de Renda', content);
};