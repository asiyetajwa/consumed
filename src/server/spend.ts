// The spend guard. Every Meta Model API call reserves its worst case before it is sent, records its real cost
// from the returned usage in a ledger, and is refused once the budget would be passed. Any billing error halts
// all further calls until the server restarts.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';

/** Published prices (dev.meta.ai/docs/pricing-rate-limits, read October 26, 2026). */
export const PRICES = {
  'muse-spark-1.3': { inPerM: 1.25, outPerM: 4.25 },
  'muse-image-1.0': { perImage: 0.01 },
} as const;

export class BudgetError extends Error {}
export class BillingError extends Error {}

export interface LedgerEntry {
  at: string;
  scope: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  ok: boolean;
}

export function tokenCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICES[model as 'muse-spark-1.3'] as { inPerM: number; outPerM: number } | undefined;
  if (!p) throw new BudgetError(`No published price for ${model}; refusing to call it.`);
  return (tokensIn * p.inPerM + tokensOut * p.outPerM) / 1_000_000;
}

export class SpendGuard {
  private spentUsd = 0;
  private reservedUsd = 0;
  private haltedFor: string | null = null;

  constructor(
    readonly budgetUsd: number,
    private readonly ledgerPath: string | null,
  ) {
    if (ledgerPath && existsSync(ledgerPath)) {
      for (const line of readFileSync(ledgerPath, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          this.spentUsd += (JSON.parse(line) as LedgerEntry).costUsd;
        } catch {
          // A torn last line from a crash is skipped; the rest still counts.
        }
      }
    }
  }

  spent(): number {
    return this.spentUsd;
  }

  halted(): string | null {
    return this.haltedFor;
  }

  /** Holds the worst case for one call. Returns a release function to call once the real cost is known. */
  reserve(worstUsd: number): () => void {
    if (this.haltedFor) throw new BillingError(`Calls are halted: ${this.haltedFor}`);
    if (this.spentUsd + this.reservedUsd + worstUsd > this.budgetUsd) {
      throw new BudgetError(`This call could cost up to $${worstUsd.toFixed(4)}, which would pass the $${this.budgetUsd.toFixed(2)} budget ($${this.spentUsd.toFixed(4)} spent).`);
    }
    this.reservedUsd += worstUsd;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.reservedUsd -= worstUsd;
    };
  }

  record(entry: LedgerEntry): void {
    this.spentUsd += entry.costUsd;
    if (this.ledgerPath) appendFileSync(this.ledgerPath, `${JSON.stringify(entry)}\n`);
  }

  halt(reason: string): void {
    this.haltedFor = reason;
  }
}

/** True when an API error looks like money: no credit, a declined card, a spend limit. */
export function isBillingError(status: number, body: string): boolean {
  if (status === 402) return true;
  return /billing|credit|insufficient|payment|quota|spend limit|balance/i.test(body);
}
