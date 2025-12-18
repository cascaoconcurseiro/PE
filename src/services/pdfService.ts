import { Transaction, Account, Category, TransactionType } from '../types';
import { formatCurrency } from '../utils';

interface ReportData {
    title: string;
    period: string;
    totalIncome: number;
    totalExpense: number;
    balance: number;
    transactions: Transaction[];
    categoryBreakdown: { category: string; amount: number; percentage: number }[];
}

/**
 * Generate a printable HTML report and open print dialog
 */
export const generatePDFReport = (
    transactions: Transaction[],
    accounts: Account[],
    startDate: Date,
    endDate: Date,
    reportType: 'MONTHLY' | 'ANNUAL' = 'MONTHLY'
) => {
    // Filter transactions by date range
    const filteredTxs = transactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate >= startDate && txDate <= endDate;
    });

    // Calculate totals
    const totalIncome = filteredTxs
        .filter(t => t.type === TransactionType.INCOME && !t.isRefund)
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = filteredTxs
        .filter(t => t.type === TransactionType.EXPENSE && !t.isRefund)
        .reduce((sum, t) => sum + t.amount, 0);

    // Category breakdown
    const categoryMap = new Map<string, number>();
    filteredTxs
        .filter(t => t.type === TransactionType.EXPENSE && !t.isRefund)
        .forEach(t => {
            const cat = t.category || 'Outros';
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + t.amount);
        });

    const categoryBreakdown = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({
            category,
            amount,
            percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
        }))
        .sort((a, b) => b.amount - a.amount);

    // Format period
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const period = reportType === 'MONTHLY'
        ? `${monthNames[startDate.getMonth()]} de ${startDate.getFullYear()}`
        : `Ano de ${startDate.getFullYear()}`;

    // Generate HTML
    const html = generateReportHTML({
        title: reportType === 'MONTHLY' ? 'Relatório Mensal' : 'Relatório Anual',
        period,
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        transactions: filteredTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        categoryBreakdown
    });

    // Open in new window and print
    // Usar abordagem mais robusta para evitar bloqueio de pop-up
    try {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            // Aguardar carregamento completo antes de imprimir
            setTimeout(() => {
                try {
                    printWindow.focus();
                    printWindow.print();
                } catch (e) {
                    // Se print falhar, pelo menos o relatório está visível
                }
            }, 500);
        } else {
            // Fallback: criar iframe invisível para impressão
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);
            
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
                iframeDoc.write(html);
                iframeDoc.close();
                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                    // Remover iframe após impressão
                    setTimeout(() => document.body.removeChild(iframe), 1000);
                }, 500);
            }
        }
    } catch (error) {
        // Último fallback: abrir em nova aba com data URL
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
};

const generateReportHTML = (data: ReportData): string => {
    const categoryRows = data.categoryBreakdown
        .map(c => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${c.category}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrency(c.amount)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${c.percentage.toFixed(1)}%</td>
            </tr>
        `).join('');

    const transactionRows = data.transactions.slice(0, 50)
        .map(t => `
            <tr>
                <td style="padding: 6px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">${new Date(t.date).toLocaleDateString('pt-BR')}</td>
                <td style="padding: 6px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">${t.description}</td>
                <td style="padding: 6px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">${t.category || '-'}</td>
                <td style="padding: 6px; border-bottom: 1px solid #f1f5f9; font-size: 12px; text-align: right; color: ${t.type === TransactionType.INCOME ? '#10b981' : '#64748b'};">
                    ${t.type === TransactionType.INCOME ? '+' : '-'}${formatCurrency(t.amount)}
                </td>
            </tr>
        `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${data.title} - ${data.period}</title>
    <style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 40px; color: #1e293b; }
        .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #6366f1; }
        .header h1 { margin: 0; color: #6366f1; font-size: 28px; }
        .header p { margin: 8px 0 0; color: #64748b; font-size: 16px; }
        .summary { display: flex; justify-content: space-around; margin-bottom: 40px; }
        .summary-card { text-align: center; padding: 20px 40px; border-radius: 12px; }
        .summary-card.income { background: linear-gradient(135deg, #ecfdf5, #d1fae5); }
        .summary-card.expense { background: linear-gradient(135deg, #fef2f2, #fee2e2); }
        .summary-card.balance { background: linear-gradient(135deg, #eef2ff, #e0e7ff); }
        .summary-card h3 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
        .summary-card p { margin: 8px 0 0; font-size: 24px; font-weight: bold; }
        .section { margin-bottom: 30px; }
        .section h2 { font-size: 18px; color: #334155; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 10px; text-align: left; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; }
        .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; }
        @media print {
            body { padding: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 ${data.title}</h1>
        <p>${data.period}</p>
    </div>

    <div class="summary">
        <div class="summary-card income">
            <h3 style="color: #059669;">Receitas</h3>
            <p style="color: #059669;">${formatCurrency(data.totalIncome)}</p>
        </div>
        <div class="summary-card expense">
            <h3 style="color: #dc2626;">Despesas</h3>
            <p style="color: #dc2626;">${formatCurrency(data.totalExpense)}</p>
        </div>
        <div class="summary-card balance">
            <h3 style="color: #4f46e5;">Saldo</h3>
            <p style="color: ${data.balance >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(data.balance)}</p>
        </div>
    </div>

    <div class="section">
        <h2>📈 Gastos por Categoria</h2>
        <table>
            <thead>
                <tr>
                    <th>Categoria</th>
                    <th style="text-align: right;">Valor</th>
                    <th style="text-align: right;">%</th>
                </tr>
            </thead>
            <tbody>
                ${categoryRows}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>📋 Transações (últimas 50)</h2>
        <table>
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th style="text-align: right;">Valor</th>
                </tr>
            </thead>
            <tbody>
                ${transactionRows}
            </tbody>
        </table>
    </div>

    <div class="footer">
        <p>Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        <p>Sistema de Finanças Pessoais</p>
    </div>
</body>
</html>
    `;
};

/**
 * Generate monthly report for current month
 */
export const generateMonthlyReport = (transactions: Transaction[], accounts: Account[], date: Date) => {
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    generatePDFReport(transactions, accounts, startDate, endDate, 'MONTHLY');
};

/**
 * Generate annual report for current/selected year
 */
export const generateAnnualReport = (transactions: Transaction[], accounts: Account[], year: number) => {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    generatePDFReport(transactions, accounts, startDate, endDate, 'ANNUAL');
};
