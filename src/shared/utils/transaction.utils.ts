import { Transaction } from '@prisma/client';

export function groupTransactionsByPostingNumber(
  transactions: Transaction[],
): Map<string, Transaction[]> {
  return transactions.reduce((map, tx) => {
    if (!tx.postingNumber) {
      return map;
    }
    const list = map.get(tx.postingNumber) ?? [];
    list.push(tx);
    map.set(tx.postingNumber, list);
    return map;
  }, new Map<string, Transaction[]>());
}

