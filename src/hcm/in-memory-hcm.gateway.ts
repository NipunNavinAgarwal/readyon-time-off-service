import { Injectable } from '@nestjs/common';
import { DomainError } from '../common/errors';
import { HcmBalance, HcmClient, HcmDebitResult } from './hcm.client';

interface HcmEntry {
  balanceDays: number;
}

@Injectable()
export class InMemoryHcmGateway extends HcmClient {
  private balances = new Map<string, HcmEntry>();
  private debitResponses = new Map<string, HcmDebitResult>();
  private failNextDebit = false;
  private unsafeSuccessNextDebit = false;

  reset() {
    this.balances.clear();
    this.debitResponses.clear();
    this.failNextDebit = false;
    this.unsafeSuccessNextDebit = false;
  }

  seed(entries: HcmBalance[]) {
    for (const entry of entries) {
      this.setBalance(entry.employeeId, entry.locationId, entry.balanceDays);
    }
  }

  setBalance(employeeId: string, locationId: string, balanceDays: number) {
    if (balanceDays < 0) {
      throw new DomainError('HCM balance cannot be negative.');
    }
    this.balances.set(key(employeeId, locationId), { balanceDays });
  }

  configureFailure(options: { failNextDebit?: boolean; unsafeSuccessNextDebit?: boolean }) {
    this.failNextDebit = options.failNextDebit ?? this.failNextDebit;
    this.unsafeSuccessNextDebit = options.unsafeSuccessNextDebit ?? this.unsafeSuccessNextDebit;
  }

  async getBalance(employeeId: string, locationId: string): Promise<HcmBalance> {
    const entry = this.balances.get(key(employeeId, locationId));
    if (!entry) {
      throw new DomainError('HCM rejected invalid employee/location combination.', 'not_found');
    }
    return { employeeId, locationId, balanceDays: entry.balanceDays };
  }

  async debitTimeOff(
    employeeId: string,
    locationId: string,
    days: number,
    idempotencyKey: string,
  ): Promise<HcmDebitResult> {
    const cached = this.debitResponses.get(idempotencyKey);
    if (cached) {
      return cached;
    }
    if (this.failNextDebit) {
      this.failNextDebit = false;
      throw new DomainError('HCM debit failed.', 'conflict');
    }

    const entry = this.balances.get(key(employeeId, locationId));
    if (!entry) {
      throw new DomainError('HCM rejected invalid employee/location combination.', 'not_found');
    }
    if (entry.balanceDays < days && !this.unsafeSuccessNextDebit) {
      throw new DomainError('HCM rejected insufficient balance.', 'conflict');
    }

    if (this.unsafeSuccessNextDebit) {
      this.unsafeSuccessNextDebit = false;
      const result = {
        transactionId: `unsafe-${idempotencyKey}`,
        remainingBalanceDays: -1,
      };
      this.debitResponses.set(idempotencyKey, result);
      return result;
    }

    entry.balanceDays = roundDays(entry.balanceDays - days);
    const result = {
      transactionId: `hcm-${idempotencyKey}`,
      remainingBalanceDays: entry.balanceDays,
    };
    this.debitResponses.set(idempotencyKey, result);
    return result;
  }

  async getBatchBalances(): Promise<HcmBalance[]> {
    return Array.from(this.balances.entries()).map(([compoundKey, entry]) => {
      const [employeeId, locationId] = compoundKey.split('::');
      return { employeeId, locationId, balanceDays: entry.balanceDays };
    });
  }
}

function key(employeeId: string, locationId: string): string {
  return `${employeeId}::${locationId}`;
}

function roundDays(value: number): number {
  return Math.round(value * 1000) / 1000;
}
