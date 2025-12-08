
const { getInvoiceData } = require('./services/accountUtils'); // We need to mock this or copy logic because it's TS
// Actually simpler to just copy the logic to this script to verify it in isolation without TS compilation issues

function getInvoiceDataLogic(account, transactions, referenceDate) {
    // Default fallback
    if (!account.closingDay || !account.limit) {
        return {
            debug: "FALLBACK_TRIGGERED",
            invoiceTotal: 0,
            transactions: [],
            status: 'OPEN',
            daysToClose: 0,
            closingDate: new Date(),
            dueDate: new Date()
        };
    }

    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const currentDay = referenceDate.getDate();
    const closingDay = Number(account.closingDay); // Force number

    // DEFINIÇÃO DE FATURA:
    // A fatura de "Maio" é aquela que FECHA em Maio.

    // Calcular Data de Fechamento desta fatura de referência
    const closingDate = new Date(year, month, closingDay);

    // Calcular Data de Início (Fechamento do mês anterior + 1 dia)
    const startDate = new Date(year, month - 1, closingDay + 1);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = closingDate.toISOString().split('T')[0];

    console.log(`Debug Cycle: ${startStr} to ${endStr}`);

    const now = new Date(); // Mock current time as "now"
    const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const closingZero = new Date(closingDate.getFullYear(), closingDate.getMonth(), closingDate.getDate());

    const daysToClose = Math.ceil((closingZero.getTime() - nowZero.getTime()) / (1000 * 3600 * 24));
    const status = closingZero < nowZero ? 'CLOSED' : 'OPEN';

    return {
        startStr,
        endStr,
        status,
        daysToClose,
        closingDate
    };
}

// Test Case 1: Early Closing Day
const today = new Date('2025-12-08T12:00:00'); // Fixed test date
const account = {
    id: '1',
    closingDay: 1, // Day 1
    limit: 1000
};

console.log("--- TEST CASE: Selecting DECEMBER (Current Date) ---");
const resultDec = getInvoiceDataLogic(account, [], today);
console.log("Selected Date:", today.toISOString());
console.log("Closing Date:", resultDec.closingDate.toISOString());
console.log("Status:", resultDec.status);
console.log("Days to Close:", resultDec.daysToClose); // Should be negative because Dec 1 < Dec 8

console.log("\n--- TEST CASE: Selecting JANUARY ---");
const janDate = new Date('2026-01-08T12:00:00');
const resultJan = getInvoiceDataLogic(account, [], janDate);
console.log("Selected Date:", janDate.toISOString());
console.log("Closing Date:", resultJan.closingDate.toISOString());
console.log("Status:", resultJan.status);
console.log("Days to Close:", resultJan.daysToClose); // Should be ~23 (Dec 8 to Jan 1) -> WAIT. 
// calculating daysToClose uses 'now'. If 'now' is Dec 8.
// Jan 1 - Dec 8 = 24 days.
