import { Transaction, TransactionType, Category } from '../types';

export interface OFXTransaction {
    id: string;
    date: string;
    amount: number;
    description: string;
    type: TransactionType;
    externalId?: string;
}

export const parseOFX = async (file: File): Promise<OFXTransaction[]> => {
    const text = await file.text();
    const transactions: OFXTransaction[] = [];

    // Simple Regex-based parser (Robust enough for most bank OFX)
    // We look for <STMTTRN> blocks
    const transactionBlocks = text.split('<STMTTRN>');

    transactionBlocks.slice(1).forEach(block => {
        const typeMatch = block.match(/<TRNTYPE>(.*?)(\r|\n|<)/);
        const dateMatch = block.match(/<DTPOSTED>(.*?)(\r|\n|<)/);
        const amountMatch = block.match(/<TRNAMT>(.*?)(\r|\n|<)/);
        const idMatch = block.match(/<FITID>(.*?)(\r|\n|<)/);
        const memoMatch = block.match(/<MEMO>(.*?)(\r|\n|<)/);

        if (dateMatch && amountMatch && idMatch) {
            const rawDate = dateMatch[1].trim();
            // OFX Date format: YYYYMMDDHHMMSS...
            const date = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;

            const amount = parseFloat(amountMatch[1].replace(',', '.'));
            const description = memoMatch ? memoMatch[1].trim() : 'Sem descrição';
            const id = idMatch[1].trim();

            // Determine Type
            let type = TransactionType.EXPENSE;
            if (amount > 0) type = TransactionType.INCOME;

            transactions.push({
                id, // Temporary ID for frontend key
                date,
                amount: Math.abs(amount),
                description,
                type,
                externalId: id // Persistent External ID
            } as OFXTransaction);
        }
    });

    return transactions;
};
