type TransactionRecord = {
  reference: string;
  snippeReference: string | null;
  status: string;
};

const transactions = new Map<string, TransactionRecord>();

export function createTransaction(
  reference: string,
  status: string,
  snippeReference?: string
): TransactionRecord {
  const record: TransactionRecord = {
    reference,
    snippeReference: snippeReference || null,
    status,
  };
  transactions.set(reference, record);
  return record;
}

export function updateTransaction(
  reference: string,
  status: string,
  snippeReference?: string
): TransactionRecord {
  const existing = transactions.get(reference);
  if (existing) {
    existing.status = status;
    if (snippeReference) existing.snippeReference = snippeReference;
    return existing;
  }
  return createTransaction(reference, status, snippeReference);
}

export function getTransaction(reference: string): TransactionRecord | null {
  return transactions.get(reference) || null;
}

export function getTransactionBySnippeReference(
  snippeReference: string | null | undefined
): TransactionRecord | null {
  if (!snippeReference) return null;
  for (const record of transactions.values()) {
    if (record.snippeReference === snippeReference) return record;
  }
  return null;
}
