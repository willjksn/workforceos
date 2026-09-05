export type AgingBucket = "current" | "1_30" | "31_60" | "61_90" | "90_plus";

function utcDate(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function daysPastDue(dueDate: Date, asOf = new Date()) {
  return Math.floor((utcDate(asOf) - utcDate(dueDate)) / 86_400_000);
}

export function agingBucket(dueDate: Date | null | undefined, asOf = new Date()): AgingBucket | null {
  if (!dueDate) return null;
  const days = daysPastDue(dueDate, asOf);
  if (days <= 0) return "current";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_plus";
}

export function isInvoiceOverdue(input: {
  status: string;
  dueDate?: Date | null;
  balanceDue: number;
  asOf?: Date;
}) {
  if (["paid", "void"].includes(input.status)) return false;
  if (input.balanceDue <= 0) return false;
  if (!input.dueDate) return false;
  return daysPastDue(input.dueDate, input.asOf) > 0;
}
