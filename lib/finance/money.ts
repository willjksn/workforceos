export class FinanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceError";
  }
}

export function parseMoney(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

export function requireMoney(value: number | string | null | undefined, label: string): number {
  const parsed = parseMoney(value);
  if (parsed == null) {
    throw new FinanceError(`${label} is missing. Do not invent contract amounts.`);
  }
  return parsed;
}

export function moneyString(value: number): string {
  return value.toFixed(2);
}

export function addMoney(left: number, right: number) {
  return Math.round((left + right) * 100) / 100;
}

export function subtractMoney(left: number, right: number) {
  return Math.round((left - right) * 100) / 100;
}
