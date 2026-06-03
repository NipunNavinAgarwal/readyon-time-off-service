export interface HcmBalance {
  employeeId: string;
  locationId: string;
  balanceDays: number;
}

export interface HcmDebitResult {
  transactionId: string;
  remainingBalanceDays: number;
}

export abstract class HcmClient {
  abstract getBalance(employeeId: string, locationId: string): Promise<HcmBalance>;
  abstract debitTimeOff(
    employeeId: string,
    locationId: string,
    days: number,
    idempotencyKey: string,
  ): Promise<HcmDebitResult>;
  abstract getBatchBalances(): Promise<HcmBalance[]>;
}
